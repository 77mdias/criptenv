"""Sync commands for pushing/pulling secrets to/from cloud."""

import click
import base64
import getpass
import os

from criptenv.context import cli_context, local_vault, run_async, _resolve_env_id, resolve_project_id
from criptenv.vault import queries
from criptenv.crypto import (
    decrypt,
    derive_env_key,
    derive_project_env_key,
    derive_vault_proof,
    encrypt,
    verify_project_vault_password,
)


def _get_vault_password() -> str:
    password = os.getenv("CRIPTENV_VAULT_PASSWORD")
    if password:
        return password
    return getpass.getpass("Vault password: ")


def _load_project_vault(client, project_id: str) -> tuple[dict, str]:
    project = run_async(client.get_project(project_id))
    vault_config = project.get("vault_config")
    if not vault_config:
        raise click.ClickException("Project does not have vault password configuration.")

    password = _get_vault_password()
    if not verify_project_vault_password(password, vault_config):
        raise click.ClickException("Invalid vault password.")

    return vault_config, password


@click.command()
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--force", is_flag=True, help="Force overwrite remote secrets")
def push_command(env_name: str | None, project_id: str | None, force: bool):
    """Push local secrets to the cloud.

    Encrypted secrets are uploaded to the server.
    The server never sees plaintext values.

    \b
    Examples:
        criptenv push -p <project-id>
        criptenv push -e staging -p <project-id>
        criptenv push -p <project-id> --force
    """
    with cli_context(require_auth=True, require_master_key=True) as (db, master_key, client):
        resolved_project_id = resolve_project_id(db, project_id)
        env_id = run_async(_resolve_env_id(db, env_name))
        local_secrets = run_async(queries.list_secrets(db, env_id))

        if not local_secrets:
            click.echo("No local secrets to push.")
            return

        # Check remote version for conflicts
        try:
            remote_info = run_async(client.get_vault_version(resolved_project_id, env_id))
            remote_version = remote_info.get("version", 0)
        except Exception:
            remote_version = 0

        if not force and remote_version > 0:
            click.echo(f"Remote vault has version {remote_version}.")
            if not click.confirm("Continue pushing?"):
                click.echo("Cancelled.")
                return

        try:
            vault_config, vault_password = _load_project_vault(client, resolved_project_id)
        except click.ClickException as e:
            click.echo(f"Error: {e.message}", err=True)
            raise SystemExit(1)

        local_env_key = derive_env_key(master_key, env_id)
        project_env_key = derive_project_env_key(vault_password, vault_config, env_id)
        vault_proof = derive_vault_proof(
            vault_password,
            vault_config["proof_salt"],
            int(vault_config.get("iterations", 100000)),
        )

        # Decrypt local blobs and re-encrypt for the project vault.
        blobs = []
        for secret in local_secrets:
            plaintext = decrypt(secret.ciphertext, secret.iv, secret.auth_tag, local_env_key)
            ciphertext, iv, auth_tag, checksum = encrypt(plaintext, project_env_key)
            blob = {
                "key_id": secret.key_id,
                "iv": base64.b64encode(iv).decode("ascii"),
                "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
                "auth_tag": base64.b64encode(auth_tag).decode("ascii"),
                "version": secret.version,
                "checksum": checksum,
            }
            blobs.append(blob)

        with click.progressbar(blobs, label=f"Pushing {len(blobs)} secrets") as bar:
            try:
                result = run_async(client.push_vault(resolved_project_id, env_id, blobs, vault_proof=vault_proof))
            except Exception as e:
                click.echo(f"\nError: {e}", err=True)
                raise SystemExit(1)

    new_version = result.get("version", "?")
    click.echo(f"✓ Pushed {len(blobs)} secret(s) (version {new_version})")


@click.command()
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--force", is_flag=True, help="Force overwrite local secrets")
def pull_command(env_name: str | None, project_id: str | None, force: bool):
    """Pull cloud secrets to local vault.

    Downloads encrypted secrets from the server and stores
    them locally. Decryption happens only when you access them.

    \b
    Examples:
        criptenv pull -p <project-id>
        criptenv pull -e staging -p <project-id>
        criptenv pull -p <project-id> --force
    """
    with cli_context(require_auth=True, require_master_key=True) as (db, master_key, client):
        resolved_project_id = resolve_project_id(db, project_id)
        env_id = run_async(_resolve_env_id(db, env_name))
        try:
            vault_config, vault_password = _load_project_vault(client, resolved_project_id)
        except click.ClickException as e:
            click.echo(f"Error: {e.message}", err=True)
            raise SystemExit(1)

        click.echo("Pulling secrets from cloud...")

        try:
            result = run_async(client.pull_vault(resolved_project_id, env_id))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

        remote_blobs = result.get("blobs", [])
        remote_version = result.get("version", 0)

        if not remote_blobs:
            click.echo("No secrets in cloud.")
            return

        # Check for local conflicts
        local_secrets = run_async(queries.list_secrets(db, env_id))
        local_keys = {s.key_id: s for s in local_secrets}

        import time
        import uuid
        from criptenv.vault.models import Secret

        local_env_key = derive_env_key(master_key, env_id)
        project_env_key = derive_project_env_key(vault_password, vault_config, env_id)
        pulled = 0
        skipped = 0

        with click.progressbar(remote_blobs, label="Pulling secrets") as bar:
            for blob in bar:
                key_id = blob["key_id"]

                # Check for conflict
                if key_id in local_keys and not force:
                    local = local_keys[key_id]
                    if local.version >= blob["version"]:
                        skipped += 1
                        continue

                plaintext = decrypt(
                    base64.b64decode(blob["ciphertext"]),
                    base64.b64decode(blob["iv"]),
                    base64.b64decode(blob["auth_tag"]),
                    project_env_key,
                )
                ciphertext, iv, auth_tag, checksum = encrypt(plaintext, local_env_key)

                # Save re-encrypted blob to local vault
                existing = local_keys.get(key_id)
                secret = Secret(
                    id=existing.id if existing else f"sec_{uuid.uuid4().hex[:16]}",
                    environment_id=env_id,
                    key_id=key_id,
                    iv=iv,
                    ciphertext=ciphertext,
                    auth_tag=auth_tag,
                    version=blob["version"],
                    checksum=checksum,
                    created_at=existing.created_at if existing else int(time.time()),
                    updated_at=int(time.time()),
                )
                run_async(queries.save_secret(db, secret))
                pulled += 1

    click.echo(f"✓ Pulled {pulled} secret(s) (version {remote_version})")
    if skipped:
        click.echo(f"  Skipped {skipped} (local version is newer)")

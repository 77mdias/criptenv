"""Sync commands for pushing/pulling secrets to/from cloud."""

import click
import base64

from criptenv.context import cli_context, local_vault, run_async, _resolve_env_id
from criptenv.vault import queries


@click.command()
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", "project_id", required=True, help="Project ID")
@click.option("--force", is_flag=True, help="Force overwrite remote secrets")
def push_command(env_name: str | None, project_id: str, force: bool):
    """Push local secrets to the cloud.

    Encrypted secrets are uploaded to the server.
    The server never sees plaintext values.

    \b
    Examples:
        criptenv push -p <project-id>
        criptenv push -e staging -p <project-id>
        criptenv push -p <project-id> --force
    """
    with cli_context(require_auth=True) as (db, master_key, client):
        env_id = run_async(_resolve_env_id(db, env_name))
        local_secrets = run_async(queries.list_secrets(db, env_id))

        if not local_secrets:
            click.echo("No local secrets to push.")
            return

        # Check remote version for conflicts
        try:
            remote_info = run_async(client.get_vault_version(project_id, env_id))
            remote_version = remote_info.get("version", 0)
        except Exception:
            remote_version = 0

        if not force and remote_version > 0:
            click.echo(f"Remote vault has version {remote_version}.")
            if not click.confirm("Continue pushing?"):
                click.echo("Cancelled.")
                return

        # Serialize secrets as base64 blobs
        blobs = []
        for secret in local_secrets:
            blob = {
                "key_id": secret.key_id,
                "iv": base64.b64encode(secret.iv).decode("ascii"),
                "ciphertext": base64.b64encode(secret.ciphertext).decode("ascii"),
                "auth_tag": base64.b64encode(secret.auth_tag).decode("ascii"),
                "version": secret.version,
                "checksum": secret.checksum,
            }
            blobs.append(blob)

        click.echo(f"Pushing {len(blobs)} secret(s)...")

        try:
            result = run_async(client.push_vault(project_id, env_id, blobs))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    new_version = result.get("version", "?")
    click.echo(f"✓ Pushed {len(blobs)} secret(s) (version {new_version})")


@click.command()
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", "project_id", required=True, help="Project ID")
@click.option("--force", is_flag=True, help="Force overwrite local secrets")
def pull_command(env_name: str | None, project_id: str, force: bool):
    """Pull cloud secrets to local vault.

    Downloads encrypted secrets from the server and stores
    them locally. Decryption happens only when you access them.

    \b
    Examples:
        criptenv pull -p <project-id>
        criptenv pull -e staging -p <project-id>
        criptenv pull -p <project-id> --force
    """
    with cli_context(require_auth=True) as (db, master_key, client):
        env_id = run_async(_resolve_env_id(db, env_name))

        click.echo("Pulling secrets from cloud...")

        try:
            result = run_async(client.pull_vault(project_id, env_id))
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

        pulled = 0
        skipped = 0

        for blob in remote_blobs:
            key_id = blob["key_id"]

            # Check for conflict
            if key_id in local_keys and not force:
                local = local_keys[key_id]
                if local.version >= blob["version"]:
                    click.echo(f"  Skipped {key_id} (local v{local.version} >= remote v{blob['version']})")
                    skipped += 1
                    continue

            # Save to local vault
            existing = local_keys.get(key_id)
            secret = Secret(
                id=existing.id if existing else f"sec_{uuid.uuid4().hex[:16]}",
                environment_id=env_id,
                key_id=key_id,
                iv=base64.b64decode(blob["iv"]),
                ciphertext=base64.b64decode(blob["ciphertext"]),
                auth_tag=base64.b64decode(blob["auth_tag"]),
                version=blob["version"],
                checksum=blob["checksum"],
                created_at=existing.created_at if existing else int(time.time()),
                updated_at=int(time.time()),
            )
            run_async(queries.save_secret(db, secret))
            pulled += 1

    click.echo(f"✓ Pulled {pulled} secret(s) (version {remote_version})")
    if skipped:
        click.echo(f"  Skipped {skipped} (local version is newer)")

"""Project management commands."""

import click
import getpass
import hashlib

from criptenv.context import cli_context, run_async
from criptenv.crypto import build_project_vault_config, derive_project_env_key
from criptenv.crypto.core import encrypt as crypto_encrypt, decrypt as crypto_decrypt
from criptenv.crypto.utils import to_base64, from_base64


@click.group("projects")
def projects_group():
    """Manage projects."""
    pass


@projects_group.command("create")
@click.argument("name")
@click.option("--slug", default=None, help="Optional project slug")
@click.option("--description", default=None, help="Optional project description")
def projects_create(name: str, slug: str | None, description: str | None):
    """Create a project with a project-specific vault password."""
    password = getpass.getpass("Vault password: ")
    if len(password) < 8:
        click.echo("Error: Vault password must be at least 8 characters", err=True)
        raise SystemExit(1)

    confirm = getpass.getpass("Confirm vault password: ")
    if password != confirm:
        click.echo("Error: Vault passwords do not match", err=True)
        raise SystemExit(1)

    vault_config, vault_proof = build_project_vault_config(password)

    with cli_context(require_auth=True) as (_db, _master_key, client):
        try:
            project = run_async(
                client.create_project(
                    name=name,
                    slug=slug,
                    description=description,
                    vault_config=vault_config,
                    vault_proof=vault_proof,
                )
            )
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Created project {project['name']} ({project['id']})")


@projects_group.command("list")
def projects_list():
    """List your projects with their IDs.

    Use project IDs with --project flag in other commands.

    \b
    Examples:
        criptenv projects list
    """
    with cli_context(require_auth=True) as (db, master_key, client):
        try:
            result = run_async(client.list_projects())
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    projects = result.get("projects", [])
    if not projects:
        click.echo("No projects found.")
        return

    click.echo(f"{'NAME':<30} {'ID':<38} {'SLUG':<20}")
    click.echo("─" * 88)
    for p in projects:
        click.echo(f"{p['name']:<30} {p['id']:<38} {p.get('slug', ''):<20}")

    click.echo("")
    click.echo(f"Total: {len(projects)} project(s)")


@projects_group.command("info")
@click.argument("project_id")
def projects_info(project_id: str):
    """Show detailed information about a project.

    \b
    Examples:
        criptenv projects info <project-id>
    """
    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            project = run_async(client.get_project(project_id))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"Name:        {project.get('name', 'unknown')}")
    click.echo(f"ID:          {project.get('id', 'unknown')}")
    click.echo(f"Slug:        {project.get('slug', 'N/A')}")
    click.echo(f"Description: {project.get('description', 'N/A')}")
    click.echo(f"Owner ID:    {project.get('owner_id', 'unknown')}")
    click.echo(f"Created:     {project.get('created_at', 'unknown')}")
    click.echo(f"Updated:     {project.get('updated_at', 'unknown')}")


@projects_group.command("update")
@click.argument("project_id")
@click.option("--name", "-n", default=None, help="New project name")
@click.option("--description", "-d", default=None, help="New description")
def projects_update(project_id: str, name: str | None, description: str | None):
    """Update a project's name or description.

    \b
    Examples:
        criptenv projects update <project-id> --name "New Name"
        criptenv projects update <project-id> -d "Updated description"
    """
    if not name and not description:
        click.echo("Error: Provide at least one of --name or --description", err=True)
        raise SystemExit(1)

    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            project = run_async(client.update_project(project_id, name=name, description=description))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Updated project {project.get('name', project_id)}")


@projects_group.command("delete")
@click.argument("project_id")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def projects_delete(project_id: str, force: bool):
    """Delete a project permanently.

    \b
    Examples:
        criptenv projects delete <project-id>
        criptenv projects delete <project-id> --force
    """
    if not force:
        if not click.confirm(f"Delete project {project_id}? This cannot be undone."):
            click.echo("Aborted.")
            return

    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            run_async(client.delete_project(project_id))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Deleted project {project_id}")


@projects_group.command("rekey")
@click.argument("project_id")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def projects_rekey(project_id: str, force: bool):
    """Rotate the vault encryption key for a project.

    This re-encrypts all secrets with a new key. Requires vault password.

    \b
    Examples:
        criptenv projects rekey <project-id>
        criptenv projects rekey <project-id> --force
    """
    if not force:
        if not click.confirm(f"Rekey project {project_id}? This will re-encrypt all secrets."):
            click.echo("Aborted.")
            return

    current_password = getpass.getpass("Current vault password: ")
    new_password = getpass.getpass("New vault password: ")
    if len(new_password) < 8:
        click.echo("Error: New vault password must be at least 8 characters", err=True)
        raise SystemExit(1)

    confirm = getpass.getpass("Confirm new vault password: ")
    if new_password != confirm:
        click.echo("Error: Vault passwords do not match", err=True)
        raise SystemExit(1)

    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            # Fetch project to get vault_config
            project = run_async(client.get_project(project_id))
            vault_config = project.get("vault_config")
            if not vault_config:
                click.echo(
                    "Error: Project has no vault_config. Legacy vault rekey is not supported via CLI. "
                    "Please use the web dashboard.",
                    err=True,
                )
                raise SystemExit(1)

            # Verify current password
            from criptenv.crypto.keys import verify_project_vault_password

            if not verify_project_vault_password(current_password, vault_config):
                click.echo("Error: Invalid current vault password", err=True)
                raise SystemExit(1)

            # Derive current vault proof for API authorization
            from criptenv.crypto.keys import derive_vault_proof

            current_vault_proof = derive_vault_proof(
                current_password,
                vault_config["proof_salt"],
                int(vault_config.get("iterations", 100000)),
            )

            # Build new vault config and proof
            new_vault_config, new_vault_proof = build_project_vault_config(new_password)

            # Fetch environments
            envs_resp = run_async(client.list_environments(project_id))
            environments = envs_resp.get("environments", [])
            if not environments:
                click.echo("Error: No environments found for project", err=True)
                raise SystemExit(1)

            # Re-encrypt secrets for each environment
            rekey_environments = []
            for env in environments:
                env_id = env["id"]

                # Pull current vault
                vault_resp = run_async(client.pull_vault(project_id, env_id))
                blobs = vault_resp.get("blobs", [])
                version = vault_resp.get("version", 0)

                # Derive old and new environment keys
                old_env_key = derive_project_env_key(current_password, vault_config, env_id)
                new_env_key = derive_project_env_key(new_password, new_vault_config, env_id)

                # Decrypt and re-encrypt each blob
                new_blobs = []
                for blob in blobs:
                    # Decrypt
                    iv = from_base64(blob["iv"])
                    ciphertext = from_base64(blob["ciphertext"])
                    auth_tag = from_base64(blob["auth_tag"])
                    expected_checksum = blob.get("checksum")

                    plaintext = crypto_decrypt(
                        ciphertext, iv, auth_tag, old_env_key, expected_checksum
                    )

                    # Re-encrypt
                    new_ct, new_iv, new_at, _ = crypto_encrypt(plaintext, new_env_key)

                    iv_b64 = to_base64(new_iv)
                    ct_b64 = to_base64(new_ct)
                    at_b64 = to_base64(new_at)

                    # Compute checksum matching web format: sha256(key:iv:ct:auth_tag)
                    checksum_str = hashlib.sha256(
                        f"{blob['key_id']}:{iv_b64}:{ct_b64}:{at_b64}".encode()
                    ).hexdigest()

                    new_blobs.append({
                        "key_id": blob["key_id"],
                        "iv": iv_b64,
                        "ciphertext": ct_b64,
                        "auth_tag": at_b64,
                        "checksum": checksum_str,
                        "version": version + 1,
                    })

                rekey_environments.append({
                    "environment_id": env_id,
                    "blobs": new_blobs,
                })

            # Call API with complete payload
            result = run_async(
                client.rekey_project(
                    project_id=project_id,
                    current_vault_proof=current_vault_proof,
                    new_vault_config=new_vault_config,
                    new_vault_proof=new_vault_proof,
                    environments=rekey_environments,
                )
            )
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Rekeyed project {project_id}")
    if result.get("vault_config"):
        click.echo("  Vault encryption key rotated successfully.")

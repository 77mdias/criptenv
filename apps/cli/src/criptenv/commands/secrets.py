"""Secret management commands."""

import click
import time
import uuid

from criptenv.context import cli_context, run_async, _resolve_env_id
from criptenv.crypto import derive_env_key, encrypt, decrypt
from criptenv.crypto.utils import generate_id
from criptenv.vault import queries
from criptenv.vault.models import Secret


@click.command()
@click.argument("key_value")
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
def set_command(key_value: str, env_name: str | None, project: str | None):
    """Set a secret (KEY=value).

    The value is encrypted client-side before storage.
    The server never sees the plaintext value.

    \b
    Examples:
        criptenv set API_KEY=secret123
        criptenv set DB_PASSWORD=s3cur3 -e staging
    """
    if "=" not in key_value:
        click.echo("Error: Must be KEY=value format", err=True)
        raise SystemExit(1)

    key_id, value = key_value.split("=", 1)

    with cli_context() as (db, master_key, _):
        if master_key is None:
            click.echo("Error: Run 'criptenv init' first", err=True)
            raise SystemExit(1)

        env_id = run_async(_resolve_env_id(db, env_name))
        env_key = derive_env_key(master_key, env_id)

        # Encrypt the value
        plaintext = value.encode("utf-8")
        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, env_key)

        # Check if secret already exists (upsert)
        existing = run_async(queries.get_secret(db, env_id, key_id))
        version = (existing.version + 1) if existing else 1

        secret = Secret(
            id=existing.id if existing else generate_id("sec"),
            environment_id=env_id,
            key_id=key_id,
            iv=iv,
            ciphertext=ciphertext,
            auth_tag=auth_tag,
            version=version,
            checksum=checksum,
            created_at=existing.created_at if existing else int(time.time()),
            updated_at=int(time.time()),
        )

        run_async(queries.save_secret(db, secret))

    click.echo(f"✓ Set {key_id}" + (f" (v{version})" if version > 1 else ""))


@click.command()
@click.argument("key")
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
@click.option("--clipboard", "-c", is_flag=True, help="Copy to clipboard")
def get_command(key: str, env_name: str | None, project: str | None, clipboard: bool):
    """Get a secret value.

    The value is decrypted client-side. Only the key name
    (not the value) is ever sent to the server.

    \b
    Examples:
        criptenv get API_KEY
        criptenv get DB_PASSWORD -e staging
    """
    with cli_context() as (db, master_key, _):
        if master_key is None:
            click.echo("Error: Run 'criptenv init' first", err=True)
            raise SystemExit(1)

        env_id = run_async(_resolve_env_id(db, env_name))
        env_key = derive_env_key(master_key, env_id)

        secret = run_async(queries.get_secret(db, env_id, key))
        if not secret:
            click.echo(f"Error: Secret '{key}' not found", err=True)
            raise SystemExit(1)

        # Decrypt
        plaintext = decrypt(
            secret.ciphertext, secret.iv, secret.auth_tag,
            env_key, secret.checksum
        )
        value = plaintext.decode("utf-8")

    if clipboard:
        try:
            import subprocess
            subprocess.run(["xclip", "-selection", "clipboard"],
                         input=value.encode(), check=True)
            click.echo(f"✓ {key} copied to clipboard")
        except (FileNotFoundError, subprocess.CalledProcessError):
            # Fallback: try pbcopy (macOS) or just print
            try:
                import subprocess
                subprocess.run(["pbcopy"], input=value.encode(), check=True)
                click.echo(f"✓ {key} copied to clipboard")
            except (FileNotFoundError, subprocess.CalledProcessError):
                click.echo(value)
                click.echo("(clipboard not available, printed instead)", err=True)
    else:
        click.echo(value)


@click.command("list")
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
def list_command(env_name: str | None, project: str | None):
    """List secret keys (values are never shown).

    \b
    Examples:
        criptenv list
        criptenv list -e staging
    """
    from criptenv.context import local_vault

    with local_vault() as db:
        env_id = run_async(_resolve_env_id(db, env_name))
        secrets = run_async(queries.list_secrets(db, env_id))
        env = run_async(queries.get_environment(db, env_id))
        env_display = env.name if env else env_id

    if not secrets:
        click.echo("No secrets found.")
        return

    click.echo(f"Secrets in '{env_display}':")
    click.echo("")
    for s in secrets:
        updated = time.strftime("%Y-%m-%d %H:%M", time.localtime(s.updated_at))
        click.echo(f"  {s.key_id:<30} v{s.version:<3} {updated}")

    click.echo("")
    click.echo(f"Total: {len(secrets)} secret(s)")


@click.command()
@click.argument("key")
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def delete_command(key: str, env_name: str | None, project: str | None, force: bool):
    """Delete a secret.

    \b
    Examples:
        criptenv delete API_KEY
        criptenv delete DB_PASSWORD -e staging --force
    """
    if not force:
        if not click.confirm(f"Delete secret '{key}'?"):
            click.echo("Cancelled.")
            return

    with cli_context() as (db, _, _):
        env_id = run_async(_resolve_env_id(db, env_name))
        deleted = run_async(queries.delete_secret_by_key(db, env_id, key))

    if deleted:
        click.echo(f"✓ Deleted {key}")
    else:
        click.echo(f"Error: Secret '{key}' not found", err=True)
        raise SystemExit(1)

"""Secret management commands."""

import click
import time
import uuid
import secrets as secret_module
import hashlib
import base64
from datetime import datetime, timezone, timedelta

from criptenv.context import cli_context, run_async, _resolve_env_id
from criptenv.crypto import derive_env_key, encrypt, decrypt
from criptenv.crypto.utils import generate_id
from criptenv.vault import queries
from criptenv.vault.models import Secret


# ─── Secret Management Commands ────────────────────────────────────────────────

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


# ─── Rotation Commands (M3.5) ──────────────────────────────────────────────────

def _generate_secret_value(length: int = 32) -> str:
    """Generate a random secret value for rotation."""
    return base64.urlsafe_b64encode(
        secret_module.token_bytes(length)
    ).decode('utf-8')


@click.command()
@click.argument("key")
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
@click.option("--value", "-v", "new_value", default=None, help="New value (auto-generated if omitted)")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def rotate_command(key: str, env_name: str | None, project: str | None, 
                   new_value: str | None, force: bool):
    """Rotate a secret — creates new version, marks old as rotated.
    
    \b
    Examples:
        criptenv rotate API_KEY
        criptenv rotate DB_PASSWORD -e staging
        criptenv rotate API_KEY --value "new-secret-value"
        criptenv rotate API_KEY --force
    """
    # Generate random value if not provided
    if new_value is None:
        new_value = _generate_secret_value()
        click.echo(f"✓ Auto-generated new value (length: {len(new_value)})")
    
    if not force:
        if not click.confirm(f"Rotate secret '{key}'?"):
            click.echo("Cancelled.")
            return
    
    with cli_context() as (db, master_key, session):
        if master_key is None:
            click.echo("Error: Run 'criptenv login' first", err=True)
            raise SystemExit(1)
        
        env_id = run_async(_resolve_env_id(db, env_name))
        env_key = derive_env_key(master_key, env_id)
        
        # Get current secret
        current_secret = run_async(queries.get_secret(db, env_id, key))
        if not current_secret:
            click.echo(f"Error: Secret '{key}' not found", err=True)
            raise SystemExit(1)
        
        old_version = current_secret.version
        
        # Encrypt new value
        plaintext = new_value.encode("utf-8")
        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, env_key)
        
        # Create new version
        secret = Secret(
            id=generate_id("sec"),
            environment_id=env_id,
            key_id=key,
            iv=iv,
            ciphertext=ciphertext,
            auth_tag=auth_tag,
            version=old_version + 1,
            checksum=checksum,
            created_at=int(time.time()),
            updated_at=int(time.time()),
        )
        
        run_async(queries.save_secret(db, secret))
    
    click.echo(f"✓ Rotated {key}: v{old_version} → v{old_version + 1}")


@click.command("expire")
@click.argument("key")
@click.option("--days", "-d", required=True, type=int, help="Days until expiration")
@click.option("--policy", type=click.Choice(["manual", "notify", "auto"]), 
              default="notify", help="Rotation policy")
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
def expire_command(key: str, days: int, policy: str, env_name: str | None, project: str | None):
    """Set expiration on a secret.
    
    \b
    Examples:
        criptenv secrets expire API_KEY --days 90
        criptenv secrets expire DB_PASSWORD --days 30 --policy auto
        criptenv secrets expire API_KEY --days 90 -e staging
    """
    from criptenv.context import async_cli_context
    import asyncio

    expires_at = datetime.now(timezone.utc) + timedelta(days=days)
    expires_at_iso = expires_at.isoformat()
    expires_at_str = expires_at.strftime("%Y-%m-%d")

    async def _do_expire():
        async with async_cli_context(require_auth=True) as (db, master_key, client):
            if master_key is None:
                raise click.ClickException("Run 'criptenv init' first")

            env_id = await _resolve_env_id(db, env_name)

            # Require project for API call
            if not project:
                raise click.ClickException("--project is required for cloud secret expiration")

            await client.set_expiration(
                project_id=project,
                env_id=env_id,
                key=key,
                expires_at=expires_at_iso,
                rotation_policy=policy,
                notify_days_before=7,
            )

            click.echo(f"✓ Set expiration for '{key}'")
            click.echo(f"  Expires: {expires_at_str} ({days} days)")
            click.echo(f"  Policy: {policy}")

    asyncio.run(_do_expire())


@click.command("alert")
@click.argument("key")
@click.option("--days", "-d", required=True, type=int, help="Days before expiration to alert")
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
def alert_command(key: str, days: int, env_name: str | None, project: str | None):
    """Configure alert timing for a secret.
    
    \b
    Examples:
        criptenv secrets alert API_KEY --days 30
        criptenv secrets alert DB_PASSWORD --days 14 -e staging
    """
    from criptenv.context import async_cli_context
    import asyncio

    async def _do_alert():
        async with async_cli_context(require_auth=True) as (db, master_key, client):
            if master_key is None:
                raise click.ClickException("Run 'criptenv init' first")

            env_id = await _resolve_env_id(db, env_name)

            if not project:
                raise click.ClickException("--project is required for cloud secret alerts")

            # Set a default 90-day expiration with the requested alert timing
            expires_at = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()

            await client.set_expiration(
                project_id=project,
                env_id=env_id,
                key=key,
                expires_at=expires_at,
                rotation_policy="notify",
                notify_days_before=days,
            )

            click.echo(f"✓ Set alert for '{key}' to {days} days before expiration")

    asyncio.run(_do_alert())


# ─── Secrets Group ─────────────────────────────────────────────────────────────

@click.group("secrets")
def secrets_group():
    """Secret management commands (extended).
    
    Includes expiration and alert management.
    """
    pass


secrets_group.add_command(expire_command)
secrets_group.add_command(alert_command)


# ─── Rotation Group ─────────────────────────────────────────────────────────────

@click.group("rotation")
def rotation_group():
    """Manage secret rotation."""
    pass


@rotation_group.command("list")
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", required=True, help="Project name or ID")
@click.option("--days", "-d", default=30, type=int, help="Days ahead to check")
def rotation_list_command(env_name: str | None, project: str | None, days: int):
    """List secrets pending rotation.
    
    \b
    Examples:
        criptenv rotation list
        criptenv rotation list --days 7
        criptenv rotation list -e staging
    """
    from criptenv.context import async_cli_context
    import asyncio

    async def _do_list():
        async with async_cli_context(require_auth=True) as (db, master_key, client):
            if master_key is None:
                raise click.ClickException("Run 'criptenv init' first")

            result = await client.list_expiring(project_id=project, days=days)
            items = result.get("items", [])

            click.echo(f"Secrets expiring within {days} days:")
            click.echo("")

            if not items:
                click.echo("  (No secrets expiring)")
            else:
                for item in items:
                    key = item.get("secret_key", "unknown")
                    expires = item.get("expires_at", "unknown")
                    policy = item.get("rotation_policy", "notify")
                    click.echo(f"  • {key}")
                    click.echo(f"    Expires: {expires}")
                    click.echo(f"    Policy: {policy}")
                    click.echo("")

            click.echo(f"Total: {len(items)} secret(s) expiring")

    asyncio.run(_do_list())

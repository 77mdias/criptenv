"""Secret management commands."""

import click
import secrets as secret_module
import base64
from datetime import datetime, timezone, timedelta

from criptenv.context import cli_context, run_async, resolve_project_id, resolve_project_id_async
from criptenv.remote_vault import RemoteVault


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

    try:
        with cli_context(require_auth=True) as (db, _master_key, client):
            resolved_project_id = resolve_project_id(db, project)
            vault = RemoteVault(client, resolved_project_id)
            state = run_async(vault.load_state(env_name))
            existing = next((blob for blob in state.blobs if blob["key_id"] == key_id), None)
            version = int(existing.get("version", state.version)) + 1 if existing else state.version + 1
            new_blob = run_async(vault.encrypt_blob(
                key_id,
                value.encode("utf-8"),
                state.environment.id,
                version,
            ))
            blobs = [blob for blob in state.blobs if blob["key_id"] != key_id]
            blobs.append(new_blob)
            run_async(vault.push_state(state, blobs))
    except click.ClickException:
        raise
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)

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
    try:
        with cli_context(require_auth=True) as (db, _master_key, client):
            resolved_project_id = resolve_project_id(db, project)
            vault = RemoteVault(client, resolved_project_id)
            state = run_async(vault.load_state(env_name))
            blob = next((item for item in state.blobs if item["key_id"] == key), None)
            if not blob:
                raise click.ClickException(f"Secret '{key}' not found")
            plaintext = run_async(vault.decrypt_blob(blob, state.environment.id))
            value = plaintext.decode("utf-8")
    except click.ClickException as e:
        click.echo(f"Error: {e.message}", err=True)
        raise SystemExit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)

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
    try:
        with cli_context(require_auth=True) as (db, _master_key, client):
            resolved_project_id = resolve_project_id(db, project)
            vault = RemoteVault(client, resolved_project_id)
            state = run_async(vault.load_state(env_name))
            env_display, secrets = state.environment.name, state.blobs
    except click.ClickException as e:
        click.echo(f"Error: {e.message}", err=True)
        raise SystemExit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)

    if not secrets:
        click.echo("No secrets found.")
        return

    click.echo(f"Secrets in '{env_display}':")
    click.echo("")
    for s in secrets:
        updated = str(s.get("updated_at", ""))[:16].replace("T", " ")
        click.echo(f"  {s.get('key_id', 'unknown'):<30} v{int(s.get('version', 1)):<3} {updated}")

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

    try:
        with cli_context(require_auth=True) as (db, _master_key, client):
            resolved_project_id = resolve_project_id(db, project)
            vault = RemoteVault(client, resolved_project_id)
            state = run_async(vault.load_state(env_name))
            blobs = [blob for blob in state.blobs if blob["key_id"] != key]
            if len(blobs) == len(state.blobs):
                raise click.ClickException(f"Secret '{key}' not found")
            run_async(vault.push_state(state, blobs))
    except click.ClickException as e:
        click.echo(f"Error: {e.message}", err=True)
        raise SystemExit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)

    click.echo(f"✓ Deleted {key}")


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
    
    try:
        with cli_context(require_auth=True) as (db, _master_key, client):
            resolved_project_id = resolve_project_id(db, project)
            vault = RemoteVault(client, resolved_project_id)
            state = run_async(vault.load_state(env_name))
            current_blob = next((blob for blob in state.blobs if blob["key_id"] == key), None)
            if not current_blob:
                raise click.ClickException(f"Secret '{key}' not found")
            old_version = int(current_blob.get("version", state.version))
            new_blob = run_async(vault.encrypt_blob(
                key,
                new_value.encode("utf-8"),
                state.environment.id,
                old_version + 1,
            ))
            blobs = [blob for blob in state.blobs if blob["key_id"] != key]
            blobs.append(new_blob)
            run_async(vault.push_state(state, blobs))
            version = old_version + 1
    except click.ClickException as e:
        click.echo(f"Error: {e.message}", err=True)
        raise SystemExit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)
    
    click.echo(f"✓ Rotated {key} (v{version})")


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
        async with async_cli_context(require_auth=True) as (db, _master_key, client):
            resolved_project_id = await resolve_project_id_async(db, project)
            env = await RemoteVault(client, resolved_project_id).resolve_environment(env_name)

            await client.set_expiration(
                project_id=resolved_project_id,
                env_id=env.id,
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
        async with async_cli_context(require_auth=True) as (db, _master_key, client):
            resolved_project_id = await resolve_project_id_async(db, project)
            env = await RemoteVault(client, resolved_project_id).resolve_environment(env_name)

            # Set a default 90-day expiration with the requested alert timing
            expires_at = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()

            await client.set_expiration(
                project_id=resolved_project_id,
                env_id=env.id,
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
@click.option("--project", "-p", "project_id", default=None, help="Project name or ID")
@click.option("--days", "-d", default=30, type=int, help="Days ahead to check")
def rotation_list_command(env_name: str | None, project_id: str | None, days: int):
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
        async with async_cli_context(require_auth=True) as (db, _master_key, client):
            resolved_project_id = await resolve_project_id_async(db, project_id)
            result = await client.list_expiring(project_id=resolved_project_id, days=days)
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


@rotation_group.command("history")
@click.argument("secret_key")
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", "project_id", default=None, help="Project name or ID")
def rotation_history_command(secret_key: str, env_name: str | None, project_id: str | None):
    """Show rotation history for a secret.

    \b
    Examples:
        criptenv rotation history <secret-key>
        criptenv rotation history <secret-key> -e staging
    """
    from criptenv.context import async_cli_context
    import asyncio

    async def _do_history():
        async with async_cli_context(require_auth=True) as (db, _master_key, client):
            resolved_project_id = await resolve_project_id_async(db, project_id)
            env = await RemoteVault(client, resolved_project_id).resolve_environment(env_name)

            result = await client.get_rotation_history(
                project_id=resolved_project_id,
                env_id=env.id,
                secret_key=secret_key,
            )
            items = result.get("items", [])

            if not items:
                click.echo(f"No rotation history for '{secret_key}'.")
                return

            click.echo(f"Rotation history for '{secret_key}':")
            click.echo("")
            for item in items:
                rotated_at = item.get("rotated_at", "unknown")
                reason = item.get("reason", "manual")
                rotated_by = item.get("rotated_by", "unknown")
                click.echo(f"  • {rotated_at}")
                click.echo(f"    By: {rotated_by}")
                click.echo(f"    Reason: {reason}")
                click.echo("")

            click.echo(f"Total: {len(items)} rotation(s)")

    asyncio.run(_do_history())

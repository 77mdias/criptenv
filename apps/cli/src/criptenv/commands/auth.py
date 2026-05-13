"""Authentication and account management commands."""

import click
import getpass
import webbrowser

from criptenv.context import cli_context, run_async


@click.group("auth")
def auth_group():
    """Authentication and account management."""
    pass


@auth_group.command("forgot-password")
@click.argument("email")
def forgot_password(email: str):
    """Request a password reset email."""
    with cli_context(require_auth=False) as (_db, _mk, client):
        try:
            result = run_async(client.forgot_password(email))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(result.get("message", "If an account exists, a reset link has been sent."))


@auth_group.command("reset-password")
@click.option("--token", required=True, help="Reset token from email")
@click.option("--password", required=True, help="New password")
def reset_password(token: str, password: str):
    """Reset password using a token."""
    if len(password) < 8:
        click.echo("Error: Password must be at least 8 characters", err=True)
        raise SystemExit(1)

    with cli_context(require_auth=False) as (_db, _mk, client):
        try:
            result = run_async(client.reset_password(token, password))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(result.get("message", "Password reset successfully."))


@auth_group.command("change-password")
def change_password():
    """Change your current password."""
    current = getpass.getpass("Current password: ")
    new = getpass.getpass("New password: ")
    if len(new) < 8:
        click.echo("Error: New password must be at least 8 characters", err=True)
        raise SystemExit(1)

    confirm = getpass.getpass("Confirm new password: ")
    if new != confirm:
        click.echo("Error: Passwords do not match", err=True)
        raise SystemExit(1)

    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            result = run_async(client.change_password(current, new))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(result.get("message", "Password changed successfully."))


@click.group("profile")
def profile_group():
    """Profile management."""
    pass


@profile_group.command("update")
@click.option("--name", "-n", default=None, help="New name")
@click.option("--email", "-e", default=None, help="New email")
def profile_update(name: str | None, email: str | None):
    """Update your profile information."""
    if not name and not email:
        click.echo("Error: Provide at least one of --name or --email", err=True)
        raise SystemExit(1)

    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            result = run_async(client.update_profile(name=name, email=email))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Updated profile: {result.get('name', 'unknown')} ({result.get('email', 'unknown')})")


@profile_group.command("delete")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def profile_delete(force: bool):
    """Permanently delete your account."""
    if not force:
        if not click.confirm("Delete your account permanently? This cannot be undone."):
            click.echo("Aborted.")
            return

    with cli_context(require_auth=True) as (db, _mk, client):
        try:
            result = run_async(client.delete_account())
            # Clear local session data
            from criptenv.vault.queries import delete_all_sessions
            import asyncio
            asyncio.get_event_loop().run_until_complete(delete_all_sessions(db))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(result.get("message", "Account deleted successfully."))


@click.group("2fa")
def two_fa_group():
    """Two-factor authentication management."""
    pass


@two_fa_group.command("setup")
def two_fa_setup():
    """Set up two-factor authentication."""
    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            result = run_async(client.setup_2fa())
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    secret_uri = result.get("secret_uri", "")
    backup_codes = result.get("backup_codes", [])

    click.echo("\n🔐 Two-Factor Authentication Setup")
    click.echo("=" * 50)
    click.echo("\n1. Scan the QR code or enter the secret URI in your authenticator app:")
    click.echo(f"   {secret_uri}")
    click.echo("\n2. Backup codes (save these in a secure location):")
    for code in backup_codes:
        click.echo(f"   {code}")
    click.echo("\n3. Run 'criptenv 2fa verify --code <CODE>' to enable 2FA.")


@two_fa_group.command("verify")
@click.option("--code", required=True, help="6-digit TOTP code from authenticator")
def two_fa_verify(code: str):
    """Verify and enable 2FA."""
    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            result = run_async(client.verify_2fa(code))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(result.get("message", "2FA enabled successfully."))


@two_fa_group.command("disable")
def two_fa_disable():
    """Disable two-factor authentication."""
    password = getpass.getpass("Password: ")

    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            result = run_async(client.disable_2fa(password))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(result.get("message", "2FA disabled successfully."))

"""Authentication commands."""

import click
import getpass

from criptenv.context import local_vault, run_async
from criptenv.crypto.keys import derive_master_key
from criptenv.vault import queries
from criptenv.session import SessionManager


@click.command()
@click.option("--email", prompt="Email", help="Account email")
@click.option("--password", prompt=True, hide_input=True, help="Account password")
def login_command(email: str, password: str):
    """Login to CriptEnv and store session locally.

    The session token is encrypted with your master password
    before being stored in the local vault.

    \b
    Examples:
        criptenv login --email user@example.com
        criptenv login  # will prompt for email and password
    """
    with local_vault() as db:
        # Check if initialized
        salt_hex = run_async(queries.get_config(db, "master_salt"))
        if not salt_hex:
            click.echo("Error: Run 'criptenv init' first", err=True)
            raise SystemExit(1)

        # Get master password to encrypt the session token
        master_password = getpass.getpass("Master password: ")
        master_key = derive_master_key(master_password, bytes.fromhex(salt_hex))

        # Login via API
        manager = SessionManager(master_key, db)

        try:
            user = run_async(manager.login(email, password))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Logged in as {user.get('email', email)}")
    click.echo(f"  User ID: {user.get('id', 'unknown')}")


@click.command()
def logout_command():
    """Logout and clear local session.

    \b
    Examples:
        criptenv logout
    """
    with local_vault() as db:
        salt_hex = run_async(queries.get_config(db, "master_salt"))
        if not salt_hex:
            click.echo("Error: Run 'criptenv init' first", err=True)
            raise SystemExit(1)

        master_password = getpass.getpass("Master password: ")
        master_key = derive_master_key(master_password, bytes.fromhex(salt_hex))

        manager = SessionManager(master_key, db)

        try:
            run_async(manager.logout())
        except Exception as e:
            click.echo(f"Warning: {e}", err=True)

    click.echo("✓ Logged out successfully")

"""Initialize CriptEnv configuration."""

import click

from criptenv.config import ensure_config_dir
from criptenv.context import local_vault, run_async
from criptenv.crypto.keys import generate_salt
from criptenv.vault import queries


@click.command()
@click.option("--force", is_flag=True, help="Overwrite existing configuration")
def init_command(force: bool):
    """Initialize CriptEnv in the current directory.

    Creates ~/.criptenv/ directory, initializes the local vault,
    and sets up your master password for encryption.

    \b
    WARNING: Your master password cannot be recovered if forgotten.
    All secrets encrypted with it will be permanently lost.
    """
    config_dir = ensure_config_dir()

    with local_vault() as db:
        # Check if already initialized
        existing_salt = run_async(queries.get_config(db, "master_salt"))
        if existing_salt and not force:
            click.echo("CriptEnv is already initialized.")
            click.echo("Use --force to reinitialize (this will NOT delete existing secrets).")
            return

        click.echo(f"Initializing CriptEnv at {config_dir}")
        click.echo("")
        click.echo("⚠ IMPORTANT: Your master password encrypts all secrets.")
        click.echo("  If you forget it, your secrets CANNOT be recovered.")
        click.echo("")

        # Prompt for master password
        import getpass
        password = getpass.getpass("Set master password: ")
        if len(password) < 8:
            click.echo("Error: Password must be at least 8 characters", err=True)
            raise SystemExit(1)

        confirm = getpass.getpass("Confirm master password: ")
        if password != confirm:
            click.echo("Error: Passwords do not match", err=True)
            raise SystemExit(1)

        # Generate and store salt
        salt = generate_salt()
        run_async(queries.set_config(db, "master_salt", salt.hex()))

        # Create default environment
        import uuid
        import time
        from criptenv.vault.models import Environment

        default_env = Environment(
            id=str(uuid.uuid4()),
            project_id="local",
            name="default",
            env_key_encrypted=b"",  # Will be set on first secret
            created_at=int(time.time()),
            updated_at=int(time.time()),
        )
        run_async(queries.save_environment(db, default_env))

    click.echo("")
    click.echo("✓ CriptEnv initialized successfully!")
    click.echo("")
    click.echo("Next steps:")
    click.echo("  1. Run 'criptenv login' to authenticate with the server")
    click.echo("  2. Run 'criptenv set API_KEY=secret123' to store your first secret")
    click.echo("  3. Run 'criptenv list' to see your secrets")

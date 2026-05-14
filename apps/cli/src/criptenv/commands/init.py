"""Initialize CriptEnv configuration."""

import click

from criptenv.config import ensure_config_dir
from criptenv.context import local_vault


@click.command()
@click.option("--force", is_flag=True, help="Overwrite existing configuration")
def init_command(force: bool):
    """Initialize CriptEnv in the current directory.

    Creates ~/.criptenv/ and prepares local metadata storage.
    Secrets live in the remote project vault and are encrypted client-side
    with the project vault password.
    """
    config_dir = ensure_config_dir()

    with local_vault() as db:
        # Opening the metadata database initializes auth/session tables.
        # No local secret vault or master password is created.
        _ = db

    click.echo("")
    click.echo(f"✓ CriptEnv configuration ready at {config_dir}")
    click.echo("")
    click.echo("Next steps:")
    click.echo("  1. Run 'criptenv login' to authenticate with the server")
    click.echo("  2. Run 'criptenv projects create my-project' or 'criptenv use <project-id>'")
    click.echo("  3. Run 'criptenv set API_KEY=secret123 -p <project-id>'")

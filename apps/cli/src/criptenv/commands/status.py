"""Status command — show CLI configuration and session state."""

import click

from criptenv.config import API_BASE_URL, CONFIG_DIR
from criptenv.context import cli_context, run_async
from criptenv.vault import queries


@click.command()
def status_command():
    """Show current CLI status and configuration.

    Displays login status, current project, API URL, and local config.

    \b
    Examples:
        criptenv status
    """
    click.echo(click.style("CriptEnv CLI Status", fg="cyan", bold=True))
    click.echo("")

    # Config directory
    click.echo(f"Config directory: {CONFIG_DIR}")
    click.echo(f"API URL:          {API_BASE_URL}")
    click.echo("")

    with cli_context(require_auth=True) as (db, _mk, client):
        # User info
        try:
            user = run_async(client.get_session())
            email = user.get("email", "unknown")
            name = user.get("name", email)
            click.echo(click.style("✓ Logged in", fg="green"))
            click.echo(f"  User:  {name}")
            click.echo(f"  Email: {email}")
        except Exception as e:
            click.echo(click.style("✗ Not logged in", fg="red"))
            click.echo(f"  Error: {e}")

        click.echo("")

        # Current project
        current_project = run_async(queries.get_config(db, "current_project_id"))
        if current_project:
            try:
                project = run_async(client.get_project(current_project))
                pname = project.get("name", "unknown")
                click.echo(click.style("✓ Project selected", fg="green"))
                click.echo(f"  Name: {pname}")
                click.echo(f"  ID:   {current_project}")
            except Exception:
                click.echo(click.style("⚠ Project selected (unavailable)", fg="yellow"))
                click.echo(f"  ID:   {current_project}")
        else:
            click.echo(click.style("✗ No project selected", fg="red"))
            click.echo("  Run 'criptenv use <project-id>' to set one")

    click.echo("")

    # Environment overrides
    import os
    env_project = os.getenv("CRIPTENV_PROJECT")
    if env_project:
        click.echo(click.style("Note: CRIPTENV_PROJECT is set", fg="yellow"))
        click.echo(f"  Value: {env_project}")
        click.echo("  This overrides the saved current project for all commands.")

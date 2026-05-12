"""Project context commands."""

import click

from criptenv.context import cli_context, run_async
from criptenv.vault import queries


@click.command()
@click.argument("project_id", required=False)
@click.option("--clear", is_flag=True, help="Clear the current project setting")
def use_command(project_id: str | None, clear: bool):
    """Set or show the current project context.

    When called with a project ID, sets it as the default project
    for all subsequent commands. When called without arguments,
    shows the currently selected project.

    \b
    Examples:
        criptenv use prj_abc123           # Set default project
        criptenv use                      # Show current project
        criptenv use --clear              # Clear default project
    """
    with cli_context(require_auth=True) as (db, _mk, client):
        if clear:
            run_async(queries.set_config(db, "current_project_id", ""))
            click.echo("✓ Cleared current project")
            return

        if project_id is None:
            # Show current project
            current = run_async(queries.get_config(db, "current_project_id"))
            if current:
                # Try to fetch project name for nicer output
                try:
                    project = run_async(client.get_project(current))
                    name = project.get("name", "unknown")
                    click.echo(f"Current project: {name} ({current})")
                except Exception:
                    click.echo(f"Current project: {current}")
            else:
                click.echo("No project selected.")
                click.echo("Set one with: criptenv use <project-id>")
            return

        # Validate project exists
        try:
            project = run_async(client.get_project(project_id))
        except Exception as e:
            click.echo(f"Error: Project not found or not accessible: {e}", err=True)
            raise SystemExit(1)

        # Save to config
        run_async(queries.set_config(db, "current_project_id", project_id))
        click.echo(f"✓ Set current project to {project.get('name', project_id)} ({project_id})")

"""Project management commands."""

import click

from criptenv.context import cli_context, run_async


@click.group("projects")
def projects_group():
    """Manage projects."""
    pass


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

"""Environment management commands."""

import click

from criptenv.context import cli_context, run_async


@click.group("env")
def env_group():
    """Manage environments (dev, staging, production, etc.)."""
    pass


@env_group.command("list")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def env_list(project_id: str | None):
    """List environments for a project.

    \b
    Examples:
        criptenv env list
        criptenv env list -p <project-id>
    """
    if not project_id:
        click.echo("Error: --project is required. Use 'criptenv projects list' to find project IDs.", err=True)
        raise SystemExit(1)

    with cli_context(require_auth=True) as (db, master_key, client):
        try:
            result = run_async(client.list_environments(project_id))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    environments = result.get("environments", [])
    if not environments:
        click.echo("No environments found.")
        return

    click.echo(f"{'NAME':<20} {'ID':<38} {'DEFAULT':<10}")
    click.echo("─" * 68)
    for env in environments:
        is_default = "✓" if env.get("is_default") else ""
        click.echo(f"{env['name']:<20} {env['id']:<38} {is_default:<10}")

    click.echo("")
    click.echo(f"Total: {len(environments)} environment(s)")


@env_group.command("create")
@click.argument("name")
@click.option("--project", "-p", "project_id", required=True, help="Project ID")
@click.option("--display-name", "-d", default=None, help="Human-readable display name")
def env_create(name: str, project_id: str, display_name: str | None):
    """Create a new environment.

    \b
    Examples:
        criptenv env create staging -p <project-id>
        criptenv env create production -p <project-id> -d "Production Environment"
    """
    with cli_context(require_auth=True) as (db, master_key, client):
        try:
            result = run_async(client.create_environment(project_id, name, display_name))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Created environment '{result.get('name', name)}'")
    click.echo(f"  ID: {result.get('id', 'unknown')}")

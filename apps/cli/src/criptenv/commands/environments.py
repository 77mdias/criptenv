"""Environment management commands."""

import click

from criptenv.context import cli_context, run_async, resolve_project_id


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
    with cli_context(require_auth=True) as (db, master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id)
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
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--display-name", "-d", default=None, help="Human-readable display name")
def env_create(name: str, project_id: str | None, display_name: str | None):
    """Create a new environment.

    \b
    Examples:
        criptenv env create staging -p <project-id>
        criptenv env create production -p <project-id> -d "Production Environment"
    """
    with cli_context(require_auth=True) as (db, master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id)
            result = run_async(client.create_environment(project_id, name, display_name))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Created environment '{result.get('name', name)}'")
    click.echo(f"  ID: {result.get('id', 'unknown')}")


@env_group.command("update")
@click.argument("env_id")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--name", "-n", default=None, help="New environment name")
@click.option("--display-name", "-d", default=None, help="New display name")
def env_update(env_id: str, project_id: str | None, name: str | None, display_name: str | None):
    """Update an environment.

    \b
    Examples:
        criptenv env update <env-id> -p <project-id> --name "new-name"
        criptenv env update <env-id> -p <project-id> -d "New Display Name"
    """
    if not name and not display_name:
        click.echo("Error: Provide at least one of --name or --display-name", err=True)
        raise SystemExit(1)

    with cli_context(require_auth=True) as (db, master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id)
            result = run_async(client.update_environment(project_id, env_id, name=name, display_name=display_name))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Updated environment '{result.get('name', env_id)}'")


@env_group.command("delete")
@click.argument("env_id")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def env_delete(env_id: str, project_id: str | None, force: bool):
    """Delete an environment.

    \b
    Examples:
        criptenv env delete <env-id> -p <project-id>
        criptenv env delete <env-id> -p <project-id> --force
    """
    if not force:
        if not click.confirm(f"Delete environment {env_id}?"):
            click.echo("Aborted.")
            return

    with cli_context(require_auth=True) as (db, master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id)
            run_async(client.delete_environment(resolved_project_id, env_id))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Deleted environment {env_id}")

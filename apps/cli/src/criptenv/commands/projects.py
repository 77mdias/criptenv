"""Project management commands."""

import click
import getpass

from criptenv.context import cli_context, run_async
from criptenv.crypto import build_project_vault_config


@click.group("projects")
def projects_group():
    """Manage projects."""
    pass


@projects_group.command("create")
@click.argument("name")
@click.option("--slug", default=None, help="Optional project slug")
@click.option("--description", default=None, help="Optional project description")
def projects_create(name: str, slug: str | None, description: str | None):
    """Create a project with a project-specific vault password."""
    password = getpass.getpass("Vault password: ")
    if len(password) < 8:
        click.echo("Error: Vault password must be at least 8 characters", err=True)
        raise SystemExit(1)

    confirm = getpass.getpass("Confirm vault password: ")
    if password != confirm:
        click.echo("Error: Vault passwords do not match", err=True)
        raise SystemExit(1)

    vault_config, vault_proof = build_project_vault_config(password)

    with cli_context(require_auth=True) as (_db, _master_key, client):
        try:
            project = run_async(
                client.create_project(
                    name=name,
                    slug=slug,
                    description=description,
                    vault_config=vault_config,
                    vault_proof=vault_proof,
                )
            )
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Created project {project['name']} ({project['id']})")


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


@projects_group.command("info")
@click.argument("project_id")
def projects_info(project_id: str):
    """Show detailed information about a project.

    \b
    Examples:
        criptenv projects info <project-id>
    """
    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            project = run_async(client.get_project(project_id))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"Name:        {project.get('name', 'unknown')}")
    click.echo(f"ID:          {project.get('id', 'unknown')}")
    click.echo(f"Slug:        {project.get('slug', 'N/A')}")
    click.echo(f"Description: {project.get('description', 'N/A')}")
    click.echo(f"Owner ID:    {project.get('owner_id', 'unknown')}")
    click.echo(f"Created:     {project.get('created_at', 'unknown')}")
    click.echo(f"Updated:     {project.get('updated_at', 'unknown')}")


@projects_group.command("update")
@click.argument("project_id")
@click.option("--name", "-n", default=None, help="New project name")
@click.option("--description", "-d", default=None, help="New description")
def projects_update(project_id: str, name: str | None, description: str | None):
    """Update a project's name or description.

    \b
    Examples:
        criptenv projects update <project-id> --name "New Name"
        criptenv projects update <project-id> -d "Updated description"
    """
    if not name and not description:
        click.echo("Error: Provide at least one of --name or --description", err=True)
        raise SystemExit(1)

    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            project = run_async(client.update_project(project_id, name=name, description=description))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Updated project {project.get('name', project_id)}")


@projects_group.command("delete")
@click.argument("project_id")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def projects_delete(project_id: str, force: bool):
    """Delete a project permanently.

    \b
    Examples:
        criptenv projects delete <project-id>
        criptenv projects delete <project-id> --force
    """
    if not force:
        if not click.confirm(f"Delete project {project_id}? This cannot be undone."):
            click.echo("Aborted.")
            return

    with cli_context(require_auth=True) as (_db, _mk, client):
        try:
            run_async(client.delete_project(project_id))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Deleted project {project_id}")

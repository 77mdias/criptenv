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

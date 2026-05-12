"""Team member management commands."""

import asyncio
from typing import Optional

import click

from criptenv.context import cli_context, resolve_project_id


@click.group("members")
def members_group():
    """Manage project team members."""
    pass


@members_group.command("list")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def members_list(project_id: str | None):
    """List members of a project.

    \b
    Examples:
        criptenv members list -p <project-id>
    """
    async def _do_list():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.list_members(resolved_project_id)
            items = result.get("members", [])

            if not items:
                click.echo("No members found.")
                return

            click.echo(f"{'NAME/EMAIL':<35} {'ROLE':<15} {'ID':<38}")
            click.echo("─" * 88)
            for m in items:
                # API may return user info nested or just IDs
                name = m.get("name") or m.get("email") or m.get("user_id", "unknown")
                role = m.get("role", "unknown")
                mid = m.get("id", "unknown")
                click.echo(f"{name:<35} {role:<15} {mid:<38}")

            click.echo("")
            click.echo(f"Total: {len(items)} member(s)")

    asyncio.run(_do_list())


@members_group.command("add")
@click.argument("user_id")
@click.option("--role", "-r", type=click.Choice(["admin", "developer", "viewer"]),
              default="developer", help="Member role")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def members_add(user_id: str, role: str, project_id: str | None):
    """Add a user to a project.

    \b
    Examples:
        criptenv members add <user-id> --role admin -p <project-id>
    """
    async def _do_add():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.add_member(resolved_project_id, user_id, role)
            click.echo(f"✓ Added member ({result.get('id', 'unknown')})")
            click.echo(f"  User: {user_id}")
            click.echo(f"  Role: {role}")

    asyncio.run(_do_add())


@members_group.command("update")
@click.argument("member_id")
@click.option("--role", "-r", required=True,
              type=click.Choice(["admin", "developer", "viewer"]),
              help="New role")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def members_update(member_id: str, role: str, project_id: str | None):
    """Update a member's role.

    \b
    Examples:
        criptenv members update <member-id> --role viewer -p <project-id>
    """
    async def _do_update():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.update_member(resolved_project_id, member_id, role)
            click.echo(f"✓ Updated member ({result.get('id', 'unknown')})")
            click.echo(f"  New role: {role}")

    asyncio.run(_do_update())


@members_group.command("remove")
@click.argument("member_id")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def members_remove(member_id: str, project_id: str | None, force: bool):
    """Remove a member from a project.

    \b
    Examples:
        criptenv members remove <member-id> -p <project-id>
    """
    if not force:
        if not click.confirm(f"Remove member {member_id} from project?"):
            click.echo("Aborted.")
            return

    async def _do_remove():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            await client.remove_member(resolved_project_id, member_id)
            click.echo(f"✓ Removed member {member_id}")

    asyncio.run(_do_remove())

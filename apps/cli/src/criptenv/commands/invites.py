"""Project invite management commands."""

import asyncio

import click

from criptenv.context import cli_context, resolve_project_id


@click.group("invites")
def invites_group():
    """Manage project invites."""
    pass


@invites_group.command("list")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def invites_list(project_id: str | None):
    """List pending invites for a project.

    \b
    Examples:
        criptenv invites list -p <project-id>
    """
    async def _do_list():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.list_invites(resolved_project_id)
            items = result.get("invites", [])

            if not items:
                click.echo("No invites found.")
                return

            click.echo(f"{'EMAIL':<35} {'ROLE':<15} {'STATUS':<12} {'ID':<38}")
            click.echo("─" * 100)
            for inv in items:
                email = inv.get("email", "unknown")
                role = inv.get("role", "unknown")
                status = "accepted" if inv.get("accepted_at") else "revoked" if inv.get("revoked_at") else "pending"
                iid = inv.get("id", "unknown")
                click.echo(f"{email:<35} {role:<15} {status:<12} {iid:<38}")

            click.echo("")
            click.echo(f"Total: {len(items)} invite(s)")

    asyncio.run(_do_list())


@invites_group.command("create")
@click.argument("email")
@click.option("--role", "-r", type=click.Choice(["admin", "developer", "viewer"]),
              default="developer", help="Role for the invited user")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def invites_create(email: str, role: str, project_id: str | None):
    """Invite a user to a project by email.

    \b
    Examples:
        criptenv invites create user@example.com --role developer -p <project-id>
    """
    async def _do_create():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.create_invite(resolved_project_id, email, role)
            click.echo(f"✓ Invite sent to {email}")
            click.echo(f"  Role: {role}")
            click.echo(f"  Invite ID: {result.get('id', 'unknown')}")
            click.echo(f"  Expires: {result.get('expires_at', 'unknown')}")

    asyncio.run(_do_create())


@invites_group.command("accept")
@click.argument("invite_id")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def invites_accept(invite_id: str, project_id: str | None):
    """Accept a project invite.

    \b
    Examples:
        criptenv invites accept <invite-id> -p <project-id>
    """
    async def _do_accept():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.accept_invite(resolved_project_id, invite_id)
            click.echo(f"✓ Accepted invite {invite_id}")
            click.echo(f"  Project: {result.get('project_name', 'unknown')}")
            click.echo(f"  Role: {result.get('role', 'unknown')}")

    asyncio.run(_do_accept())


@invites_group.command("revoke")
@click.argument("invite_id")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def invites_revoke(invite_id: str, project_id: str | None, force: bool):
    """Revoke a pending invite.

    \b
    Examples:
        criptenv invites revoke <invite-id> -p <project-id>
    """
    if not force:
        if not click.confirm(f"Revoke invite {invite_id}?"):
            click.echo("Aborted.")
            return

    async def _do_revoke():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.revoke_invite(resolved_project_id, invite_id)
            click.echo(f"✓ Revoked invite {invite_id}")
            if result.get("email"):
                click.echo(f"  Email: {result['email']}")

    asyncio.run(_do_revoke())

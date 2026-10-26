"""Session management commands."""

import asyncio

import click

from criptenv.context import async_cli_context


@click.command("sessions")
def sessions_command():
    """List active sessions for the current user.

    \b
    Examples:
        criptenv sessions
    """
    async def _do_list():
        async with async_cli_context(require_auth=True) as (_db, _mk, client):
            try:
                items = await client.get_sessions()

                if not items:
                    click.echo("No active sessions found.")
                    return

                click.echo(f"{'DEVICE':<30} {'IP ADDRESS':<18} {'CREATED AT':<25} {'CURRENT':<10}")
                click.echo("─" * 90)
                for session in items:
                    device = (session.get("user_agent") or "unknown")[:29]
                    ip = session.get("ip_address") or "unknown"
                    created = session.get("created_at", "unknown")
                    current = "✓" if session.get("current") else ""
                    click.echo(f"{device:<30} {ip:<18} {created:<25} {current:<10}")

                click.echo("")
                click.echo(f"Total: {len(items)} session(s)")

            except Exception as e:
                raise click.ClickException(str(e))

    asyncio.run(_do_list())

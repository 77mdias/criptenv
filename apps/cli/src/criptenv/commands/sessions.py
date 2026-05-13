"""Session management commands."""

import asyncio

import click

from criptenv.context import cli_context


@click.command("sessions")
def sessions_command():
    """List active sessions for the current user.

    \b
    Examples:
        criptenv sessions
    """
    async def _do_list():
        with cli_context(require_auth=True) as (_db, _mk, client):
            try:
                result = await client.get_sessions()
                items = result.get("sessions", [])

                if not items:
                    click.echo("No active sessions found.")
                    return

                click.echo(f"{'DEVICE':<30} {'IP ADDRESS':<18} {'CREATED AT':<25} {'CURRENT':<10}")
                click.echo("─" * 90)
                for session in items:
                    device = session.get("device_info", "unknown")
                    ip = session.get("ip_address", "unknown")
                    created = session.get("created_at", "unknown")
                    current = "✓" if session.get("is_current") else ""
                    click.echo(f"{device:<30} {ip:<18} {created:<25} {current:<10}")

                click.echo("")
                click.echo(f"Total: {len(items)} session(s)")

            except Exception as e:
                click.echo(f"Error: {e}", err=True)

    asyncio.run(_do_list())

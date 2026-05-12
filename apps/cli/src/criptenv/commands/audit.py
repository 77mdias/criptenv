"""Audit log commands."""

import asyncio

import click

from criptenv.context import cli_context, resolve_project_id


@click.group("audit")
def audit_group():
    """View and export project audit logs."""
    pass


@audit_group.command("list")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--action", "-a", default=None, help="Filter by action (e.g., secret.created)")
@click.option("--resource", "-r", default=None, help="Filter by resource type (e.g., secret)")
@click.option("--limit", "-l", default=50, type=int, help="Number of entries to show (max 100)")
@click.option("--page", default=1, type=int, help="Page number")
def audit_list(project_id: str | None, action: str | None, resource: str | None, limit: int, page: int):
    """List audit logs for a project.

    \b
    Examples:
        criptenv audit list -p <project-id>
        criptenv audit list -p <project-id> --action secret.created --limit 20
    """
    async def _do_list():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.list_audit(resolved_project_id,
                action=action,
                resource_type=resource,
                page=page,
                per_page=min(limit, 100),
            )
            logs = result.get("logs", [])
            total = result.get("total", 0)
            page_num = result.get("page", 1)
            per_page = result.get("per_page", 50)

            if not logs:
                click.echo("No audit logs found.")
                return

            click.echo(f"{'ACTION':<35} {'RESOURCE':<15} {'TIME':<22} {'USER':<30}")
            click.echo("─" * 102)
            for log in logs:
                action_name = log.get("action", "unknown")[:34]
                resource_type = log.get("resource_type", "unknown")[:14]
                created = log.get("created_at", "unknown")[:21]
                user = log.get("user_id", "system")[:29]
                click.echo(f"{action_name:<35} {resource_type:<15} {created:<22} {user:<30}")

            click.echo("")
            click.echo(f"Total: {total} log(s)  |  Page {page_num}  |  Showing {len(logs)} entries")

    asyncio.run(_do_list())


@audit_group.command("export")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--format", "-f", type=click.Choice(["json", "csv"]), default="json", help="Export format")
@click.option("--output", "-o", default=None, help="Output file (default: stdout)")
def audit_export(project_id: str | None, format: str, output: str | None):
    """Export audit logs to a file.

    \b
    Examples:
        criptenv audit export -p <project-id> > audit.json
        criptenv audit export -p <project-id> --format json --output audit.json
    """
    import json
    import csv
    import sys

    async def _do_export():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.list_audit(resolved_project_id, page=1, per_page=100)
            logs = result.get("logs", [])

            if not logs:
                click.echo("No audit logs to export.")
                return

            if format == "json":
                data = json.dumps(logs, indent=2, default=str)
            else:
                # CSV
                import io
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow(["action", "resource_type", "resource_id", "user_id", "created_at"])
                for log in logs:
                    writer.writerow([
                        log.get("action", ""),
                        log.get("resource_type", ""),
                        log.get("resource_id", ""),
                        log.get("user_id", ""),
                        log.get("created_at", ""),
                    ])
                data = buf.getvalue()

            if output:
                with open(output, "w") as f:
                    f.write(data)
                click.echo(f"✓ Exported {len(logs)} log(s) to {output}")
            else:
                click.echo(data)

    asyncio.run(_do_export())

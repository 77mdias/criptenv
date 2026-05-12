"""API key management commands."""

import asyncio

import click

from criptenv.context import cli_context, resolve_project_id

VALID_SCOPES = [
    "read:secrets",
    "write:secrets",
    "delete:secrets",
    "read:audit",
    "write:integrations",
    "admin:project",
]


@click.group("api-keys")
def api_keys_group():
    """Manage API keys for programmatic access."""
    pass


@api_keys_group.command("list")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def api_keys_list(project_id: str | None):
    """List API keys for a project.

    \b
    Examples:
        criptenv api-keys list -p <project-id>
    """
    async def _do_list():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.list_api_keys(resolved_project_id)
            items = result.get("items", [])

            if not items:
                click.echo("No API keys found.")
                return

            click.echo(f"{'NAME':<25} {'PREFIX':<15} {'SCOPES':<35} {'ID':<38}")
            click.echo("─" * 113)
            for key in items:
                name = key.get("name", "Unnamed")[:24]
                prefix = key.get("prefix", "unknown")[:14]
                scopes = ", ".join(key.get("scopes", []))[:34]
                kid = key.get("id", "unknown")[:37]
                click.echo(f"{name:<25} {prefix:<15} {scopes:<35} {kid:<38}")

            click.echo("")
            click.echo(f"Total: {len(items)} key(s)")

    asyncio.run(_do_list())


@api_keys_group.command("create")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--name", "-n", required=True, help="Key name")
@click.option("--scope", "-s", multiple=True, default=["read:secrets"],
              type=click.Choice(VALID_SCOPES), help="Scopes (can be used multiple times)")
@click.option("--env", default=None, help="Environment scope restriction")
@click.option("--expires-days", type=int, default=None, help="Expiration in days (1-365)")
def api_keys_create(project_id: str | None, name: str, scope: tuple[str, ...], env: str | None, expires_days: int | None):
    """Create a new API key.

    The plaintext key is shown ONLY once — copy it immediately.

    \b
    Examples:
        criptenv api-keys create -p <project-id> -n "CI Key"
        criptenv api-keys create -p <project-id> -n "Deploy Key" -s read:secrets -s write:secrets --expires-days 90
    """
    async def _do_create():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.create_api_key(
                project_id=resolved_project_id,
                name=name,
                scopes=list(scope),
                environment_scope=env,
                expires_in_days=expires_days,
            )
            click.echo(click.style("✓ API key created", fg="green", bold=True))
            click.echo(f"  Name: {result.get('name', name)}")
            click.echo(f"  ID: {result.get('id', 'unknown')}")
            click.echo("")
            click.echo(click.style("  IMPORTANT: Copy this key now — it will never be shown again:", fg="yellow", bold=True))
            click.echo(click.style(f"  {result.get('key', 'unknown')}", fg="cyan"))
            click.echo("")
            if result.get("expires_at"):
                click.echo(f"  Expires: {result['expires_at']}")

    asyncio.run(_do_create())


@api_keys_group.command("revoke")
@click.argument("key_id")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def api_keys_revoke(key_id: str, project_id: str | None, force: bool):
    """Revoke an API key.

    \b
    Examples:
        criptenv api-keys revoke <key-id> -p <project-id>
    """
    if not force:
        if not click.confirm(f"Revoke API key {key_id}?"):
            click.echo("Aborted.")
            return

    async def _do_revoke():
        with cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = resolve_project_id(db, project_id)
            result = await client.revoke_api_key(resolved_project_id, key_id)
            click.echo(f"✓ Revoked API key {key_id}")
            if result.get("name"):
                click.echo(f"  Name: {result['name']}")

    asyncio.run(_do_revoke())

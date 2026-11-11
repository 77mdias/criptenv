"""API key management commands."""

import asyncio

import click

from criptenv.context import async_cli_context, resolve_project_id_async

# API keys are read-only (they live in containers for months): writing is for CI tokens and the logged-in user.
VALID_SCOPES = [
    "read:secrets",
    "read:audit",
]


async def _environment_names(client, project_id: str) -> list[str]:
    result = await client.list_environments(project_id)
    return [e["name"] for e in result.get("environments", [])]


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
        async with async_cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = await resolve_project_id_async(db, project_id, client)
            result = await client.list_api_keys(resolved_project_id)
            items = result.get("items", [])

            if not items:
                click.echo("No API keys found.")
                return

            env_names = set(await _environment_names(client, resolved_project_id))
            broken = []
            click.echo(f"{'NAME':<25} {'PREFIX':<15} {'ENV':<18} {'SCOPES':<35} {'ID':<38}")
            click.echo("─" * 132)
            for key in items:
                name = key.get("name", "Unnamed")[:24]
                prefix = key.get("prefix", "unknown")[:14]
                env_scope = key.get("environment_scope")
                env = env_scope or "all"
                if env_scope and env_scope not in env_names:
                    broken.append(key)
                    env = f"{env_scope[:14]} (!)"
                scopes = ", ".join(key.get("scopes", []))[:34]
                kid = key.get("id", "unknown")[:37]
                click.echo(f"{name:<25} {prefix:<15} {env[:17]:<18} {scopes:<35} {kid:<38}")

            click.echo("")
            click.echo(f"Total: {len(items)} key(s)")
            if broken:
                click.echo("")
                click.echo(click.style(
                    f"Warning: {len(broken)} key(s) are restricted to an environment that does not exist, "
                    "so they cannot read any secrets. Revoke and recreate them:",
                    fg="yellow",
                ), err=True)
                for key in broken:
                    click.echo(f"  criptenv api-keys revoke {key.get('id')} -p {resolved_project_id}", err=True)

    asyncio.run(_do_list())


@api_keys_group.command("create")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--name", "-n", required=True, help="Key name")
@click.option("--scope", "-s", multiple=True, default=["read:secrets"],
              type=click.Choice(VALID_SCOPES),
              help="read:secrets (encrypted secrets) and/or read:audit (project audit history, only for a key of every environment)")
@click.option("--env", default=None, help="Restrict the key to one environment (name as shown by 'criptenv env list'). Default: all environments")
@click.option("--expires-days", type=int, default=None, help="Expiration in days (1-365)")
def api_keys_create(project_id: str | None, name: str, scope: tuple[str, ...], env: str | None, expires_days: int | None):
    """Create a new API key.

    The plaintext key is shown ONLY once — copy it immediately.

    \b
    Examples:
        criptenv api-keys create -p <project-id> -n "CI Key"
        criptenv api-keys create -p <project-id> -n "App container" --env production --expires-days 90
        criptenv api-keys create -p <project-id> -n "Audit export" -s read:audit
    """
    async def _do_create():
        async with async_cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = await resolve_project_id_async(db, project_id, client)
            env_scope = (env or "").strip() or None
            if env_scope and "read:audit" in scope:
                raise click.ClickException(
                    "read:audit covers the whole project: it is only for a key of every environment (drop --env)"
                )
            if env_scope:
                env_names = await _environment_names(client, resolved_project_id)
                if env_scope not in env_names:
                    raise click.ClickException(
                        f"Environment '{env_scope}' does not exist in this project. "
                        f"Valid environments: {', '.join(env_names) or '(none)'}"
                    )
            result = await client.create_api_key(
                project_id=resolved_project_id,
                name=name,
                scopes=list(scope),
                environment_scope=env_scope,
                expires_in_days=expires_days,
            )
            click.echo(click.style("✓ API key created", fg="green", bold=True))
            click.echo(f"  Name: {result.get('name', name)}")
            click.echo(f"  ID: {result.get('id', 'unknown')}")
            click.echo(f"  Environment: {result.get('environment_scope') or 'all'}")
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
        async with async_cli_context(require_auth=True) as (db, _mk, client):
            resolved_project_id = await resolve_project_id_async(db, project_id, client)
            result = await client.revoke_api_key(resolved_project_id, key_id)
            click.echo(f"✓ Revoked API key {key_id}")
            if result.get("name"):
                click.echo(f"  Name: {result['name']}")

    asyncio.run(_do_revoke())

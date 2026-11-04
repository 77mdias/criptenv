"""Cloud Integration Commands for CriptEnv CLI.

Manages connections to external providers (Vercel, Render, Cloudflare Workers)
for secret synchronization. Secrets are decrypted/encrypted locally; the API
only relays them to the provider.
"""

import asyncio
from typing import Optional

import click

from criptenv.commands.import_export import import_entries_into_vault
from criptenv.context import (
    async_cli_context,
    cli_context,
    resolve_project_id,
    resolve_project_id_async,
    run_async,
)
from criptenv.remote_vault import RemoteVault

PROVIDERS = ["vercel", "render", "cloudflare"]
# Config key that holds the provider-side resource the integration writes to.
TARGET_CONFIG_KEY = {"vercel": "project_id", "render": "service_id", "cloudflare": "script_name"}
TARGET_LABEL = {"vercel": "Vercel project ID or name", "render": "Render service ID", "cloudflare": "Worker script name"}


@click.group()
def integrations():
    """Manage cloud provider integrations for secret sync.

    Connect to Vercel, Render or Cloudflare Workers and sync secrets.
    """
    pass


@integrations.command("list")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def integrations_list(project_id: str | None):
    """List connected integrations for the current project.

    Example:
        criptenv integrations list
    """
    async def _do_list():
        async with async_cli_context(require_auth=True) as (db, master_key, client):
            try:
                resolved_project_id = await resolve_project_id_async(db, project_id, client)
            except click.ClickException as e:
                click.echo(f"Error: {e.message}", err=True)
                return

            try:
                items = await client.list_integrations(resolved_project_id)

                if not items:
                    click.echo("No integrations connected.")
                    click.echo("")
                    click.echo("Connect an integration:")
                    for provider in PROVIDERS:
                        click.echo(f"  criptenv integrations connect {provider}")
                    return

                click.echo("Connected integrations:")
                click.echo("")
                for item in items:
                    status = item.get("status", "unknown")
                    status_icon = "✓" if status == "active" else "✗"
                    click.echo(f"  {status_icon} {item.get('name', 'Unnamed')} ({item.get('provider', 'unknown')})")
                    click.echo(f"    ID: {item.get('id', 'unknown')}")
                    click.echo(f"    Status: {status}")
                    click.echo(f"    Last sync: {item.get('last_sync_at') or 'never'}")
                    if item.get("last_error"):
                        click.echo(f"    Last error: {item['last_error']}")
                    click.echo("")

            except Exception as e:
                click.echo(f"Error listing integrations: {e}", err=True)

    asyncio.run(_do_list())


@integrations.command("connect")
@click.argument("provider", type=click.Choice(PROVIDERS))
@click.option("--name", help="Integration name")
@click.option("--token", help="API token for the provider")
@click.option("--project-id", "project_id_opt", help="Vercel project, Render service ID or Worker script name")
@click.option("--team-id", help="Vercel team ID (required for team-owned projects)")
@click.option("--account-id", help="Cloudflare account ID")
@click.option("--project", "project_id_arg", default=None, help="CriptEnv project ID")
def integrations_connect(
    provider: str,
    name: Optional[str],
    token: Optional[str],
    project_id_opt: Optional[str],
    team_id: Optional[str],
    account_id: Optional[str],
    project_id_arg: Optional[str],
):
    """Connect a new cloud provider integration.

    Example:
        criptenv integrations connect vercel --token tok_xxx --project-id prj_xxx [--team-id team_xxx]
        criptenv integrations connect render --token rnd_xxx --project-id srv_xxx
        criptenv integrations connect cloudflare --token cf_xxx --account-id acc_xxx --project-id my-worker
    """
    async def _do_connect():
        # `token`/`project_id_opt`/`account_id` are outer-function parameters;
        # without `nonlocal` the assignments below make them closure locals
        # and `if not token` raises UnboundLocalError (ruff F823, Sprint 3 2026-10).
        nonlocal token, project_id_opt, account_id

        async with async_cli_context(require_auth=True) as (db, master_key, client):
            try:
                resolved_project_id = await resolve_project_id_async(db, project_id_arg, client)
            except click.ClickException as e:
                click.echo(f"Error: {e.message}", err=True)
                return

            if not token:
                token = click.prompt(f"Enter your {provider} API token", hide_input=True)
            if not project_id_opt:
                project_id_opt = click.prompt(f"Enter your {TARGET_LABEL[provider]}")
            if provider == "cloudflare" and not account_id:
                account_id = click.prompt("Enter your Cloudflare account ID")

            integration_name = name or f"{provider.capitalize()} Integration"
            config = {"api_token": token, TARGET_CONFIG_KEY[provider]: project_id_opt}
            if provider == "vercel" and team_id:
                config["team_id"] = team_id
            if provider == "cloudflare":
                config["account_id"] = account_id

            try:
                click.echo(f"Connecting to {provider}...")
                result = await client.create_integration(
                    project_id=resolved_project_id,
                    provider=provider,
                    name=integration_name,
                    config=config,
                )
                click.echo(f"✓ Connected to {provider}: {integration_name}")
                click.echo(f"  Integration ID: {result.get('id', 'unknown')}")
                click.echo(f"  Status: {result.get('status', 'active')}")
                click.echo(f"  Check it with: criptenv integrations validate {result.get('id', '<id>')}")

            except Exception as e:
                click.echo(f"Error connecting to {provider}: {e}", err=True)

    asyncio.run(_do_connect())


@integrations.command("disconnect")
@click.argument("integration_id")
@click.option("--project", "project_id_arg", default=None, help="CriptEnv project ID")
@click.option("--force", is_flag=True, help="Skip confirmation")
def integrations_disconnect(integration_id: str, project_id_arg: Optional[str], force: bool):
    """Disconnect a cloud provider integration.

    Example:
        criptenv integrations disconnect 550e8400-e29b-41d4-a716-446655440000 --project prj_xxx
    """
    async def _do_disconnect():
        async with async_cli_context(require_auth=True) as (db, master_key, client):
            try:
                resolved_project_id = await resolve_project_id_async(db, project_id_arg, client)
            except click.ClickException as e:
                click.echo(f"Error: {e.message}", err=True)
                return

            if not force:
                if not click.confirm(f"Disconnect integration {integration_id}?"):
                    click.echo("Aborted.")
                    return

            try:
                await client.delete_integration(resolved_project_id, integration_id)
                click.echo(f"✓ Integration {integration_id} disconnected.")
            except Exception as e:
                click.echo(f"Error disconnecting: {e}", err=True)

    asyncio.run(_do_disconnect())


@integrations.command("validate")
@click.argument("integration_id")
@click.option("--project", "project_id_arg", default=None, help="CriptEnv project ID")
def integrations_validate(integration_id: str, project_id_arg: Optional[str]):
    """Check that a connected integration can still reach its provider.

    Example:
        criptenv integrations validate <integration-id> --project prj_xxx
    """
    async def _do_validate() -> bool:
        async with async_cli_context(require_auth=True) as (db, master_key, client):
            try:
                resolved_project_id = await resolve_project_id_async(db, project_id_arg, client)
            except click.ClickException as e:
                click.echo(f"Error: {e.message}", err=True)
                return False

            try:
                result = await client.validate_integration(resolved_project_id, integration_id)
            except Exception as e:
                click.echo(f"Error validating integration: {e}", err=True)
                return False

            if result.get("valid"):
                click.echo(f"✓ Integration {integration_id} is valid")
                return True
            click.echo(
                f"✗ Integration {integration_id} is invalid: {result.get('error') or 'unknown error'}",
                err=True,
            )
            return False

    if not asyncio.run(_do_validate()):
        raise SystemExit(1)


def pick_integration(items: list[dict], provider: str, integration_id: Optional[str]) -> dict:
    """Choose the integration to sync; refuse to guess when a provider has several."""
    if integration_id:
        for item in items:
            if item.get("id") == integration_id:
                return item
        raise click.ClickException(f"Integration {integration_id} not found in this project.")

    matches = [item for item in items if item.get("provider") == provider]
    if not matches:
        raise click.ClickException(
            f"No {provider} integration found. Run 'criptenv integrations connect {provider}' first."
        )
    if len(matches) > 1:
        options = ", ".join(f"{item.get('name')} ({item.get('id')})" for item in matches)
        raise click.ClickException(
            f"Several {provider} integrations found: {options}. Pick one with --integration <id>."
        )
    return matches[0]


@integrations.command("sync")
@click.option("--provider", required=True, type=click.Choice(PROVIDERS), help="Provider to sync")
@click.option("--env", "environment", default="production", help="CriptEnv environment to read from / write to")
@click.option("--target", default=None, help="Provider environment (Vercel: production, preview, development). Defaults to --env")
@click.option("--direction", type=click.Choice(["push", "pull"]), default="push", help="push: CriptEnv → provider, pull: provider → CriptEnv")
@click.option("--integration", "integration_id", default=None, help="Integration ID (when a provider has several)")
@click.option("--overwrite", is_flag=True, help="On pull, overwrite secrets that already exist in CriptEnv")
@click.option("--project", "project_id_arg", default=None, help="Project ID")
def integrations_sync(
    provider: str,
    environment: str,
    target: Optional[str],
    direction: str,
    integration_id: Optional[str],
    overwrite: bool,
    project_id_arg: Optional[str],
):
    """Sync secrets with a connected provider.

    Push decrypts the environment locally and sends every secret to the
    provider. Pull reads the provider's values and encrypts them locally into
    the CriptEnv vault.

    Example:
        criptenv integrations sync --provider vercel --env production
        criptenv integrations sync --provider vercel --env staging --target preview
        criptenv integrations sync --provider render --env production --direction pull
    """
    provider_env = target or environment
    try:
        with cli_context(require_auth=True) as (db, _master_key, client):
            project_id = resolve_project_id(db, project_id_arg, client)
            integration = pick_integration(
                run_async(client.list_integrations(project_id)), provider, integration_id
            )
            vault = RemoteVault(client, project_id)

            if direction == "push":
                entries = run_async(vault.decrypt_all(run_async(vault.load_state(environment))))
                if not entries:
                    click.echo(f"No secrets in environment '{environment}'; nothing to push.")
                    return
                click.echo(f"Pushing {len(entries)} secret(s) from '{environment}' to {provider} ({provider_env})...")
                result = run_async(client.sync_integration(
                    project_id,
                    integration["id"],
                    direction="push",
                    environment=provider_env,
                    secrets=[{"key": key, "value": value} for key, value in entries.items()],
                ))
            else:
                click.echo(f"Pulling secrets from {provider} ({provider_env})...")
                result = run_async(client.sync_integration(
                    project_id, integration["id"], direction="pull", environment=provider_env
                ))

            if not result.get("success"):
                raise click.ClickException(f"Sync failed: {result.get('message') or 'unknown error'}")

            if direction == "push":
                click.echo(f"✓ Pushed {result.get('synced_count', len(entries))} secret(s) to {provider}")
                return

            pulled = [(item["key"], item["value"]) for item in result.get("secrets") or []]
            if not pulled:
                click.echo(f"No secrets found in {provider} ({provider_env}).")
                return
            imported, skipped = import_entries_into_vault(vault, pulled, environment, overwrite)
            click.echo(f"✓ Pulled {len(pulled)} secret(s): {imported} imported, {skipped} skipped into '{environment}'")
    except click.ClickException as e:
        click.echo(f"Error: {e.message}", err=True)
        raise SystemExit(1)
    except Exception as e:
        click.echo(f"Error syncing: {e}", err=True)
        raise SystemExit(1)


# Export for registration
integrations_group = integrations

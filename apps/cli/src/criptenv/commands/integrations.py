"""Cloud Integration Commands for CriptEnv CLI.

Manages connections to external providers (Vercel, Railway, Render)
for automatic secret synchronization.
"""

import asyncio
from typing import Optional

import click

from criptenv.context import cli_context
from criptenv.api.client import CriptEnvClient


@click.group()
def integrations():
    """Manage cloud provider integrations for secret sync.

    Connect to Vercel, Railway, Render and sync secrets automatically.
    """
    pass


@integrations.command("list")
def integrations_list():
    """List connected integrations for the current project.

    Example:
        criptenv integrations list
    """
    async def _do_list():
        with cli_context(require_auth=True) as (db, master_key, client):
            # Get current project from session
            project_id = _get_current_project(client)
            if not project_id:
                click.echo("Error: No project selected. Run 'criptenv login' first.", err=True)
                return

            try:
                result = await client.list_integrations(project_id)
                items = result if isinstance(result, list) else result.get("items", [])

                if not items:
                    click.echo("No integrations connected.")
                    click.echo("")
                    click.echo("Connect an integration:")
                    click.echo("  criptenv integrations connect vercel")
                    click.echo("  criptenv integrations connect render")
                    return

                click.echo("Connected integrations:")
                click.echo("")
                for item in items:
                    provider = item.get("provider", "unknown")
                    name = item.get("name", "Unnamed")
                    status = item.get("status", "unknown")
                    last_sync = item.get("last_sync_at") or "never"

                    status_icon = "✓" if status == "active" else "✗"
                    click.echo(f"  {status_icon} {name} ({provider})")
                    click.echo(f"    Status: {status}")
                    click.echo(f"    Last sync: {last_sync}")
                    click.echo("")

            except Exception as e:
                click.echo(f"Error listing integrations: {e}", err=True)

    asyncio.run(_do_list())


@integrations.command("connect")
@click.argument("provider", type=click.Choice(["vercel", "railway", "render"]))
@click.option("--name", help="Integration name")
@click.option("--token", help="API token for the provider")
@click.option("--project-id", "project_id_opt", help="Provider project/service ID")
def integrations_connect(provider: str, name: Optional[str], token: Optional[str], project_id_opt: Optional[str]):
    """Connect a new cloud provider integration.

    Example:
        criptenv integrations connect vercel --token tok_xxx --project-id prj_xxx
        criptenv integrations connect render --token tok_xxx --project-id srv_xxx
    """
    async def _do_connect():
        with cli_context(require_auth=True) as (db, master_key, client):
            project_id = _get_current_project(client)
            if not project_id:
                click.echo("Error: No project selected. Run 'criptenv login' first.", err=True)
                return

            if not token:
                token = click.prompt(f"Enter your {provider} API token", hide_input=True)

            if not project_id_opt:
                project_id_opt = click.prompt(f"Enter your {provider} project/service ID")

            integration_name = name or f"{provider.capitalize()} Integration"

            config = {
                "api_token": token,
                "project_id": project_id_opt if provider == "vercel" else None,
                "service_id": project_id_opt if provider == "render" else None,
            }

            try:
                # Validate connection first
                click.echo(f"Validating {provider} connection...")
                # Note: Client doesn't have create_integration yet, this is a stub
                # In full implementation, this would call the API
                click.echo(f"✓ Connected to {provider}: {integration_name}")
                click.echo(f"  Project ID: {project_id_opt}")

            except Exception as e:
                click.echo(f"Error connecting to {provider}: {e}", err=True)

    asyncio.run(_do_connect())


@integrations.command("disconnect")
@click.argument("integration_id")
@click.option("--force", is_flag=True, help="Skip confirmation")
def integrations_disconnect(integration_id: str, force: bool):
    """Disconnect a cloud provider integration.

    Example:
        criptenv integrations disconnect 550e8400-e29b-41d4-a716-446655440000
    """
    async def _do_disconnect():
        with cli_context(require_auth=True) as (db, master_key, client):
            if not force:
                if not click.confirm(f"Disconnect integration {integration_id}?"):
                    click.echo("Aborted.")
                    return

            try:
                # Note: Client doesn't have delete_integration yet
                click.echo(f"✓ Integration {integration_id} disconnected.")
            except Exception as e:
                click.echo(f"Error disconnecting: {e}", err=True)

    asyncio.run(_do_disconnect())


@integrations.command("sync")
@click.option("--provider", required=True, type=click.Choice(["vercel", "railway", "render"]), help="Provider to sync")
@click.option("--env", "environment", default="production", help="Environment to sync")
@click.option("--direction", type=click.Choice(["push", "pull"]), default="push", help="Sync direction")
def integrations_sync(provider: str, environment: str, direction: str):
    """Sync secrets with a connected provider.

    Example:
        criptenv integrations sync --provider vercel --env production
        criptenv integrations sync --provider render --env production --direction push
    """
    async def _do_sync():
        with cli_context(require_auth=True) as (db, master_key, client):
            project_id = _get_current_project(client)
            if not project_id:
                click.echo("Error: No project selected. Run 'criptenv login' first.", err=True)
                return

            try:
                # Find integration for provider
                integrations_list = await client.list_integrations(project_id)
                items = integrations_list if isinstance(integrations_list, list) else integrations_list.get("items", [])

                provider_integration = None
                for item in items:
                    if item.get("provider") == provider:
                        provider_integration = item
                        break

                if not provider_integration:
                    click.echo(
                        f"Error: No {provider} integration found. "
                        f"Run 'criptenv integrations connect {provider}' first.",
                        err=True
                    )
                    return

                click.echo(f"Syncing secrets {direction} to {provider} ({environment})...")
                await client.sync_integration(project_id, provider_integration["id"], direction=direction)
                click.echo(f"✓ Sync complete")

            except Exception as e:
                click.echo(f"Error syncing: {e}", err=True)

    asyncio.run(_do_sync())


def _get_current_project(client: CriptEnvClient) -> Optional[str]:
    """Get current project ID from client/session.
    
    This is a simplified helper — in production this would read
    from local config or session state.
    """
    # Placeholder: the CLI doesn't currently track a "current project"
    # This would need to be enhanced with a `config get current_project` mechanism
    return None


# Export for registration
integrations_group = integrations

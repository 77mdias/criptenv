"""Environment management commands."""

import re

import click

from criptenv.context import cli_context, run_async, resolve_project_id
from criptenv.remote_vault import RemoteVault

_TTL_UNITS = {"m": 60, "h": 3600, "d": 86400, "w": 7 * 86400}


def parse_ttl(value: str) -> int:
    """'30m', '12h', '7d', '2w' -> seconds."""
    match = re.fullmatch(r"\s*(\d+)\s*([mhdw])\s*", value or "")
    if not match or int(match.group(1)) <= 0:
        raise click.BadParameter("use a positive number with m, h, d or w (e.g. 7d)", param_hint="--ttl")
    return int(match.group(1)) * _TTL_UNITS[match.group(2)]


def _environment(client, project_id: str, name_or_id: str):
    """An environment by name or ID (RemoteEnvironment)."""
    return run_async(RemoteVault(client, project_id).resolve_environment(name_or_id))


@click.group("env")
def env_group():
    """Manage environments (dev, staging, production, etc.)."""
    pass


@env_group.command("list")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def env_list(project_id: str | None):
    """List environments for a project.

    \b
    Examples:
        criptenv env list
        criptenv env list -p <project-id>
    """
    with cli_context(require_auth=True) as (db, _master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id, client)
            result = run_async(client.list_environments(resolved_project_id))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    environments = result.get("environments", [])
    if not environments:
        click.echo("No environments found.")
        return

    names = {env["id"]: env["name"] for env in environments}
    click.echo(f"{'NAME':<24} {'ID':<38} {'DEFAULT':<8} {'ACCESS':<11} {'PARENT':<16} {'EXPIRES'}")
    click.echo("─" * 112)
    for env in environments:
        is_default = "✓" if env.get("is_default") else ""
        # Restricted: only the project's owner and admins reach it (and only they see it listed).
        access = "restricted" if env.get("restricted") else ""
        parent = names.get(env.get("parent_id"), env.get("parent_id") or "")
        expires = str(env.get("expires_at") or "")[:16].replace("T", " ")
        click.echo(f"{env['name']:<24} {env['id']:<38} {is_default:<8} {access:<11} {parent:<16} {expires}".rstrip())

    click.echo("")
    click.echo(f"Total: {len(environments)} environment(s)")


@env_group.command("create")
@click.argument("name")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--display-name", "-d", default=None, help="Human-readable display name")
@click.option("--restricted", is_flag=True, help="Only the project's owner and admins can see and read it")
@click.option("--parent", default=None, help="Inherit from this environment (name or ID); stores only overrides")
@click.option("--ttl", default=None, help="Delete it automatically after this long (e.g. 12h, 7d); needs --parent")
def env_create(
    name: str, project_id: str | None, display_name: str | None, restricted: bool,
    parent: str | None, ttl: str | None,
):
    """Create a new environment.

    \b
    Examples:
        criptenv env create staging -p <project-id>
        criptenv env create production -p <project-id> -d "Production Environment"
        criptenv env create db-admin --restricted
        criptenv env create dev/wt-feature-x --parent dev --ttl 7d
    """
    ttl_seconds = parse_ttl(ttl) if ttl else None
    if ttl_seconds is not None and not parent:
        raise click.UsageError("--ttl needs --parent: only a child environment is ephemeral")
    with cli_context(require_auth=True) as (db, _master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id, client)
            parent_env = _environment(client, resolved_project_id, parent) if parent else None
            inheritance = {"parent_id": parent_env.id} if parent_env else {}
            if ttl_seconds is not None:
                inheritance["ttl_seconds"] = ttl_seconds
            result = run_async(client.create_environment(
                resolved_project_id, name, display_name, restricted=restricted, **inheritance,
            ))
        except click.ClickException as e:
            click.echo(f"Error: {e.message}", err=True)
            raise SystemExit(1)
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Created environment '{result.get('name', name)}'")
    click.echo(f"  ID: {result.get('id', 'unknown')}")
    if parent_env:
        click.echo(f"  Inherits from: {parent_env.name} (stores only its overrides)")
    if result.get("expires_at"):
        click.echo(f"  Expires: {result['expires_at']} (deleted automatically; its parent is untouched)")
    if result.get("restricted") and not restricted:
        click.echo("  Restricted: its parent is restricted, so it is too.")
    if restricted:
        click.echo("  Restricted: only the project's owner and admins reach it.")
        click.echo("  CI tokens and API keys reach it only when created for this environment.")


@env_group.command("update")
@click.argument("env_id")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--name", "-n", default=None, help="New environment name")
@click.option("--display-name", "-d", default=None, help="New display name")
@click.option("--restricted", "restrict", is_flag=True, help="Restrict it to the project's owner and admins")
@click.option("--open", "open_", is_flag=True, help="Open a restricted environment to the whole team")
def env_update(
    env_id: str, project_id: str | None, name: str | None, display_name: str | None, restrict: bool, open_: bool,
):
    """Update an environment.

    \b
    Examples:
        criptenv env update <env-id> -p <project-id> --name "new-name"
        criptenv env update <env-id> -p <project-id> -d "New Display Name"
    """
    if restrict and open_:
        raise click.UsageError("Use either --restricted or --open, not both")
    restricted = True if restrict else False if open_ else None
    if not name and not display_name and restricted is None:
        click.echo("Error: Provide at least one of --name, --display-name, --restricted or --open", err=True)
        raise SystemExit(1)

    with cli_context(require_auth=True) as (db, _master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id, client)
            result = run_async(client.update_environment(
                resolved_project_id, env_id, name=name, display_name=display_name, restricted=restricted,
            ))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Updated environment '{result.get('name', env_id)}'")


@env_group.command("delete")
@click.argument("env_id")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
def env_delete(env_id: str, project_id: str | None, force: bool):
    """Delete an environment (by name or ID).

    A child environment is deleted for good with its overrides, and its name is free again;
    its parent is untouched. Any other environment is archived.

    \b
    Examples:
        criptenv env delete dev/wt-feature-x --force
        criptenv env delete <env-id> -p <project-id>
    """
    with cli_context(require_auth=True) as (db, _master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id, client)
            env = _environment(client, resolved_project_id, env_id)
            if not force:
                what = "its overrides (the parent is untouched)" if env.parent_id else "it"
                if not click.confirm(f"Delete environment '{env.name}' and {what}?"):
                    click.echo("Aborted.")
                    return
            run_async(client.delete_environment(resolved_project_id, env.id))
        except click.ClickException as e:
            click.echo(f"Error: {e.message}", err=True)
            raise SystemExit(1)
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Deleted environment '{env.name}'" + (" (parent untouched)" if env.parent_id else ""))


@env_group.command("show")
@click.argument("env_name")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--resolved", is_flag=True, help="List every key it resolves to, with where each comes from")
@click.option("--show-values", is_flag=True, help="With --resolved: decrypt and print values (masked by default)")
def env_show(env_name: str, project_id: str | None, resolved: bool, show_values: bool):
    """Show an environment: its parent, expiry and, with --resolved, its keys and their origin.

    \b
    Examples:
        criptenv env show dev/wt-feature-x --resolved
        criptenv env show dev/wt-feature-x --resolved --show-values
    """
    if show_values and not resolved:
        raise click.UsageError("--show-values needs --resolved")
    with cli_context(require_auth=True) as (db, _master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id, client)
            vault = RemoteVault(client, resolved_project_id)
            state = run_async(vault.load_resolved(env_name))
            chain = state.chain or [state.environment.name]
            values = run_async(vault.decrypt_all(state)) if show_values else {}
        except click.ClickException as e:
            click.echo(f"Error: {e.message}", err=True)
            raise SystemExit(1)
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    env = state.environment
    click.echo(f"Name:     {env.name}")
    click.echo(f"ID:       {env.id}")
    click.echo(f"Inherits: {' → '.join(chain[1:]) if len(chain) > 1 else '—'}")
    click.echo(f"Expires:  {env.expires_at or '—'}")
    if state.unset_keys:
        click.echo(f"Unset:    {', '.join(state.unset_keys)}")
    if not resolved:
        return

    click.echo("")
    if not state.blobs:
        click.echo("No secrets.")
        return
    click.echo(f"  {'KEY':<30} {'ORIGIN':<28} VALUE")
    for blob in state.blobs:
        origin = "local" if blob.get("origin") == "local" else f"inherited from {blob.get('source_environment_name')}"
        value = values[blob["key_id"]] if show_values else "********"
        click.echo(f"  {blob['key_id']:<30} {origin:<28} {value}")
    click.echo("")
    click.echo(f"Total: {len(state.blobs)} key(s)")


@env_group.command("diff")
@click.argument("env_name")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def env_diff(env_name: str, project_id: str | None):
    """Compare a child environment with its parent: key names and origins only, never values.

    \b
    Examples:
        criptenv env diff dev/wt-feature-x
    """
    with cli_context(require_auth=True) as (db, _master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id, client)
            env = _environment(client, resolved_project_id, env_name)
            if not env.parent_id:
                raise click.ClickException(f"'{env.name}' has no parent to compare with.")
            result = run_async(client.environment_diff(resolved_project_id, env.id))
        except click.ClickException as e:
            click.echo(f"Error: {e.message}", err=True)
            raise SystemExit(1)
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    keys = result.get("keys", [])
    labels = {
        "override": ("~", "overrides {parent_source}"),
        "added": ("+", "only in {env}"),
        "unset": ("-", "unset (hidden from {parent_source})"),
        "inherited": ("=", "inherited from {source}"),
    }
    click.echo(f"{result.get('environment')} vs {result.get('parent')}:")
    for row in keys:
        mark, text = labels.get(row["status"], ("?", row["status"]))
        click.echo(f"  {mark} {row['key']:<30} {text.format(env=result.get('environment'), **row)}")
    changed = sum(1 for row in keys if row["status"] != "inherited")
    click.echo("")
    click.echo(f"{changed} change(s) against the parent, {len(keys) - changed} inherited as is.")


@env_group.command("get")
@click.argument("env_id")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
def env_get(env_id: str, project_id: str | None):
    """Show details for a specific environment.

    \b
    Examples:
        criptenv env get <env-id> -p <project-id>
    """
    with cli_context(require_auth=True) as (db, _master_key, client):
        try:
            resolved_project_id = resolve_project_id(db, project_id, client)
            result = run_async(client.get_environment(resolved_project_id, env_id))
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"Name:         {result.get('name', 'unknown')}")
    click.echo(f"ID:           {result.get('id', 'unknown')}")
    click.echo(f"Display Name: {result.get('display_name', 'N/A')}")
    click.echo(f"Is Default:   {'Yes' if result.get('is_default') else 'No'}")
    click.echo(f"Created:      {result.get('created_at', 'unknown')}")
    click.echo(f"Updated:      {result.get('updated_at', 'unknown')}")

"""Import/export commands for .env files."""

import click
import json

from criptenv.context import cli_context, run_async, resolve_project_id
from criptenv.remote_vault import RemoteVault


def import_entries_remote(
    entries: list[tuple[str, str]],
    env_name: str | None,
    project: str | None,
    overwrite: bool,
) -> tuple[int, int]:
    """Import parsed key/value entries into the remote project vault."""
    with cli_context(require_auth=True) as (db, _master_key, client):
        resolved_project_id = resolve_project_id(db, project)
        vault = RemoteVault(client, resolved_project_id)
        state = run_async(vault.load_state(env_name))
        by_key = {blob["key_id"]: blob for blob in state.blobs}
        imported = 0
        skipped = 0

        for key, value in entries:
            existing = by_key.get(key)
            if existing and not overwrite:
                click.echo(f"  Skipped {key} (already exists, use --overwrite)")
                skipped += 1
                continue

            version = int(existing.get("version", state.version)) + 1 if existing else state.version + 1
            by_key[key] = run_async(
                vault.encrypt_blob(
                    key,
                    value.encode("utf-8"),
                    state.environment.id,
                    version,
                )
            )
            imported += 1

        if imported:
            run_async(vault.push_state(state, list(by_key.values())))

    return imported, skipped


def export_entries_remote(
    env_name: str | None,
    project: str | None,
) -> dict[str, str]:
    """Export remote project vault entries as plaintext key/value pairs."""
    with cli_context(require_auth=True) as (db, _master_key, client):
        resolved_project_id = resolve_project_id(db, project)
        vault = RemoteVault(client, resolved_project_id)
        state = run_async(vault.load_state(env_name))
        return run_async(vault.decrypt_all(state))


def _format_entries(entries: dict[str, str], fmt: str) -> str:
    if fmt == "json":
        return json.dumps(entries, indent=2)
    lines = [f"{key}={value}" for key, value in entries.items()]
    return "\n".join(lines) + "\n"


@click.command("import")
@click.argument("file", type=click.Path(exists=True))
@click.option("--env", "-e", "env_name", default=None, help="Target environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
@click.option("--overwrite", is_flag=True, help="Overwrite existing secrets")
def import_command(file: str, env_name: str | None, project: str | None, overwrite: bool):
    """Import secrets from a .env file.

    Each line in the .env file is parsed as KEY=VALUE.
    Lines starting with # are treated as comments.

    \b
    Examples:
        criptenv import .env
        criptenv import .env.production -e production
        criptenv import secrets.env --overwrite
    """
    # Parse .env file
    entries = _parse_env_file(file)
    if not entries:
        click.echo("No entries found in file.")
        return

    click.echo(f"Found {len(entries)} entry(ies) in {file}")

    try:
        imported, skipped = import_entries_remote(entries, env_name, project, overwrite)
    except click.ClickException as e:
        click.echo(f"Error: {e.message}", err=True)
        raise SystemExit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)

    click.echo(f"✓ Imported {imported} secret(s)")
    if skipped:
        click.echo(f"  Skipped {skipped} (already exists)")


@click.command("export")
@click.option("--env", "-e", "env_name", default=None, help="Source environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
@click.option("--output", "-o", default=None, help="Output file (default: stdout)")
@click.option("--format", "fmt", type=click.Choice(["env", "json"]), default="env",
              help="Output format")
def export_command(env_name: str | None, project: str | None, output: str | None, fmt: str):
    """Export secrets to .env format.

    Values are decrypted locally before export.
    WARNING: Exported files contain plaintext secrets!

    \b
    Examples:
        criptenv export
        criptenv export -e staging -o .env.staging
        criptenv export --format json -o secrets.json
    """
    try:
        entries = export_entries_remote(env_name, project)
    except click.ClickException as e:
        click.echo(f"Error: {e.message}", err=True)
        raise SystemExit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)

    if not entries:
        click.echo("No secrets to export.")
        return

    content = _format_entries(entries, fmt)

    # Write output
    if output:
        with open(output, "w") as f:
            f.write(content)
        click.echo(f"✓ Exported {len(entries)} secret(s) to {output}")
    else:
        click.echo(content, nl=False)


def _parse_env_file(filepath: str) -> list[tuple[str, str]]:
    """Parse a .env file and return list of (key, value) tuples."""
    entries = []

    # Try different encodings
    for encoding in ["utf-8", "latin-1"]:
        try:
            with open(filepath, "r", encoding=encoding) as f:
                for line in f:
                    line = line.strip()

                    # Skip empty lines and comments
                    if not line or line.startswith("#"):
                        continue

                    # Parse KEY=VALUE
                    if "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip()
                        value = value.strip()

                        # Remove surrounding quotes
                        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                            value = value[1:-1]

                        if key:
                            entries.append((key, value))
            break  # Success, no need to try other encoding
        except UnicodeDecodeError:
            continue

    return entries

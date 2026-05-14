"""Remote import/export aliases for cloud vault workflows."""

import click

from criptenv.commands.import_export import (
    _format_entries,
    _parse_env_file,
    import_entries_remote,
    export_entries_remote,
)


@click.command()
@click.argument("file", required=False, type=click.Path(exists=True))
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--overwrite", is_flag=True, help="Overwrite existing secrets")
@click.option("--force", is_flag=True, help="Alias for --overwrite")
def push_command(file: str | None, env_name: str | None, project_id: str | None, overwrite: bool, force: bool):
    """Import a local .env file into the remote project vault.

    \b
    Examples:
        criptenv push .env.production -e production -p <project-id>
        criptenv push .env --overwrite
    """
    if not file:
        click.echo(
            "Error: 'criptenv push' now imports a file into the remote vault. "
            "Use 'criptenv push <file>' or 'criptenv import <file>'.",
            err=True,
        )
        raise SystemExit(1)

    entries = _parse_env_file(file)
    if not entries:
        click.echo("No entries found in file.")
        return

    try:
        imported, skipped = import_entries_remote(
            entries,
            env_name,
            project_id,
            overwrite or force,
        )
    except click.ClickException as e:
        click.echo(f"Error: {e.message}", err=True)
        raise SystemExit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)

    click.echo(f"✓ Pushed {imported} secret(s) from {file}")
    if skipped:
        click.echo(f"  Skipped {skipped} (already exists)")


@click.command()
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", "project_id", default=None, help="Project ID")
@click.option("--output", "-o", required=False, help="Output file")
@click.option("--format", "fmt", type=click.Choice(["env", "json"]), default="env", help="Output format")
def pull_command(env_name: str | None, project_id: str | None, output: str | None, fmt: str):
    """Export remote project vault secrets to a local file.

    \b
    Examples:
        criptenv pull -e production -p <project-id> -o .env.production
        criptenv pull -o secrets.json --format json
    """
    if not output:
        click.echo(
            "Error: 'criptenv pull' now exports the remote vault to a file. "
            "Use 'criptenv pull --output <file>' or 'criptenv export --output <file>'.",
            err=True,
        )
        raise SystemExit(1)

    try:
        entries = export_entries_remote(env_name, project_id)
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
    with open(output, "w") as f:
        f.write(content)

    click.echo(f"✓ Pulled {len(entries)} secret(s) to {output}")

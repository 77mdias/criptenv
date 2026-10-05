"""`run` and `diff` commands — the daily-driver ergonomics gaps vs Doppler.

- ``criptenv run -- <cmd>`` injects the decrypted environment into a
  subprocess without writing a plaintext file to disk.
- ``criptenv diff [file]`` compares a local .env file against the remote
  vault (drift detection), exiting non-zero when they differ.
"""

import os
import shlex
import subprocess
from typing import Optional

import click

from criptenv.commands.import_export import _parse_env_file, export_entries_remote


def _diff_keys(
    local: dict[str, str], remote: dict[str, str]
) -> tuple[list[str], list[str], list[str]]:
    """Return (missing_remote, missing_local, changed) key lists."""
    local_keys = set(local)
    remote_keys = set(remote)

    missing_remote = sorted(local_keys - remote_keys)   # in .env, not in vault
    missing_local = sorted(remote_keys - local_keys)    # in vault, not in .env
    changed = sorted(
        key for key in local_keys & remote_keys if local[key] != remote[key]
    )
    return missing_remote, missing_local, changed


@click.command(
    "run",
    context_settings={"ignore_unknown_options": True, "allow_extra_args": True},
)
@click.argument("command", nargs=-1, type=click.UNPROCESSED)
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
def run_command(command: tuple[str, ...], env_name: Optional[str], project: Optional[str]):
    """Run a command with the vault secrets injected as environment variables.

    Secrets are decrypted in memory and passed to the child process — nothing
    is written to disk. The child's exit code is propagated.

    \b
    Examples:
        criptenv run -- npm start
        criptenv run -e staging -- python manage.py migrate
    """
    if not command:
        raise click.ClickException("Missing command. Usage: criptenv run -- <command> [args]")

    entries = export_entries_remote(env_name, project)
    if not entries:
        click.echo("Warning: no secrets found for this environment.", err=True)

    child_env = dict(os.environ)
    child_env.update(entries)

    display = shlex.join(command)
    click.echo(f"→ {display}", err=True)

    try:
        completed = subprocess.run(list(command), env=child_env, check=False)
    except FileNotFoundError as exc:
        raise click.ClickException(f"Command not found: {command[0]}") from exc
    except KeyboardInterrupt:
        raise SystemExit(130)

    raise SystemExit(completed.returncode)


@click.command("diff")
@click.argument("file", required=False, type=click.Path(exists=True, dir_okay=False))
@click.option("--env", "-e", "env_name", default=None, help="Environment name or ID")
@click.option("--project", "-p", default=None, help="Project name or ID")
@click.option(
    "--show-values",
    is_flag=True,
    help="Include a masked preview of changed values (default: keys only)",
)
def diff_command(
    file: Optional[str],
    env_name: Optional[str],
    project: Optional[str],
    show_values: bool,
):
    """Compare a local .env file against the remote vault.

    Reports keys only present locally, only present remotely and changed
    values. Exits with status 1 when differences are found, so it can gate
    CI (drift detection).

    \b
    Examples:
        criptenv diff .env
        criptenv diff .env -e production
    """
    target = file or ".env"
    if not os.path.exists(target):
        raise click.ClickException(f"File not found: {target}")

    local = dict(_parse_env_file(target))
    remote = export_entries_remote(env_name, project)

    missing_remote, missing_local, changed = _diff_keys(local, remote)

    if not (missing_remote or missing_local or changed):
        click.echo("✓ No differences: local file matches the remote vault.")
        return

    if missing_remote:
        click.echo(click.style("Only local (missing in vault):", fg="yellow"))
        for key in missing_remote:
            click.echo(f"  + {key}")

    if missing_local:
        click.echo(click.style("Only in vault (missing locally):", fg="yellow"))
        for key in missing_local:
            click.echo(f"  - {key}")

    if changed:
        click.echo(click.style("Different values:", fg="yellow"))
        for key in changed:
            if show_values:
                click.echo(f"  ~ {key}  local={_mask(local[key])}  remote={_mask(remote[key])}")
            else:
                click.echo(f"  ~ {key}")

    total = len(missing_remote) + len(missing_local) + len(changed)
    click.echo(f"\n{total} difference(s) found.")
    raise SystemExit(1)


def _mask(value: str) -> str:
    """Never print secret values in full — only a length hint."""
    if not value:
        return "<empty>"
    if len(value) <= 4:
        return "*" * len(value)
    return f"{value[:2]}{'*' * (len(value) - 4)}{value[-2:]}"

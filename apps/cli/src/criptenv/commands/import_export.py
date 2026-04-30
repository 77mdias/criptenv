"""Import/export commands for .env files."""

import click
import json
import time
import uuid

from criptenv.context import cli_context, local_vault, run_async, _resolve_env_id
from criptenv.crypto import derive_env_key, encrypt, decrypt
from criptenv.crypto.utils import generate_id
from criptenv.vault import queries
from criptenv.vault.models import Secret


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

    with cli_context() as (db, master_key, _):
        if master_key is None:
            click.echo("Error: Run 'criptenv init' first", err=True)
            raise SystemExit(1)

        env_id = run_async(_resolve_env_id(db, env_name))
        env_key = derive_env_key(master_key, env_id)

        imported = 0
        skipped = 0

        for key, value in entries:
            # Check if exists
            existing = run_async(queries.get_secret(db, env_id, key))
            if existing and not overwrite:
                click.echo(f"  Skipped {key} (already exists, use --overwrite)")
                skipped += 1
                continue

            # Encrypt and save
            plaintext = value.encode("utf-8")
            ciphertext, iv, auth_tag, checksum = encrypt(plaintext, env_key)

            version = (existing.version + 1) if existing else 1
            secret = Secret(
                id=existing.id if existing else generate_id("sec"),
                environment_id=env_id,
                key_id=key,
                iv=iv,
                ciphertext=ciphertext,
                auth_tag=auth_tag,
                version=version,
                checksum=checksum,
                created_at=existing.created_at if existing else int(time.time()),
                updated_at=int(time.time()),
            )
            run_async(queries.save_secret(db, secret))
            imported += 1

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
    with cli_context() as (db, master_key, _):
        if master_key is None:
            click.echo("Error: Run 'criptenv init' first", err=True)
            raise SystemExit(1)

        env_id = run_async(_resolve_env_id(db, env_name))
        env_key = derive_env_key(master_key, env_id)

        secrets = run_async(queries.list_secrets(db, env_id))
        if not secrets:
            click.echo("No secrets to export.")
            return

        # Decrypt all secrets
        entries = {}
        for secret in secrets:
            try:
                plaintext = decrypt(
                    secret.ciphertext, secret.iv, secret.auth_tag,
                    env_key, secret.checksum
                )
                entries[secret.key_id] = plaintext.decode("utf-8")
            except Exception as e:
                click.echo(f"  Warning: Failed to decrypt {secret.key_id}: {e}", err=True)

    # Format output
    if fmt == "json":
        content = json.dumps(entries, indent=2)
    else:
        lines = [f"{key}={value}" for key, value in entries.items()]
        content = "\n".join(lines) + "\n"

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

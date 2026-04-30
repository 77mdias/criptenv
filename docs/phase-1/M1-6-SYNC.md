# M1.6: Sync & Utility Commands

**Milestone**: M1.6
**Duration**: Weeks 7-8
**Goal**: Cloud sync commands and utility commands (push, pull, doctor, import, export)
**Status**: ✅ COMPLETE (2026-04-30)

---

## Overview

Sync commands enable bidirectional sync between local vault and cloud. Utility commands provide diagnostic and migration tools.

---

## Sync Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      LOCAL VAULT                            │
│                  ~/.criptenv/vault.db                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Secrets (encrypted)                                 │   │
│  │ • key_id, iv, ciphertext, auth_tag, version         │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
        ┌──────────────┐            ┌──────────────┐
        │    PUSH     │            │    PULL      │
        │ local → cloud│           │ cloud → local│
        └──────────────┘            └──────────────┘
               │                           │
               └─────────────┬─────────────┘
                             │
                             ▼
                  ┌──────────────────┐
                  │   Backend API    │
                  │  /api/v1/.../vault│
                  └──────────────────┘
```

---

## Command: push

```bash
criptenv push
criptenv push --env staging
criptenv push --project "My Project" --env production
```

```python
# commands/sync.py

import click
import os

from criptenv.vault import queries
from criptenv.api.client import CriptEnvClient


@click.command(name="push")
@click.option("--env", "-e", default=None, help="Environment ID")
@click.option("--project", "-p", default=None, help="Project ID")
@click.option("--force", is_flag=True, help="Force overwrite remote")
def push(env: str, project: str, force: bool):
    """Push local secrets to cloud"""
    env_id = env or os.getenv("CRIPTENV_ENV") or "default"
    project_id = project or os.getenv("CRIPTENV_PROJECT")

    if not project_id:
        click.echo("Error: --project required or CRIPTENV_PROJECT not set", err=True)
        return

    try:
        import asyncio

        async def do_push():
            local_secrets = await queries.list_secrets(env_id)

            if not local_secrets:
                click.echo("No local secrets to push")
                return

            click.echo(f"Pushing {len(local_secrets)} secrets to cloud...")

            client = CriptEnvClient()
            remote_info = await client.get_vault_version(project_id, env_id)
            remote_version = remote_info.get("version", 0)

            if not force and remote_version > 0:
                click.echo(f"Warning: Remote has version {remote_version}")

            blobs = []
            for secret in local_secrets:
                blob = {
                    "key_id": secret.key_id,
                    "iv": secret.iv.hex(),
                    "ciphertext": secret.ciphertext.hex(),
                    "auth_tag": secret.auth_tag.hex(),
                    "version": secret.version,
                    "checksum": secret.checksum
                }
                blobs.append(blob)

            result = await client.push_vault(project_id, env_id, blobs)
            click.echo(f"Pushed {len(blobs)} secrets (version {result.get('version', '?')})")

        asyncio.run(do_push())

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
```

---

## Command: pull

```bash
criptenv pull
criptenv pull --env staging
criptenv pull --project "My Project" --env production
```

```python
@click.command(name="pull")
@click.option("--env", "-e", default=None, help="Environment ID")
@click.option("--project", "-p", default=None, help="Project ID")
@click.option("--force", is_flag=True, help="Force overwrite local")
def pull(env: str, project: str, force: bool):
    """Pull cloud secrets to local vault"""
    env_id = env or os.getenv("CRIPTENV_ENV") or "default"
    project_id = project or os.getenv("CRIPTENV_PROJECT")

    if not project_id:
        click.echo("Error: --project required or CRIPTENV_PROJECT not set", err=True)
        return

    try:
        import asyncio

        async def do_pull():
            click.echo(f"Pulling secrets from cloud for {env_id}...")

            client = CriptEnvClient()
            result = await client.pull_vault(project_id, env_id)
            remote_blobs = result.get("blobs", [])
            remote_version = result.get("version", 0)

            if not remote_blobs:
                click.echo("No secrets in cloud")
                return

            local_secrets = await queries.list_secrets(env_id)
            local_keys = {s.key_id: s for s in local_secrets}

            for blob in remote_blobs:
                key_id = blob["key_id"]

                if key_id in local_keys:
                    local = local_keys[key_id]
                    if local.version == blob["version"] and not force:
                        click.echo(f"Conflict: {key_id} (use --force to overwrite)")
                        continue

                import time
                from criptenv.vault import Secret

                secret = Secret(
                    id=f"sec_{key_id}",
                    environment_id=env_id,
                    key_id=key_id,
                    iv=bytes.fromhex(blob["iv"]),
                    ciphertext=bytes.fromhex(blob["ciphertext"]),
                    auth_tag=bytes.fromhex(blob["auth_tag"]),
                    version=blob["version"],
                    checksum=blob["checksum"],
                    created_at=int(time.time()),
                    updated_at=int(time.time())
                )

                await queries.save_secret(secret, b"")
                click.echo(f"Pulled {key_id}")

            click.echo(f"Pulled {len(remote_blobs)} secrets (version {remote_version})")

        asyncio.run(do_pull())

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
```

---

## Conflict Resolution

When push/pull detects conflicts:

```
┌─────────────────────────────────────────┐
│         CONFLICT DETECTED               │
├─────────────────────────────────────────┤
│ Secret: API_KEY                         │
│ Local version: 2                        │
│ Remote version: 3                       │
│                                         │
│ [1] Keep local (version 2)              │
│ [2] Keep remote (version 3)             │
│ [3] View diff                           │
│ [4] Keep both (rename local)            │
│                                         │
│ Select: _
```

---

## Command: doctor

```bash
criptenv doctor
```

```python
# commands/doctor.py

import click
import os
import sys

from criptenv.config import CONFIG_DIR, DB_FILE, API_BASE_URL


@click.command(name="doctor")
def doctor():
    """Run diagnostics on CriptEnv installation"""
    click.echo("Running diagnostics...\n")

    issues = []
    warnings = []

    # Check config directory
    if CONFIG_DIR.exists():
        click.echo(f"✓ Config directory: {CONFIG_DIR}")
    else:
        click.echo(f"✗ Config directory missing: {CONFIG_DIR}")
        issues.append("Config directory not initialized")

    # Check vault database
    if DB_FILE.exists():
        size = DB_FILE.stat().st_size
        click.echo(f"✓ Vault database: {DB_FILE} ({size} bytes)")
    else:
        click.echo(f"✗ Vault database missing: {DB_FILE}")
        issues.append("Vault not initialized (run 'criptenv init')")

    # Check Python version
    version = sys.version_info
    if version.major >= 3 and version.minor >= 10:
        click.echo(f"✓ Python: {version.major}.{version.minor}.{version.micro}")
    else:
        click.echo(f"✗ Python: {version.major}.{version.minor}.{version.micro} (need 3.10+)")
        issues.append("Python version too old")

    # Check API URL
    if os.getenv("CRIPTENV_API_URL"):
        click.echo(f"✓ API URL: {os.getenv('CRIPTENV_API_URL')}")
    else:
        click.echo(f"⚠ API URL: not set (using default: {API_BASE_URL})")
        warnings.append("Using default API URL")

    # Check master salt
    if CONFIG_DIR.exists():
        import asyncio

        async def check_salt():
            from criptenv.vault import queries
            salt = await queries.get_config("master_salt")
            return salt is not None

        has_salt = asyncio.run(check_salt())
        if has_salt:
            click.echo("✓ Master password: configured")
        else:
            click.echo("⚠ Master password: not set (run 'criptenv init')")
            warnings.append("Master password not set")

    # Check API connectivity
    try:
        import httpx
        import asyncio

        async def check_api():
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(f"{API_BASE_URL}/docs", timeout=5.0)
                    return response.status_code == 200
                except:
                    return False

        api_ok = asyncio.run(check_api())
        if api_ok:
            click.echo(f"✓ API server: reachable at {API_BASE_URL}")
        else:
            click.echo(f"✗ API server: not reachable at {API_BASE_URL}")
            issues.append("API server unreachable")

    except Exception as e:
        click.echo(f"✗ API check failed: {e}")
        issues.append("API server unreachable")

    # Summary
    click.echo("\n" + "=" * 40)
    if not issues and not warnings:
        click.echo("✓ All checks passed!")
    elif not issues:
        click.echo(f"⚠ {len(warnings)} warning(s)")
    else:
        click.echo(f"✗ {len(issues)} issue(s) found")
        for issue in issues:
            click.echo(f"  - {issue}")
```

---

## Command: import

```bash
criptenv import .env
criptenv import .env --env staging
criptenv import production.env --env production
```

```python
# commands/import_export.py

import click
from pathlib import Path
import python_dotenv


@click.command(name="import")
@click.argument("file", type=click.Path(exists=True))
@click.option("--env", "-e", default=None, help="Target environment")
@click.option("--prefix", "-p", default="", help="Prefix keys (e.g., MYAPP_)")
@click.option("--force", is_flag=True, help="Overwrite existing secrets")
def import_env(file: str, env: str, prefix: str, force: bool):
    """Import secrets from .env file"""
    env_id = env or os.getenv("CRIPTENV_ENV") or "default"

    try:
        env_vars = python_dotenv.dotenv_values(file)

        if not env_vars:
            click.echo(f"No variables found in {file}")
            return

        count = 0
        skipped = 0

        import asyncio

        async def do_import():
            nonlocal count, skipped
            from criptenv.vault import queries

            for key, value in env_vars.items():
                full_key = f"{prefix}{key}" if prefix else key

                secrets = await queries.list_secrets(env_id)
                exists = any(s.key_id == full_key for s in secrets)

                if exists and not force:
                    skipped += 1
                    continue

                click.echo(f"Importing {full_key}...")
                count += 1

        asyncio.run(do_import())
        click.echo(f"\nImported {count} secrets ({skipped} skipped)")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
```

---

## Command: export

```bash
criptenv export
criptenv export --env staging
criptenv export --project "My Project" > .env
```

```python
@click.command(name="export")
@click.option("--env", "-e", default=None, help="Source environment")
@click.option("--project", "-p", default=None, help="Project ID")
@click.option("--prefix", "-p", default="", help="Prefix keys")
@click.option("--output", "-o", default=None, help="Output file (stdout if not specified)")
def export_env(env: str, project: str, prefix: str, output: str):
    """Export secrets to .env file format"""
    env_id = env or os.getenv("CRIPTENV_ENV") or "default"

    try:
        import asyncio

        async def do_export():
            from criptenv.vault import queries
            secrets = await queries.list_secrets(env_id)

            if not secrets:
                click.echo("# No secrets found")
                return

            lines = []
            for s in secrets:
                key = f"{prefix}{s.key_id}"
                lines.append(f"{key}=")

            return "\n".join(lines)

        result = asyncio.run(do_export())

        if output:
            Path(output).write_text(result)
            click.echo(f"Exported to {output}")
        else:
            click.echo(result)

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
```

---

## Verification

```bash
# Test sync commands
criptenv doctor

# Create some secrets
criptenv set TEST=value --project "Test"
criptenv list --project "Test"

# Push to cloud
criptenv push --project "Test"

# Pull back
criptenv pull --project "Test"
criptenv list --project "Test"

# Test import/export
echo "API_KEY=secret123" > /tmp/test.env
criptenv import /tmp/test.env --project "Test"
criptenv export --project "Test"
```

---

**Previous**: [M1-5-CORE-COMMANDS.md](M1-5-CORE-COMMANDS.md)
**Next**: [M1-IMPLEMENTATION-PLAN.md](../M1-IMPLEMENTATION-PLAN.md) (Return to main plan)

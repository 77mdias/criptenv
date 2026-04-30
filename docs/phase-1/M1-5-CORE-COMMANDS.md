# M1.5: Core Commands

**Milestone**: M1.5
**Duration**: Weeks 5-6
**Goal**: Complete MVP command set (set, get, list, delete)
**Status**: ✅ COMPLETE (2026-04-30)

---

## Overview

Core commands are the primary user-facing operations: managing secrets locally and syncing with the cloud.

---

## Command: set

```bash
criptenv set KEY=value
criptenv set KEY=value --env staging
criptenv set API_KEY=secret123 --project "My Project"
```

---

## Secrets Module: commands/secrets.py

```python
"""Secret management commands"""

import click
import os
import getpass

from criptenv.crypto import derive_master_key, derive_env_key, encrypt, decrypt, generate_key_id
from criptenv.vault import queries, Secret
import time


def _get_master_key() -> bytes:
    """Get master key from password"""
    salt_hex = os.getenv("CRIPTENV_MASTER_SALT")
    if not salt_hex:
        import asyncio
        salt_hex = asyncio.run(queries.get_config("master_salt"))

    if not salt_hex:
        raise ValueError("Run 'criptenv init' first")

    password = getpass.getpass("Master password: ")
    return derive_master_key(password, bytes.fromhex(salt_hex))


@click.group(name="secrets")
def secrets_group():
    """Manage secrets"""
    pass


@secrets_group.command(name="set")
@click.argument("key_value")
@click.option("--env", "-e", default=None)
@click.option("--project", "-p", default=None)
def set_secret(key_value: str, env: str, project: str):
    """Set a secret (KEY=value)"""
    if "=" not in key_value:
        click.echo("Error: Must be KEY=value", err=True)
        return

    key_id, value = key_value.split("=", 1)
    env_id = env or os.getenv("CRIPTENV_ENV") or "default"

    try:
        master_key = _get_master_key()
        env_key = derive_env_key(master_key, env_id)

        plaintext = value.encode()
        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, env_key)

        secret = Secret(
            id=f"sec_{generate_key_id()}",
            environment_id=env_id,
            key_id=key_id,
            iv=iv,
            ciphertext=ciphertext,
            auth_tag=auth_tag,
            version=1,
            checksum=checksum,
            created_at=int(time.time()),
            updated_at=int(time.time())
        )

        import asyncio
        asyncio.run(queries.save_secret(secret, env_key))
        click.echo(f"Set {key_id}")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@secrets_group.command(name="get")
@click.argument("key_id")
@click.option("--env", "-e", default=None)
def get_secret(key_id: str, env: str):
    """Get a secret value"""
    env_id = env or os.getenv("CRIPTENV_ENV") or "default"

    try:
        master_key = _get_master_key()
        env_key = derive_env_key(master_key, env_id)

        import asyncio

        async def fetch_and_decrypt():
            secrets = await queries.list_secrets(env_id)
            for s in secrets:
                if s.key_id == key_id:
                    plaintext = decrypt(s.ciphertext, s.iv, s.auth_tag, env_key, s.checksum)
                    return plaintext.decode()
            click.echo(f"Secret '{key_id}' not found", err=True)
            return None

        value = asyncio.run(fetch_and_decrypt())
        if value:
            click.echo(value)

    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@secrets_group.command(name="list")
@click.option("--env", "-e", default=None)
@click.option("--project", "-p", default=None)
def list_secrets(env: str, project: str):
    """List secrets (names only)"""
    env_id = env or os.getenv("CRIPTENV_ENV") or "default"

    try:
        import asyncio

        async def fetch():
            return await queries.list_secrets(env_id)

        secrets = asyncio.run(fetch())

        if not secrets:
            click.echo("No secrets")
            return

        click.echo(f"Secrets in {env_id}:")
        for s in secrets:
            click.echo(f"  {s.key_id} (v{s.version})")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@secrets_group.command(name="delete")
@click.argument("key_id")
@click.option("--env", "-e", default=None)
@click.option("--force", is_flag=True)
def delete_secret(key_id: str, env: str, force: bool):
    """Delete a secret"""
    if not force:
        if not click.confirm(f"Delete '{key_id}'?"):
            return

    env_id = env or os.getenv("CRIPTENV_ENV") or "default"

    try:
        import asyncio

        async def remove():
            secrets = await queries.list_secrets(env_id)
            for s in secrets:
                if s.key_id == key_id:
                    await queries.delete_secret(s.id)
                    return True
            return False

        deleted = asyncio.run(remove())
        if deleted:
            click.echo(f"Deleted {key_id}")
        else:
            click.echo(f"Secret '{key_id}' not found", err=True)

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
```

---

## Environment Commands: commands/environments.py

```bash
criptenv env list
criptenv env list --project "My Project"
criptenv env create staging
criptenv env create production --project "My Project"
```

```python
"""Environment management commands"""

import click
import os

from criptenv.api.client import CriptEnvClient


@click.group(name="env")
def env_group():
    """Manage environments"""
    pass


@env_group.command(name="list")
@click.option("--project", "-p", default=None)
def list_environments(project: str):
    """List environments"""
    if not project:
        project = os.getenv("CRIPTENV_PROJECT")

    if not project:
        click.echo("Error: --project required or CRIPTENV_PROJECT not set", err=True)
        return

    try:
        import asyncio

        async def fetch():
            client = CriptEnvClient()
            response = await client.list_environments(project)
            return response

        result = asyncio.run(fetch())
        # Parse and display environments

    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@env_group.command(name="create")
@click.argument("name")
@click.option("--project", "-p", default=None)
def create_environment(name: str, project: str):
    """Create a new environment"""
    if not project:
        project = os.getenv("CRIPTENV_PROJECT")

    if not project:
        click.echo("Error: --project required or CRIPTENV_PROJECT not set", err=True)
        return

    try:
        import asyncio

        async def create():
            client = CriptEnvClient()
            response = await client.create_environment(project, name)
            return response

        result = asyncio.run(create())
        click.echo(f"Created environment '{name}'")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
```

---

## Verification

```bash
# Setup
criptenv init
criptenv login --email test@test.com --password testpass123

# Test commands
criptenv set API_KEY=secret123 --project "Test"
criptenv list --project "Test"
criptenv get API_KEY
criptenv delete API_KEY --force
```

---

**Previous**: [M1-4-AUTH.md](M1-4-AUTH.md)
**Next**: [M1-6-SYNC.md](M1-6-SYNC.md)

# M1.1: CLI Scaffolding

**Milestone**: M1.1
**Duration**: Week 1
**Goal**: CLI skeleton with all commands returning proper output
**Status**: ✅ COMPLETE (2026-04-30)

---

## Overview

Create the CLI project structure with Click framework. All commands should return proper output (even if not yet functional).

---

## Tasks

### 1.1.1 Create Project Structure

Create `apps/cli/pyproject.toml`:

```toml
[project]
name = "criptenv"
version = "0.1.0"
description = "Zero-Knowledge secret management CLI"
requires-python = ">=3.10"
dependencies = [
    "click>=8.1.0",
    "cryptography>=42.0.0",
    "httpx>=0.27.0",
    "aiosqlite>=0.20.0",
    "python-dotenv>=1.0.0",
]

[project.scripts]
criptenv = "criptenv.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

Create directory structure:

```
apps/cli/src/criptenv/
apps/cli/tests/
```

### 1.1.2 CLI Entry Point

Create `apps/cli/src/criptenv/cli.py`:

```python
import click
from criptenv.commands import init, login, secrets, sync, environments, doctor, import_export

@click.group()
@click.version_option(version="0.1.0")
def main():
    """CriptEnv - Zero-Knowledge secret management"""
    pass

# Register command groups
main.add_command(init.init_group)
main.add_command(login.login_group)
main.add_command(secrets.secrets_group)
main.add_command(sync.sync_group)
main.add_command(environments.env_group)
main.add_command(doctor.doctor_group)
main.add_command(import_export.import_group)
main.add_command(import_export.export_group)

if __name__ == "__main__":
    main()
```

### 1.1.3 Create Command Modules

Each command module follows this pattern:

```python
# apps/cli/src/criptenv/commands/init.py
import click

@click.command(name="init")
def init_command():
    """Initialize CriptEnv configuration"""
    click.echo("Initialized ~/.criptenv/")

@click.group(name="init")
def init_group():
    """Initialize project"""
    pass

init_group.add_command(init_command)
```

Commands to create:

- [x] `init.py` - `criptenv init` ✅
- [x] `login.py` - `criptenv login` / `logout` ✅
- [x] `secrets.py` - `criptenv set`, `get`, `list`, `delete` ✅
- [x] `sync.py` - `criptenv push`, `pull` ✅
- [x] `environments.py` - `criptenv env list`, `env create` ✅
- [x] `projects.py` - `criptenv projects list` ✅
- [x] `doctor.py` - `criptenv doctor` ✅
- [x] `import_export.py` - `criptenv import`, `export` ✅

### 1.1.4 Config Management

Create `apps/cli/src/criptenv/config.py`:

```python
from pathlib import Path
import os

CONFIG_DIR = Path.home() / ".criptenv"
CONFIG_FILE = CONFIG_DIR / "config.toml"
DB_FILE = CONFIG_DIR / "vault.db"
API_BASE_URL = os.getenv("CRIPTENV_API_URL", "http://localhost:8000")

def ensure_config_dir():
    CONFIG_DIR.mkdir(exist_ok=True)
```

---

## Verification

```bash
cd apps/cli
pip install -e .
criptenv --help

# Expected output:
# Usage: criptenv [OPTIONS] COMMAND [ARGS]...
#
# Options:
#   --version  Show the version and exit.
#   --help     Show this message and exit.
#
# Commands:
#   init
#   login
#   set
#   get
#   list
#   delete
#   push
#   pull
#   env
#   doctor
#   import
#   export
```

---

## Files Created

| File                                              | Status |
| ------------------------------------------------- | ------ |
| `apps/cli/pyproject.toml`                         | ✅     |
| `apps/cli/src/criptenv/__init__.py`               | ✅     |
| `apps/cli/src/criptenv/cli.py`                    | ✅     |
| `apps/cli/src/criptenv/config.py`                 | ✅     |
| `apps/cli/src/criptenv/context.py`                | ✅     |
| `apps/cli/src/criptenv/session.py`                | ✅     |
| `apps/cli/src/criptenv/commands/__init__.py`      | ✅     |
| `apps/cli/src/criptenv/commands/init.py`          | ✅     |
| `apps/cli/src/criptenv/commands/login.py`         | ✅     |
| `apps/cli/src/criptenv/commands/secrets.py`       | ✅     |
| `apps/cli/src/criptenv/commands/sync.py`          | ✅     |
| `apps/cli/src/criptenv/commands/environments.py`  | ✅     |
| `apps/cli/src/criptenv/commands/projects.py`      | ✅     |
| `apps/cli/src/criptenv/commands/doctor.py`        | ✅     |
| `apps/cli/src/criptenv/commands/import_export.py` | ✅     |
| `apps/cli/tests/__init__.py`                      | ✅     |
| `apps/cli/tests/conftest.py`                      | ✅     |

---

**Previous**: [M1-IMPLEMENTATION-PLAN.md](../M1-IMPLEMENTATION-PLAN.md)
**Next**: [M1-2-ENCRYPTION.md](M1-2-ENCRYPTION.md)

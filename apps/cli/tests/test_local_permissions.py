"""Local vault file permissions.

The CLI stores encrypted secrets, CI sessions and the local auth key under
~/.criptenv. The directory and database used to be created with the default
umask (0755/0644), leaving them readable by every local user.
"""

import os
import stat

import pytest

from criptenv import config
from criptenv.vault import database


def _mode(path) -> int:
    return stat.S_IMODE(os.stat(path).st_mode)


@pytest.mark.asyncio
async def test_vault_directory_and_db_are_owner_only(tmp_path, monkeypatch):
    config_dir = tmp_path / "criptenv"
    db_file = config_dir / "vault.db"

    monkeypatch.setattr(database, "CONFIG_DIR", config_dir)
    monkeypatch.setattr(database, "DB_FILE", db_file)

    db = await database.get_db()
    try:
        await database.init_schema(db)
    finally:
        await database.close_db(db)

    assert config_dir.exists()
    assert db_file.exists()
    assert _mode(config_dir) == 0o700
    assert _mode(db_file) == 0o600


def test_ensure_config_dir_restricts_permissions(tmp_path, monkeypatch):
    config_dir = tmp_path / "criptenv"
    monkeypatch.setattr(config, "CONFIG_DIR", config_dir)

    returned = config.ensure_config_dir()

    assert returned == config_dir
    assert _mode(config_dir) == 0o700

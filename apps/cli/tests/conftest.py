"""Shared test fixtures for CriptEnv CLI tests."""

import pytest
import tempfile
from pathlib import Path


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test isolation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_config_dir(temp_dir, monkeypatch):
    """Override CONFIG_DIR and DB_FILE to use a temporary directory.

    Patches both the config module AND the database module since
    database.py imports DB_FILE directly at module level.
    """
    monkeypatch.setattr("criptenv.config.CONFIG_DIR", temp_dir)
    monkeypatch.setattr("criptenv.config.DB_FILE", temp_dir / "vault.db")
    monkeypatch.setattr("criptenv.config.CONFIG_FILE", temp_dir / "config.toml")
    # Also patch the local bindings in database.py
    monkeypatch.setattr("criptenv.vault.database.CONFIG_DIR", temp_dir)
    monkeypatch.setattr("criptenv.vault.database.DB_FILE", temp_dir / "vault.db")
    return temp_dir

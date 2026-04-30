"""Configuration management for CriptEnv CLI"""

import os
from pathlib import Path

# Paths
CONFIG_DIR = Path.home() / ".criptenv"
CONFIG_FILE = CONFIG_DIR / "config.toml"
DB_FILE = CONFIG_DIR / "vault.db"

# API configuration
API_BASE_URL = os.getenv("CRIPTENV_API_URL", "http://localhost:8000")

# Crypto defaults
PBKDF2_ITERATIONS = 100_000
SALT_LENGTH = 32
IV_LENGTH = 12
KEY_LENGTH = 32  # 256 bits
AUTH_TAG_LENGTH = 16


def ensure_config_dir() -> Path:
    """Ensure ~/.criptenv/ directory exists and return its path."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return CONFIG_DIR


def get_project_config_path(project_dir: Path | None = None) -> Path:
    """Get the .criptenv config file path for a project."""
    base = project_dir or Path.cwd()
    return base / ".criptenv"

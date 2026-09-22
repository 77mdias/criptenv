"""Configuration management for CriptEnv CLI"""

import os
from pathlib import Path

# Paths
CONFIG_DIR = Path.home() / ".criptenv"
CONFIG_FILE = CONFIG_DIR / "config.toml"
DB_FILE = CONFIG_DIR / "vault.db"
AUTH_KEY_FILE = CONFIG_DIR / "auth.key"

# API configuration
API_BASE_URL = os.getenv("CRIPTENV_API_URL", "https://criptenv-api.77mdevseven.tech")

# Crypto defaults
PBKDF2_ITERATIONS = 100_000
SALT_LENGTH = 32
IV_LENGTH = 12
KEY_LENGTH = 32  # 256 bits
AUTH_TAG_LENGTH = 16


def ensure_config_dir() -> Path:
    """Ensure ~/.criptenv/ directory exists and return its path.

    The directory holds the encrypted vault, CI sessions and the local auth key,
    so it is restricted to the owner.
    """
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(CONFIG_DIR, 0o700)
    except OSError:
        pass
    return CONFIG_DIR


def get_project_config_path(project_dir: Path | None = None) -> Path:
    """Get the .criptenv config file path for a project."""
    base = project_dir or Path.cwd()
    return base / ".criptenv"

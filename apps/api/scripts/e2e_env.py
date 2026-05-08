from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse


API_ROOT = Path(__file__).resolve().parents[1]


def load_e2e_env() -> Path:
    env_path = API_ROOT / ".env.test"
    if not env_path.exists():
        env_path = API_ROOT / ".env.test.example"

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip().strip("'\"")

    database_url = os.environ.get("DATABASE_URL", "")
    _assert_safe_database_url(database_url)
    return env_path


def _assert_safe_database_url(database_url: str) -> None:
    parsed = urlparse(database_url)
    host = parsed.hostname or ""
    db_name = parsed.path.rsplit("/", 1)[-1]

    if host not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("Refusing to run E2E against a non-local database host.")

    if "test" not in db_name:
        raise RuntimeError("Refusing to run E2E against a database without 'test' in its name.")

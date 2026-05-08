from __future__ import annotations

import asyncio
from pathlib import Path
import sys

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from scripts.e2e_env import load_e2e_env

load_e2e_env()

from app.database import Base, engine
from app.models import (  # noqa: F401
    APIKey,
    AuditLog,
    CIToken,
    CISession,
    Environment,
    Project,
    ProjectInvite,
    ProjectMember,
    Session,
    User,
    VaultBlob,
)
from app.models.integration import Integration  # noqa: F401
from app.models.oauth_account import OAuthAccount  # noqa: F401
from app.models.secret_expiration import SecretExpiration, SecretRotation  # noqa: F401


async def reset_database() -> None:
    for attempt in range(1, 31):
        try:
            async with engine.begin() as conn:
                await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
                await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "citext"'))
                await conn.run_sync(Base.metadata.drop_all)
                await conn.run_sync(Base.metadata.create_all)
            break
        except (ConnectionError, ConnectionResetError, OSError, OperationalError):
            if attempt == 30:
                raise
            await asyncio.sleep(1)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset_database())
    print("E2E database reset complete.")

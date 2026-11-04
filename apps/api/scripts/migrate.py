"""Bring the database to the Alembic head, bootstrapping a blank one first.

The migration chain starts from an already-existing schema (the first
revision references ``projects`` and ``ci_tokens``), so ``alembic upgrade
head`` cannot build a database from nothing. A blank database is created from
the models and stamped at head instead, Alembic's documented recipe for new
databases. Any other database gets a normal ``upgrade head``.

Run by the API image entrypoint: ``python scripts/migrate.py``.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

import app.models  # noqa: E402,F401 - registers every table on Base.metadata
from app.database import Base, engine  # noqa: E402

# api and scheduler start from the same image at the same time; this
# serializes their migrations. Arbitrary constant, never change it.
MIGRATION_LOCK_ID = 727_165_340


def _alembic_config() -> Config:
    config = Config(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "migrations"))
    return config


async def migrate() -> None:
    async with engine.connect() as lock_conn:
        # Session-level lock: survives the commit below; released when the
        # connection is closed by engine.dispose() (or the process exits).
        await lock_conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": MIGRATION_LOCK_ID})
        users_table = await lock_conn.scalar(text("SELECT to_regclass('public.users')"))
        await lock_conn.commit()  # hold no transaction while DDL runs on other connections

        if users_table is None:
            print("[migrate] Blank database: creating schema from models and stamping head.")
            async with engine.begin() as conn:
                await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
                await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "citext"'))
                await conn.run_sync(Base.metadata.create_all)
            alembic_command = command.stamp
        else:
            alembic_command = command.upgrade

        # Alembic's env.py starts its own event loop, so run it on a thread without one.
        await asyncio.to_thread(alembic_command, _alembic_config(), "head")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())

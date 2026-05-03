#!/usr/bin/env python3
"""
Initialize production database from scratch.

Usage:
    cd apps/api
    export DATABASE_URL="postgresql://..."
    python ../../scripts/init_production_db.py

This script:
1. Creates all tables from SQLAlchemy models (Base.metadata.create_all)
2. Stamps Alembic as 'head' so future migrations work correctly
"""

import asyncio
import sys
import os

# Add apps/api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "api"))

from app.database import init_db, engine, close_db
from app.config import settings


async def create_tables():
    print("Creating all tables from SQLAlchemy models...")
    await init_db()
    print("✅ Tables created successfully!")


async def stamp_alembic():
    """Mark current Alembic revision as applied without running migrations."""
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config("alembic.ini")
    command.stamp(alembic_cfg, "head")
    print("✅ Alembic stamped to head!")


async def main():
    if not settings.DATABASE_URL:
        print("❌ DATABASE_URL not set!")
        sys.exit(1)

    print(f"Using database: {settings.DATABASE_URL.replace(settings.DATABASE_URL.split('@')[0], '***')}")

    try:
        await create_tables()
        await close_db()
        await stamp_alembic()
        print("\n🎉 Database initialized successfully!")
        print("You can now deploy your API.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

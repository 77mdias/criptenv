#!/usr/bin/env python3
"""
Initialize production database from scratch.

Usage:
    cd apps/api
    export DATABASE_URL="postgresql://..."
    python ../../scripts/init_production_db.py
    alembic stamp head
"""

import asyncio
import sys
import os

# Add apps/api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "api"))

# IMPORTANT: Import ALL models first so they register with Base.metadata
from app.models import (
    User, Session, Project, Environment, VaultBlob,
    ProjectMember, ProjectInvite, CIToken, CISession,
    AuditLog, APIKey
)
# Import these too (not in __init__ but still need to register)
from app.models.oauth_account import OAuthAccount
from app.models.integration import Integration
from app.models.secret_expiration import SecretExpiration

from app.database import init_db, close_db, engine
from app.config import settings
from sqlalchemy import text


async def create_tables():
    print("Creating citext extension...")
    async with engine.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "citext"'))
    
    print("Creating all tables from SQLAlchemy models...")
    await init_db()
    print("✅ Tables created successfully!")


async def main():
    if not settings.DATABASE_URL:
        print("❌ DATABASE_URL not set!")
        sys.exit(1)

    print(f"Using database: {settings.async_database_url.replace(settings.DATABASE_URL.split('@')[0], '***')}")
    print(f"Registered tables: {list(User.metadata.tables.keys())}")

    try:
        await create_tables()
        await close_db()
        print("\n🎉 Tables created!")
        print("\n👉 Agora rode: alembic stamp head")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

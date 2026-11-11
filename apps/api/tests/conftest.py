import os
import sys
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/test")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("INTEGRATION_CONFIG_SECRET", "test-integration-config-secret-32-chars")
os.environ.setdefault("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token")
os.environ.setdefault("MERCADO_PAGO_WEBHOOK_SECRET", "test-webhook-secret")
os.environ["DEBUG"] = "true"
# Billing is off in tests unless a test turns it on: a developer's local .env must not decide that.
os.environ["BILLING_ENABLED"] = "false"
os.environ["BILLING_NOTIFY_EMAIL"] = ""


import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy.dialects.postgresql import CITEXT, JSONB  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402


@compiles(CITEXT, "sqlite")
def _compile_citext_sqlite(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"


# In-memory SQLite with the real schema, for tests whose point is what the database holds.


@pytest_asyncio.fixture
async def factory():
    pytest.importorskip("aiosqlite")
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    import main  # noqa: F401  (registers every model on Base.metadata)
    from app.database import Base

    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(factory):
    async with factory() as db:
        yield db


@pytest_asyncio.fixture
async def client(factory):
    """HTTP client on the in-memory database. Tests pick the user through dependency_overrides."""
    from httpx import ASGITransport, AsyncClient

    from app.database import get_db
    from app.middleware.auth import get_current_user, get_current_web_user
    from main import app

    async def _get_db():
        async with factory() as db:
            try:
                yield db
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    app.dependency_overrides[get_db] = _get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_web_user, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def _reset_rate_limit_counters():
    """The in-memory limiter is a module-level dict; without a reset, request
    counts leak across tests and late HTTP tests get 429s depending on order."""
    from app.middleware import rate_limit

    rate_limit._rate_limit_storage.clear()
    yield

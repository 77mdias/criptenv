from pydantic_settings import BaseSettings
from typing import List
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
import json


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    SESSION_EXPIRE_DAYS: int = 30
    CORS_ORIGINS: str = "http://localhost:3000"
    APP_ENV: str = "development"
    DEBUG: bool = True
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_TIMEOUT: int = 10

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS from comma-separated string or JSON."""
        val = self.CORS_ORIGINS.strip()
        if val.startswith("["):
            try:
                return json.loads(val)
            except json.JSONDecodeError:
                pass
        return [origin.strip() for origin in val.split(",") if origin.strip()]

    @property
    def async_database_url(self) -> str:
        """Convert to asyncpg URL, stripping Prisma-only params like pgbouncer."""
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Remove pgbouncer=true (Prisma-only, not supported by asyncpg)
        parsed = urlparse(url)
        if parsed.query:
            params = parse_qs(parsed.query, keep_blank_values=True)
            params.pop("pgbouncer", None)
            params.pop("schema", None)
            new_query = urlencode(params, doseq=True)
            url = urlunparse(parsed._replace(query=new_query))

        return url


settings = Settings()

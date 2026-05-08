from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Any, List
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
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_STORAGE: str = "memory"
    REDIS_URL: str = ""
    INTEGRATION_CONFIG_SECRET: str = ""
    SCHEDULER_ENABLED: bool = True
    SCHEDULER_INTERVAL_HOURS: int = 24
    
    # API URL for OAuth callbacks
    API_URL: str = "http://localhost:8000"
    
    # Frontend URL for OAuth redirect after callback
    FRONTEND_URL: str = "http://localhost:3000"
    
    # OAuth Provider Credentials
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    DISCORD_CLIENT_ID: str = ""
    DISCORD_CLIENT_SECRET: str = ""

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value: Any) -> Any:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"dev", "development", "debug"}:
                return True
        return value

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

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

        # Remove Prisma/Supabase pooler-only params not supported by asyncpg
        parsed = urlparse(url)
        if parsed.query:
            params = parse_qs(parsed.query, keep_blank_values=True)
            params.pop("pgbouncer", None)
            params.pop("schema", None)
            params.pop("sslmode", None)
            params.pop("sslcert", None)
            params.pop("sslkey", None)
            params.pop("sslrootcert", None)
            new_query = urlencode(params, doseq=True)
            url = urlunparse(parsed._replace(query=new_query))

        return url


settings = Settings()

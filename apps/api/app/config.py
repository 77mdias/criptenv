from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from typing import Any, List
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
import json

# Environments treated as production for security defaults.
PRODUCTION_ENVIRONMENTS = frozenset({"production", "prod", "release"})


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    SESSION_EXPIRE_DAYS: int = 30
    SESSION_MAX_ACTIVE: int = 5
    SESSION_INACTIVITY_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:3000"
    APP_ENV: str = "development"
    # Secure by default: DEBUG governs the cookie `Secure` flag and whether the
    # API docs and one-time development tokens are exposed, so a deployment that
    # forgets to set it must not silently turn those on.
    DEBUG: bool = False
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_TIMEOUT: int = 10
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_STORAGE: str = "memory"
    # Comma-separated addresses whose X-Forwarded-For we trust (the reverse
    # proxy / tunnel in front of the API). Requests from any other peer have
    # their forwarded headers ignored, so a client cannot spoof its own IP.
    TRUSTED_PROXIES: str = "127.0.0.1,::1"
    REDIS_URL: str = ""
    INTEGRATION_CONFIG_SECRET: str = ""
    SCHEDULER_ENABLED: bool = True
    SCHEDULER_INTERVAL_HOURS: int = 24
    
    # API URL for OAuth callbacks
    API_URL: str = "http://localhost:8000"
    
    # Frontend URL for OAuth redirect after callback
    FRONTEND_URL: str = "https://criptenv.77mdevseven.tech"
    
    # ===========================================
    # MERCADO PAGO (CONTRIBUTIONS / PAYMENTS)
    # ===========================================
    MERCADO_PAGO_ACCESS_TOKEN: str = ""
    MERCADO_PAGO_PUBLIC_KEY: str = ""
    MERCADO_PAGO_WEBHOOK_SECRET: str = ""
    MERCADO_PAGO_BASE_URL: str = "https://api.mercadopago.com"
    PAYMENTS_ENABLED: bool = True
    PAYMENTS_ENV: str = "sandbox"
    
    # OAuth Provider Credentials
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    DISCORD_CLIENT_ID: str = ""
    DISCORD_CLIENT_SECRET: str = ""
    
    # ===========================================
    # EMAIL (RESEND)
    # ===========================================
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "admin@77mdevseven.tech"
    
    # ===========================================
    # AVATAR STORAGE
    # ===========================================
    AVATAR_STORAGE_BACKEND: str = "supabase"
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_AVATAR_BUCKET: str = "avatars"
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = "criptenv-avatars"
    R2_PUBLIC_URL: str = ""

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

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        """Fail fast on combinations that silently weaken security."""
        if self.is_production and self.DEBUG:
            raise ValueError(
                "DEBUG must be false when APP_ENV is production: it disables the "
                "Secure cookie flag, serves the API docs and enables development "
                "token fallbacks."
            )

        if "*" in self.cors_origins_list:
            raise ValueError(
                "CORS_ORIGINS must not contain '*': the API allows credentials, so "
                "a wildcard would let any origin issue credentialed requests. List "
                "the allowed origins explicitly."
            )

        return self

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.strip().lower() in PRODUCTION_ENVIRONMENTS

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
    def trusted_proxies_set(self) -> set[str]:
        """Addresses allowed to assert X-Forwarded-For on behalf of a client."""
        return {item.strip() for item in self.TRUSTED_PROXIES.split(",") if item.strip()}

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

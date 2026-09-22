"""Security-relevant configuration validation.

CR-P2-17 / CR-P2-19: insecure defaults and misconfigurations must fail fast
instead of silently disabling the Secure cookie flag or opening CORS.
"""

import pytest
from pydantic import ValidationError

from app.config import Settings


def _settings(**overrides) -> Settings:
    base = {"DATABASE_URL": "postgresql://user:pass@localhost:5432/db", "SECRET_KEY": "x" * 32}
    base.update(overrides)
    return Settings(**base)


def test_debug_defaults_to_false():
    """A deployment that forgets to set DEBUG must not become a debug server."""
    assert Settings.model_fields["DEBUG"].default is False


def test_debug_true_is_rejected_in_production():
    with pytest.raises(ValidationError) as exc:
        _settings(APP_ENV="production", DEBUG=True)

    assert "DEBUG must be false" in str(exc.value)


@pytest.mark.parametrize("app_env", ["production", "prod", "release"])
def test_debug_rejected_for_every_production_alias(app_env):
    with pytest.raises(ValidationError):
        _settings(APP_ENV=app_env, DEBUG=True)


def test_debug_true_allowed_in_development():
    assert _settings(APP_ENV="development", DEBUG=True).DEBUG is True


def test_wildcard_cors_is_rejected():
    """allow_credentials=True makes a wildcard origin unsafe."""
    with pytest.raises(ValidationError) as exc:
        _settings(CORS_ORIGINS="*")

    assert "CORS_ORIGINS must not contain" in str(exc.value)


def test_wildcard_cors_rejected_inside_a_list():
    with pytest.raises(ValidationError):
        _settings(CORS_ORIGINS="https://app.example.com,*")


def test_explicit_cors_origins_are_accepted():
    settings = _settings(CORS_ORIGINS="https://app.example.com,https://admin.example.com")
    assert settings.cors_origins_list == [
        "https://app.example.com",
        "https://admin.example.com",
    ]


def test_is_production_flag():
    assert _settings(APP_ENV="production", DEBUG=False).is_production is True
    assert _settings(APP_ENV="development").is_production is False

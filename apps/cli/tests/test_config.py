"""Tests for CLI configuration defaults."""

import importlib

import criptenv.config as config


def test_api_base_url_defaults_to_production(monkeypatch):
    monkeypatch.delenv("CRIPTENV_API_URL", raising=False)

    reloaded = importlib.reload(config)

    assert reloaded.API_BASE_URL == "https://criptenv-api.77mdevseven.tech"


def test_api_base_url_can_be_overridden_for_development(monkeypatch):
    monkeypatch.setenv("CRIPTENV_API_URL", "http://localhost:8000")

    reloaded = importlib.reload(config)

    assert reloaded.API_BASE_URL == "http://localhost:8000"

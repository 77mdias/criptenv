"""Sanity checks on the support chat's knowledge base (not its wording)."""
from app.plans import PRICES
from app.support.chat import KNOWLEDGE


def test_knowledge_has_the_docker_recipe():
    for needle in ("ghcr.io/77mdias/criptenv-cli", "CRIPTENV_API_KEY", "CRIPTENV_VAULT_PASSWORD", "criptenv run"):
        assert needle in KNOWLEDGE


def test_knowledge_prices_match_the_plan_table():
    for price in PRICES.values():
        assert f"R$ {int(price)}" in KNOWLEDGE


def test_knowledge_fits_the_budget():
    assert len(KNOWLEDGE) < 60_000


def test_knowledge_has_the_scope_options_of_the_create_commands():
    assert "criptenv ci tokens create --name" in KNOWLEDGE and "--environment staging" in KNOWLEDGE
    assert "criptenv api-keys create --name" in KNOWLEDGE and "--env production" in KNOWLEDGE


def test_knowledge_says_the_expiry_options_count_days():
    assert "--expires-in` conta em dias" in KNOWLEDGE

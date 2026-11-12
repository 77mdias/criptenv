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

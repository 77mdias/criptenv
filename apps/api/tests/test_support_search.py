"""Support chat: the snapshot of the site's docs and the keyword search over it."""
import json
from pathlib import Path

import pytest

from app.support import docs_index
from app.support.search import search

REPO = Path(__file__).resolve().parents[3]
DOCS_PAGES = REPO / "apps/web/src/app/[locale]/(docs)/docs"


@pytest.mark.parametrize("locale", docs_index.LOCALES)
def test_docs_index_is_in_sync_with_the_web_catalogues(locale):
    committed = json.loads(docs_index.index_file(locale).read_text(encoding="utf-8"))
    assert committed == docs_index.build_index(REPO / "apps/web", locale), (
        "The docs changed: run `python scripts/build_support_docs_index.py` in apps/api and commit the result."
    )


def test_every_indexed_path_exists_in_the_docs():
    for locale in docs_index.LOCALES:
        for section in json.loads(docs_index.index_file(locale).read_text(encoding="utf-8")):
            relative = section["path"].removeprefix("/docs").lstrip("/")
            assert (DOCS_PAGES / relative / "page.tsx").exists(), section["path"]


def test_sections_carry_plain_text_without_markup():
    sections = docs_index.build_index(REPO / "apps/web", "pt-BR")
    assert sections and all("<code>" not in s["text"] and "<link>" not in s["text"] for s in sections)


def test_search_finds_the_docker_snippet():
    paths = [hit["path"] for hit in search("docker imagem binário", "pt-BR")]
    assert "/docs/getting-started/installation" in paths


def test_search_ignores_case_and_accents():
    assert search("BINARIO DOCKER", "pt-BR") == search("binário docker", "pt-BR")


def test_search_returns_at_most_3_and_nothing_for_noise():
    assert len(search("criptenv projeto ambiente segredo", "pt-BR")) <= 3
    assert search("zzzqqq", "pt-BR") == []


def test_search_unknown_locale_falls_back_to_pt_br():
    assert search("docker", "fr") == search("docker", "pt-BR")

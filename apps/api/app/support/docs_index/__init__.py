"""Snapshot of the site's docs text, one JSON file per locale, for the support chat search.

The API container does not carry the web app, so the docs catalogues
(apps/web/messages/<locale>/docs.json) are copied here as plain-text sections by
`scripts/build_support_docs_index.py`. A test fails when the copy falls behind.
"""
import json
import re
from pathlib import Path

LOCALES = ("pt-BR", "en", "es")
INDEX_DIR = Path(__file__).resolve().parent

# Catalogue areas that hold page content (the rest are sidebar, search and nav labels).
CONTENT_AREAS = ("home", "gettingStarted", "integrations", "guides", "sdks", "security", "cli", "api")
# Page keys whose folder name is not the key in kebab-case.
PATH_ALIASES = {"guides.cicd": "/docs/guides/cicd-setup", "home": "/docs"}
_TAG = re.compile(r"</?[a-zA-Z]+>")


def index_file(locale: str) -> Path:
    return INDEX_DIR / f"{locale}.json"


def _kebab(key: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "-", key).lower()


def _page_path(area: str, page: str | None, pages_root: Path) -> str:
    """URL of the docs page for a catalogue key; the nearest existing page when there is none."""
    for key in (f"{area}.{page}" if page else None, area):
        if key and key in PATH_ALIASES:
            return PATH_ALIASES[key]
    candidates = [f"{_kebab(area)}/{_kebab(page)}"] if page else []
    candidates.append(_kebab(area))
    for relative in candidates:
        if (pages_root / relative / "page.tsx").exists():
            return f"/docs/{relative}"
    return "/docs"


def _strings(value) -> list[str]:
    if isinstance(value, str):
        return [_TAG.sub("", value)]
    if isinstance(value, dict):
        return [s for v in value.values() for s in _strings(v)]
    if isinstance(value, list):
        return [s for v in value for s in _strings(v)]
    return []


def build_index(web_root: Path, locale: str) -> list[dict]:
    """Sections of up to three key levels (area.page.part), each with its page path and plain text."""
    catalogue = json.loads((web_root / "messages" / locale / "docs.json").read_text(encoding="utf-8"))
    pages_root = web_root / "src/app/[locale]/(docs)/docs"
    sections = []
    for area in CONTENT_AREAS:
        for page, content in catalogue.get(area, {}).items():
            path = _page_path(area, page, pages_root)
            page_title = content.get("title") if isinstance(content, dict) else None
            parts = content.items() if isinstance(content, dict) else [(None, content)]
            for part, value in parts:
                text = " ".join(_strings(value)).strip()
                if not text:
                    continue
                sections.append({
                    "id": ".".join(k for k in (area, page, part) if k),
                    "path": path,
                    "title": _TAG.sub("", page_title) if isinstance(page_title, str) else page,
                    "text": text,
                })
    return sections

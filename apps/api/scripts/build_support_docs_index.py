"""Regenerate the support chat's docs snapshot from the web catalogues.

Run from apps/api after changing apps/web/messages/*/docs.json:
    python scripts/build_support_docs_index.py
"""
import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.support.docs_index import LOCALES, build_index, index_file  # noqa: E402

WEB_ROOT = API_ROOT.parent / "web"

for locale in LOCALES:
    sections = build_index(WEB_ROOT, locale)
    index_file(locale).write_text(json.dumps(sections, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{locale}: {len(sections)} sections")

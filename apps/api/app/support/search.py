"""Keyword search over the docs snapshot (app/support/docs_index)."""
import json
import re
import unicodedata
from functools import lru_cache

from app.support.docs_index import LOCALES, index_file

MAX_TEXT = 2500
_WORD = re.compile(r"[a-z0-9_./-]{3,}")
_STOPWORDS = frozenset(
    "como para que uma com nao the and for with what how los las del por una "
    "este esta isso esse sobre from your you quero posso pode".split()
)


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _terms(text: str) -> list[str]:
    return [w for w in _WORD.findall(_normalize(text)) if w not in _STOPWORDS]


@lru_cache(maxsize=len(LOCALES))
def _index(locale: str) -> list[tuple[dict, str, str]]:
    sections = json.loads(index_file(locale).read_text(encoding="utf-8"))
    return [(s, _normalize(s["text"]), _normalize(f'{s["title"]} {s["id"]}')) for s in sections]


def search(query: str, locale: str, limit: int = 3) -> list[dict]:
    """The `limit` sections that share the most words with the query (title words weigh more)."""
    terms = set(_terms(query))
    if not terms:
        return []
    scored = []
    for section, text, title in _index(locale if locale in LOCALES else "pt-BR"):
        score = sum(min(text.count(t), 3) + (3 if t in title else 0) for t in terms)
        if score:
            scored.append((score, section))
    scored.sort(key=lambda pair: (-pair[0], pair[1]["id"]))
    return [
        {"path": s["path"], "title": s["title"], "text": s["text"][:MAX_TEXT]}
        for _, s in scored[:limit]
    ]

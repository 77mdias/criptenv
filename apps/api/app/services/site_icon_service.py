"""Site icons for personal-vault logins, fetched like Bitwarden's icon service.

Only the hostname reaches this module (the vault URL itself stays encrypted in
the browser). Every outbound request goes through the SSRF guard in
`outbound_target`, and nothing about the request is stored or logged.
"""
import asyncio
import ipaddress
import re
import time
from collections import OrderedDict
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from app.services.outbound_target import resolve_public_target

ICON_PATH_PREFIX = "/api/v1/icons/"

MAX_CANDIDATES = 5
MAX_REDIRECTS = 2
MAX_PAGE_BYTES = 512 * 1024
MAX_IMAGE_BYTES = 200 * 1024
MAX_CACHED_BYTES = 50 * 1024
CONNECT_TIMEOUT_SECONDS = 5.0
TOTAL_TIMEOUT_SECONDS = 10
CACHE_TTL_SECONDS = 24 * 60 * 60
CACHE_MAX_ENTRIES = 5000

_REDIRECT_STATUSES = {301, 302, 303, 307, 308}

_LABEL_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")
_SIZES_RE = re.compile(r"^\s*(\d+)[xX](\d+)\s*$")
_ICON_RELS = {"icon", "apple-touch-icon", "apple-touch-icon-precomposed"}

_PNG = b"\x89PNG\r\n\x1a\n"
_ICO = b"\x00\x00\x01\x00"
_JPEG = b"\xff\xd8\xff"


def normalize_hostname(raw: str) -> str | None:
    """Lowercase DNS name with at least one dot, or None (IPs and local names refused)."""
    host = raw.rstrip(".").lower()
    if not host or len(host) > 253:
        return None
    try:
        ipaddress.ip_address(host)
        return None
    except ValueError:
        pass
    labels = host.split(".")
    if len(labels) < 2 or not all(_LABEL_RE.match(label) for label in labels):
        return None
    return host


def _priority(sizes: str | None) -> int:
    match = _SIZES_RE.match(sizes or "")
    if not match or match.group(1) != match.group(2):
        return 200
    size = int(match.group(1))
    if size == 32:
        return 1
    if size == 64:
        return 2
    if 24 <= size <= 128:
        return 3
    if size == 16:
        return 4
    return 100


class _HeadLinks(HTMLParser):
    """Collects <base href> and icon <link>s until the <head> ends."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.base: str | None = None
        self.links: list[tuple[str, str | None]] = []
        self.done = False

    def handle_starttag(self, tag, attrs):
        if self.done:
            return
        if tag == "body":
            self.done = True
            return
        values = {name: value for name, value in attrs if value is not None}
        if tag == "base" and self.base is None and values.get("href"):
            self.base = values["href"]
        elif tag == "link" and values.get("href"):
            rels = set(values.get("rel", "").lower().split())
            if rels & _ICON_RELS:
                self.links.append((values["href"].strip(), values.get("sizes")))

    handle_startendtag = handle_starttag

    def handle_endtag(self, tag):
        if tag == "head":
            self.done = True


def icon_candidates(html: str, page_url: str) -> list[str]:
    """Absolute https icon URLs from the page's <head>, best first, at most 5."""
    parser = _HeadLinks()
    parser.feed(html)
    base = urljoin(page_url, parser.base) if parser.base else page_url
    ranked: list[tuple[int, str]] = []
    for href, sizes in parser.links:
        parts = urlsplit(urljoin(base, href))
        if parts.scheme not in ("http", "https") or not parts.hostname:
            continue
        ranked.append((_priority(sizes), urlunsplit(parts._replace(scheme="https"))))
    ranked.sort(key=lambda item: item[0])
    return [url for _, url in ranked[:MAX_CANDIDATES]]


def sniff_image(data: bytes) -> str | None:
    """Media type from the file's first bytes; the site's Content-Type is never trusted."""
    if data.startswith(_PNG):
        return "image/png"
    if data.startswith(_ICO):
        return "image/x-icon"
    if data.startswith(_JPEG):
        return "image/jpeg"
    return None


@dataclass(frozen=True)
class SiteIcon:
    content: bytes
    media_type: str


@dataclass(frozen=True)
class _Fetched:
    url: str
    content_type: str
    charset: str | None
    body: bytes


def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(CONNECT_TIMEOUT_SECONDS),
        follow_redirects=False,
        trust_env=False,
        headers={"User-Agent": "CriptEnv-Icons/1.0"},
    )


async def _get(
    client: httpx.AsyncClient, url: str, limit: int, *, truncate: bool, accept: str | None = None
) -> _Fetched | None:
    """GET through the SSRF guard, following at most MAX_REDIRECTS, each re-checked."""
    for _ in range(MAX_REDIRECTS + 1):
        try:
            target = await resolve_public_target(url)
        except ValueError:
            return None
        headers = {"Host": target.host_header}
        if accept:
            headers["Accept"] = accept
        try:
            async with client.stream(
                "GET", target.request_url, headers=headers, extensions={"sni_hostname": target.sni_hostname}
            ) as response:
                if response.status_code in _REDIRECT_STATUSES:
                    location = response.headers.get("location")
                    if not location:
                        return None
                    parts = urlsplit(urljoin(url, location))
                    url = urlunsplit(parts._replace(scheme="https") if parts.scheme == "http" else parts)
                    continue
                if not response.is_success:
                    return None
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body += chunk
                    if len(body) > limit:
                        if not truncate:
                            return None
                        del body[limit:]
                        break
                return _Fetched(url, response.headers.get("content-type", ""), response.charset_encoding, bytes(body))
        except httpx.HTTPError:
            return None
    return None


def _decode(page: _Fetched) -> str:
    try:
        return page.body.decode(page.charset or "utf-8", errors="replace")
    except LookupError:  # charset the site made up
        return page.body.decode("utf-8", errors="replace")


async def _fetch_icon(hostname: str) -> SiteIcon | None:
    async with _make_client() as client:
        page = await _get(client, f"https://{hostname}/", MAX_PAGE_BYTES, truncate=True, accept="text/html")
        candidates = []
        if page and page.content_type.lower().startswith("text/html"):
            candidates = icon_candidates(_decode(page), page.url)
        for url in dict.fromkeys([*candidates, f"https://{hostname}/favicon.ico"]):
            image = await _get(client, url, MAX_IMAGE_BYTES, truncate=False)
            media_type = sniff_image(image.body) if image else None
            if media_type:
                return SiteIcon(image.body, media_type)
    return None


# shortcut: cache per process (gunicorn runs 3 workers); move to Redis if traffic grows.
_cache: "OrderedDict[str, tuple[float, SiteIcon | None]]" = OrderedDict()


def clear_icon_cache() -> None:
    _cache.clear()


async def get_site_icon(hostname: str) -> SiteIcon | None:
    """Icon for an already normalized hostname, or None. Never raises."""
    now = time.monotonic()
    cached = _cache.get(hostname)
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]
    try:
        async with asyncio.timeout(TOTAL_TIMEOUT_SECONDS):
            icon = await _fetch_icon(hostname)
    except Exception:
        icon = None
    if icon is None or len(icon.content) <= MAX_CACHED_BYTES:
        _cache.pop(hostname, None)
        _cache[hostname] = (now, icon)
        while len(_cache) > CACHE_MAX_ENTRIES:
            _cache.popitem(last=False)
    return icon

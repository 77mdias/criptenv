"""Site icons for personal-vault logins, fetched like Bitwarden's icon service.

Only the hostname reaches this module (the vault URL itself stays encrypted in
the browser). Every outbound request goes through the SSRF guard in
`outbound_target`, and nothing about the request is stored or logged.
"""
import ipaddress
import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit

ICON_PATH_PREFIX = "/api/v1/icons/"

MAX_CANDIDATES = 5

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

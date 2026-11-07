"""Site icon fetching: pinned connections, redirects, size limits and cache.

No network: the SSRF resolver and the HTTP transport are both replaced.
"""
import logging
from urllib.parse import urlsplit

import httpx
import pytest

from app.services import site_icon_service as svc
from app.services.outbound_target import PinnedTarget
from app.services.site_icon_service import SiteIcon, clear_icon_cache, get_site_icon

pytestmark = pytest.mark.asyncio

HTML = {"content-type": "text/html; charset=utf-8"}
PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 20
ICO = b"\x00\x00\x01\x00" + b"x" * 20
RESOLVES = []  # kwargs of every resolver call in the current test


@pytest.fixture(autouse=True)
def _clean_cache():
    clear_icon_cache()
    RESOLVES.clear()
    yield
    clear_icon_cache()


@pytest.fixture
def site(monkeypatch):
    """Serve `{url: (status, headers, body) | Exception}`; anything else is 404."""

    def setup(routes):
        requests = []

        def handler(request):
            requests.append(request)
            value = routes.get(str(request.url))
            if isinstance(value, Exception):
                raise value
            if value is None:
                return httpx.Response(404)
            status, headers, body = value
            return httpx.Response(status, headers=headers, content=body)

        async def fake_resolve(url, **kwargs):
            RESOLVES.append(kwargs)
            host = urlsplit(url).hostname
            if host == "internal.test":
                raise ValueError("URL target is not public")
            return PinnedTarget(url, url, host, host, "93.184.216.34")

        monkeypatch.setattr(
            svc, "_make_client",
            lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False),
        )
        monkeypatch.setattr(svc, "resolve_public_target", fake_resolve)
        return requests

    return setup


async def test_picks_best_link_and_sends_host_and_sni(site):
    reqs = site({
        "https://site.test/": (200, HTML, b'<head><link rel="icon" sizes="16x16" href="/16.png">'
                                          b'<link rel="icon" sizes="32x32" href="/32.png"></head>'),
        "https://site.test/32.png": (200, {"content-type": "text/plain"}, PNG),
    })
    icon = await get_site_icon("site.test")
    assert icon == SiteIcon(PNG, "image/png")
    assert "https://site.test/16.png" not in [str(r.url) for r in reqs]
    assert reqs[0].headers["host"] == "site.test"
    assert reqs[0].extensions["sni_hostname"] == "site.test"


async def test_falls_back_to_favicon_ico(site):
    site({
        "https://site.test/": (200, HTML, b"<head></head>"),
        "https://site.test/favicon.ico": (200, {}, ICO),
    })
    assert (await get_site_icon("site.test")).media_type == "image/x-icon"


async def test_follows_redirect_and_resolves_hrefs_against_final_url(site):
    site({
        "https://site.test/": (301, {"location": "http://www.site.test/home"}, b""),
        "https://www.site.test/home": (200, HTML, b'<head><link rel="icon" href="i.png"></head>'),
        "https://www.site.test/i.png": (200, {}, PNG),
    })
    assert (await get_site_icon("site.test")).content == PNG


async def test_relative_location(site):
    site({
        "https://site.test/": (302, {"location": "/home"}, b""),
        "https://site.test/home": (200, HTML, b'<head><link rel="icon" href="/i.png"></head>'),
        "https://site.test/i.png": (200, {}, PNG),
    })
    assert await get_site_icon("site.test") is not None


async def test_third_redirect_gives_up(site):
    site({
        "https://site.test/": (302, {"location": "/a"}, b""),
        "https://site.test/a": (302, {"location": "/b"}, b""),
        "https://site.test/b": (302, {"location": "/c"}, b""),
        "https://site.test/c": (200, HTML, b'<head><link rel="icon" href="/i.png"></head>'),
        "https://site.test/i.png": (200, {}, PNG),
    })
    assert await get_site_icon("site.test") is None


async def test_redirect_to_private_target_is_never_requested(site):
    reqs = site({"https://site.test/": (302, {"location": "https://internal.test/"}, b"")})
    assert await get_site_icon("site.test") is None
    assert all(r.url.host != "internal.test" for r in reqs)


async def test_html_disguised_as_png_and_oversized_image_are_rejected(site):
    site({
        "https://site.test/": (200, HTML, b'<head><link rel="icon" href="/a.png"><link rel="icon" href="/b.png"></head>'),
        "https://site.test/a.png": (200, {"content-type": "image/png"}, b"<html>x</html>"),
        "https://site.test/b.png": (200, {}, PNG[:8] + b"0" * (200 * 1024)),
    })
    assert await get_site_icon("site.test") is None


async def test_page_is_cut_at_512_kb_but_head_still_read(site):
    site({
        "https://site.test/": (200, HTML, b'<head><link rel="icon" href="/i.png">' + b" " * (600 * 1024) + b"</head>"),
        "https://site.test/i.png": (200, {}, PNG),
    })
    assert await get_site_icon("site.test") is not None


async def test_non_utf8_page(site):
    body = '<head><title>Açaí</title><link rel="icon" href="/i.png"></head>'.encode("latin-1") + b"\xff\xfe"
    site({
        "https://site.test/": (200, {"content-type": "text/html; charset=iso-8859-1"}, body),
        "https://site.test/i.png": (200, {}, PNG),
    })
    assert await get_site_icon("site.test") is not None


async def test_network_error_returns_none(site):
    site({"https://site.test/": httpx.ConnectError("boom")})
    assert await get_site_icon("site.test") is None


async def test_hit_is_cached(site):
    reqs = site({
        "https://site.test/": (200, HTML, b"<head></head>"),
        "https://site.test/favicon.ico": (200, {}, ICO),
    })
    await get_site_icon("site.test")
    await get_site_icon("site.test")
    assert len(reqs) == 2  # page + favicon, first call only


async def test_miss_is_cached(site):
    reqs = site({})
    assert await get_site_icon("site.test") is None
    assert await get_site_icon("site.test") is None
    assert len(reqs) == 2


async def test_icon_over_50_kb_is_not_cached(site):
    big = ICO[:4] + b"0" * (60 * 1024)
    reqs = site({
        "https://site.test/": (200, HTML, b"<head></head>"),
        "https://site.test/favicon.ico": (200, {}, big),
    })
    await get_site_icon("site.test")
    await get_site_icon("site.test")
    assert len(reqs) == 4


async def test_outbound_requests_are_not_logged(site, caplog):
    caplog.set_level(logging.DEBUG)
    site({"https://site.test/": (200, HTML, b"<head></head>"), "https://site.test/favicon.ico": (200, {}, ICO)})
    assert await get_site_icon("site.test") is not None
    assert "site.test" not in caplog.text


async def test_dns_and_parsing_run_on_the_icon_pool(site, monkeypatch):
    import threading

    seen = {}
    original = svc.icon_candidates

    def spy(html, page_url):
        seen["thread"] = threading.current_thread().name
        return original(html, page_url)

    monkeypatch.setattr(svc, "icon_candidates", spy)
    site({"https://site.test/": (200, HTML, b"<head></head>"), "https://site.test/favicon.ico": (200, {}, ICO)})
    assert await get_site_icon("site.test") is not None
    assert RESOLVES and all(kwargs.get("executor") is svc._ICON_POOL for kwargs in RESOLVES)
    assert seen["thread"].startswith("icon-worker")


async def test_concurrent_fetches_are_capped(site, monkeypatch):
    import asyncio

    monkeypatch.setattr(svc, "_FETCH_SLOTS", asyncio.Semaphore(1))
    site({})
    state = {"now": 0, "peak": 0}

    async def handler(request):
        state["now"] += 1
        state["peak"] = max(state["peak"], state["now"])
        await asyncio.sleep(0.01)
        state["now"] -= 1
        return httpx.Response(404)

    monkeypatch.setattr(svc, "_make_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    await asyncio.gather(*(get_site_icon(f"h{i}.test") for i in range(5)))
    assert state["peak"] == 1


async def test_cache_evicts_oldest_beyond_byte_budget(site, monkeypatch):
    monkeypatch.setattr(svc, "CACHE_MAX_BYTES", 50)  # ICO is 24 bytes: two fit, three do not
    reqs = site({f"https://{h}/favicon.ico": (200, {}, ICO) for h in ("a.test", "b.test", "c.test")})
    for host in ("a.test", "b.test", "c.test"):
        await get_site_icon(host)
    before = len(reqs)
    await get_site_icon("b.test")
    assert len(reqs) == before  # still cached
    await get_site_icon("a.test")
    assert len(reqs) == before + 2  # evicted: page + favicon again

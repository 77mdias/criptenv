"""Public-target resolver shared by webhooks and site icons (SSRF guard)."""
import asyncio
import socket
from types import SimpleNamespace

import pytest

from app.services.outbound_target import resolve_public_target

pytestmark = pytest.mark.asyncio


def dns(monkeypatch, ip):
    async def getaddrinfo(*args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443))]

    monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=getaddrinfo))


async def test_public_target_pins_ip_and_keeps_host(monkeypatch):
    dns(monkeypatch, "93.184.216.34")
    t = await resolve_public_target("https://example.com/favicon.ico")
    assert t.request_url == "https://93.184.216.34/favicon.ico"
    assert (t.host_header, t.sni_hostname, t.resolved_ip) == ("example.com", "example.com", "93.184.216.34")


async def test_public_target_refuses_localhost_http_by_default(monkeypatch):
    dns(monkeypatch, "127.0.0.1")
    with pytest.raises(ValueError):
        await resolve_public_target("http://localhost:8000/x")


async def test_public_target_refuses_private_resolution(monkeypatch):
    dns(monkeypatch, "10.0.0.5")
    with pytest.raises(ValueError):
        await resolve_public_target("https://intranet.example.com/")


async def test_public_target_allows_localhost_http_only_with_flag(monkeypatch):
    dns(monkeypatch, "127.0.0.1")
    t = await resolve_public_target("http://localhost:8000/x", allow_localhost_http=True)
    assert t.request_url == "http://127.0.0.1:8000/x"


async def test_public_target_resolves_on_the_given_executor(monkeypatch):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    threads = []

    def fake_getaddrinfo(host, port, *args, **kwargs):
        threads.append(threading.current_thread().name)
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    with ThreadPoolExecutor(1, thread_name_prefix="icon-dns-test") as pool:
        t = await resolve_public_target("https://example.com/", executor=pool)
    assert t.resolved_ip == "93.184.216.34"
    assert threads and threads[0].startswith("icon-dns-test")

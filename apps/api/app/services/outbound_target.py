"""SSRF guard for server-side requests to user-supplied URLs (webhooks, site icons).

Resolves the host once, refuses any non-public address, and returns a target
pinned to the resolved IP so DNS cannot change between the check and the
connection.
"""
import asyncio
import functools
import ipaddress
import socket
from concurrent.futures import Executor
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class PinnedTarget:
    original_url: str
    request_url: str
    host_header: str
    sni_hostname: str
    resolved_ip: str


def _is_unsafe(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        address.is_private
        or address.is_reserved
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_unspecified
    )


async def resolve_public_target(
    url: str, *, allow_localhost_http: bool = False, executor: Executor | None = None
) -> PinnedTarget:
    """Validate `url` and resolve it for a connection pinned to a public IP.

    `allow_localhost_http` lets `http://localhost:<port>` through (local
    development webhooks only). `executor` runs the DNS lookup off the loop's
    shared pool, so a slow resolver cannot starve other work. Raises ValueError
    for any unsafe target.
    """
    try:
        parsed = urlsplit(url)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Invalid URL") from exc

    if not hostname or parsed.username or parsed.password:
        raise ValueError("URL must not contain credentials")

    if port == 0:
        raise ValueError("URL port is not supported")

    hostname = hostname.rstrip(".").lower()
    is_localhost = hostname == "localhost"
    local_development_exception = parsed.scheme == "http" and is_localhost and allow_localhost_http

    if parsed.scheme == "http":
        if not local_development_exception:
            raise ValueError("URL must use HTTPS")
    elif parsed.scheme != "https":
        raise ValueError("URL must use HTTP or HTTPS")

    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None

    if address and _is_unsafe(address):
        raise ValueError("URL target is not public")

    if port is not None and not ((parsed.scheme == "https" and port == 443) or local_development_exception):
        raise ValueError("URL port is not supported")

    lookup_port = port or (80 if parsed.scheme == "http" else 443)
    loop = asyncio.get_running_loop()
    try:
        if executor is None:
            resolved = await loop.getaddrinfo(hostname, lookup_port, type=socket.SOCK_STREAM)
        else:
            resolved = await loop.run_in_executor(
                executor, functools.partial(socket.getaddrinfo, hostname, lookup_port, type=socket.SOCK_STREAM)
            )
    except (OSError, ValueError) as exc:
        raise ValueError("URL host could not be resolved") from exc

    if not resolved:
        raise ValueError("URL host could not be resolved")

    for result in resolved:
        try:
            resolved_address = ipaddress.ip_address(result[4][0])
        except ValueError as exc:
            raise ValueError("URL resolved to an invalid address") from exc
        address_to_check = getattr(resolved_address, "ipv4_mapped", None) or resolved_address
        if not local_development_exception and (not address_to_check.is_global or _is_unsafe(address_to_check)):
            raise ValueError("URL target is not public")

    resolved_ip = resolved[0][4][0]
    ip_netloc = f"[{resolved_ip}]" if ":" in resolved_ip else resolved_ip
    if port is not None:
        ip_netloc = f"{ip_netloc}:{port}"
    request_url = f"{parsed.scheme}://{ip_netloc}{parsed.path or '/'}"
    if parsed.query:
        request_url = f"{request_url}?{parsed.query}"

    return PinnedTarget(
        original_url=url,
        request_url=request_url,
        host_header=parsed.netloc,
        sni_hostname=hostname,
        resolved_ip=resolved_ip,
    )

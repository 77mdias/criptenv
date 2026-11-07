"""Pure rules behind site icons: hostname, <link rel=icon> choice, image bytes."""
import pytest

from app.services.site_icon_service import icon_candidates, normalize_hostname, sniff_image


@pytest.mark.parametrize("raw,expected", [
    ("GitHub.com", "github.com"),
    ("github.com.", "github.com"),
    ("xn--mnchen-3ya.de", "xn--mnchen-3ya.de"),
    ("a-b.example.co", "a-b.example.co"),
    ("localhost", None),
    ("nodot", None),
    ("192.168.0.1", None),
    ("::1", None),
    ("-bad.com", None),
    ("bad-.com", None),
    ("bad_x.com", None),
    ("a" * 64 + ".com", None),
    (".".join(["a" * 63] * 4) + ".com", None),
    ("", None),
])
def test_normalize_hostname(raw, expected):
    assert normalize_hostname(raw) == expected


def test_candidates_prefer_32_then_64_then_range_then_16():
    html = (
        '<head><link rel="icon" sizes="16x16" href="/16.png">'
        '<link rel="apple-touch-icon" sizes="180x180" href="/180.png">'
        '<link rel="icon" sizes="48x48" href="/48.png"><link rel="icon" sizes="64x64" href="/64.png">'
        '<link rel="icon" sizes="32x32" href="/32.png"></head>'
    )
    assert icon_candidates(html, "https://site.test/") == [
        f"https://site.test/{n}.png" for n in (32, 64, 48, 16, 180)
    ]


def test_candidates_resolve_base_relative_protocol_relative_and_http():
    html = (
        '<head><base href="https://cdn.site.test/assets/"><link rel="SHORTCUT ICON" href="fav.png">'
        '<link rel="icon" href="//img.test/i.png"><link rel="icon" href="http://site.test/h.png"></head>'
    )
    assert icon_candidates(html, "https://site.test/") == [
        "https://cdn.site.test/assets/fav.png",
        "https://img.test/i.png",
        "https://site.test/h.png",
    ]


def test_candidates_skip_non_icon_rels_unsafe_schemes_body_links_and_cap_at_five():
    links = "".join(f'<link rel="icon" href="/{i}.png">' for i in range(7))
    html = (
        '<head><link rel="stylesheet" href="/a.css"><link rel="icon" href="data:image/png;base64,AAA">'
        '<link rel="icon" href="javascript:alert(1)"><link rel="icon" href="mailto:a@b.c">'
        + links
        + '</head><body><link rel="icon" href="/body.png"></body>'
    )
    assert icon_candidates(html, "https://site.test/") == [f"https://site.test/{i}.png" for i in range(5)]


@pytest.mark.parametrize("data,expected", [
    (b"\x89PNG\r\n\x1a\nrest", "image/png"),
    (b"\x00\x00\x01\x00rest", "image/x-icon"),
    (b"\xff\xd8\xffrest", "image/jpeg"),
    (b"<html>", None),
    (b"", None),
    (b"\x89PNG", None),
])
def test_sniff_image(data, expected):
    assert sniff_image(data) == expected


def test_candidates_stop_parsing_after_head(monkeypatch):
    from app.services import site_icon_service as svc

    fed = []
    original = svc._HeadLinks.feed

    def spy(self, data):
        fed.append(len(data))
        return original(self, data)

    monkeypatch.setattr(svc._HeadLinks, "feed", spy)
    html = '<head><link rel="icon" href="/i.png"></head>' + "<div>" * 100_000
    assert icon_candidates(html, "https://site.test/") == ["https://site.test/i.png"]
    assert sum(fed) < 20_000

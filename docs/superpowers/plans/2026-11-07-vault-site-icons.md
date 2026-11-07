# Ícones de site no cofre pessoal — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logins do cofre pessoal mostram o ícone do site, buscado por uma rota própria da API protegida contra SSRF, com opção por navegador para desligar.

**Architecture:** O navegador tira o hostname da URL já decifrada e põe `<img src="/api/v1/icons/{hostname}/icon.png">`. A API (FastAPI) exige sessão web, libera o banco, resolve o DNS com IP fixado (reaproveitando o resolvedor do webhook), lê o `<head>` do site, escolhe o melhor `<link rel=icon>` e confere a imagem pelos bytes. Cache em memória, balde de rate limit próprio e hostname oculto em todo log.

**Tech Stack:** Python 3.11 + FastAPI + httpx 0.28 (`html.parser` da stdlib), Next.js 16 + React 19 + next-intl, Jest, Cypress, Cloudflare Worker.

**Spec:** `docs/superpowers/specs/2026-11-07-vault-site-icons-design.md`

## Global Constraints

- Rota: `GET /api/v1/icons/{hostname}/icon.png`, só com `Depends(get_current_web_user)`.
- Só `https` na porta 443; sem Google ou terceiro; sem `www.`/domínio principal/`http://`.
- Máximos: página 512 KB (corta e usa o que leu), imagem 200 KB (passou: descarta), 5 candidatos, 2 redirecionamentos, 5 s por conexão, 10 s no total.
- Aceita só PNG `89 50 4E 47 0D 0A 1A 0A`, ICO `00 00 01 00`, JPEG `FF D8 FF`; `Content-Type` do site é ignorado.
- Cache: hostname → ícone (só ≤ 50 KB) ou "não achei", 24 h, 5.000 entradas, descarta a mais antiga.
- Resposta: achou → 200, `Cache-Control: private, max-age=604800`, `X-Content-Type-Options: nosniff`; não achou/erro → 404, `Cache-Control: private, max-age=86400`. Nunca 5xx.
- Rate limit: caminhos `/api/v1/icons/` → balde `icons:{ip}`, `300/minute`.
- Logs: hostname vira `[oculto]` (`/api/v1/icons/[oculto]/icon.png`) em gunicorn/uvicorn access, `request_logging_middleware`, `console.warn`/`console.error` do Worker; transações Sentry do caminho descartadas; `wrangler.jsonc` `invocation_logs: false`.
- Opção: `localStorage["criptenv:vault:site-icons"]` = `"on"`/`"off"`; sem valor = **ligada**.
- Textos em pt-BR, en e es (`apps/web/messages/<locale>/vault.json`).
- API: rodar testes com `cd apps/api && venv/bin/python -m pytest ...` e `venv/bin/ruff check .`. Web: `cd apps/web && npx jest ...`, `npm run lint`.

## Review Focus

1. URL do item com maiúsculas, porta, usuário/senha (`https://user:pw@GitHub.com:8443/x`) → pede `github.com`, sem vazar credencial. Teste na Tarefa 6.
2. Domínio internacional (`https://münchen.de`) → `xn--mnchen-3ya.de`, aceito pelo servidor. Testes nas Tarefas 2 e 6.
3. Hostname com ponto final (`github.com.`) → mesmo que `github.com` nos dois lados (um cache só). Testes nas Tarefas 2 e 6.
4. `href` `data:`/`javascript:`/`mailto:` no `<link rel=icon>` → ignorado, cai no `/favicon.ico`. Teste na Tarefa 2.
5. Página que não é UTF-8 (`charset=iso-8859-1`) ou com bytes inválidos → não quebra, acha o link. Teste na Tarefa 3.

---

### Task 1: Resolvedor de destino público com nome neutro

**Files:**
- Create: `apps/api/app/services/outbound_target.py`
- Modify: `apps/api/app/services/alert_settings_service.py:26-135`
- Test: `apps/api/tests/test_outbound_target.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class PinnedTarget: original_url: str; request_url: str; host_header: str; sni_hostname: str; resolved_ip: str`
  - `async def resolve_public_target(url: str, *, allow_localhost_http: bool = False) -> PinnedTarget` — levanta `ValueError` quando o destino não é público.
  - `alert_settings_service` continua exportando `ValidatedWebhookTarget` (= `PinnedTarget`), `resolve_webhook_target(url, environment)` e `validate_webhook_url(url, environment)` com o comportamento de hoje.

- [ ] **Step 1: Escrever os testes que falham** (mock de DNS igual a `tests/test_alert_settings_service.py`: `monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=fake))`)

```python
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
```

- [ ] **Step 2:** `venv/bin/python -m pytest tests/test_outbound_target.py -q` → FAIL (`ModuleNotFoundError: app.services.outbound_target`).
- [ ] **Step 3:** Mover o corpo de `resolve_webhook_target` para `resolve_public_target`, trocando `is_localhost and is_development` por `is_localhost and allow_localhost_http`, e as mensagens "Webhook URL ..." por "URL ..." (nenhum teste nem tela depende do texto). Em `alert_settings_service.py`: `from app.services.outbound_target import PinnedTarget as ValidatedWebhookTarget, resolve_public_target`; `resolve_webhook_target` vira uma linha que passa `allow_localhost_http=environment.lower() in {"development", "dev", "test", "testing"}`. Remover os imports que ficarem sem uso (`ipaddress`, `socket`, `urlsplit`, `dataclass`) só se o ruff apontar.
- [ ] **Step 4:** `venv/bin/python -m pytest tests/test_outbound_target.py tests/test_alert_settings_service.py tests/test_webhook_service.py tests/test_alert_settings_routes.py -q` → PASS.
- [ ] **Step 5:** Commit `refactor(api): extrai resolvedor de destino público do webhook`.

### Task 2: Regras puras do ícone (hostname, links, bytes)

**Files:**
- Create: `apps/api/app/services/site_icon_service.py`
- Test: `apps/api/tests/test_site_icon_parsing.py`

**Interfaces:**
- Produces:
  - `ICON_PATH_PREFIX = "/api/v1/icons/"`
  - `def normalize_hostname(raw: str) -> str | None`
  - `def icon_candidates(html: str, page_url: str) -> list[str]` — URLs absolutas `https`, em ordem de prioridade, no máximo 5.
  - `def sniff_image(data: bytes) -> str | None` — `"image/png"`, `"image/x-icon"`, `"image/jpeg"` ou `None`.

- [ ] **Step 1: Testes que falham**

```python
@pytest.mark.parametrize("raw,expected", [
    ("GitHub.com", "github.com"), ("github.com.", "github.com"),
    ("xn--mnchen-3ya.de", "xn--mnchen-3ya.de"), ("a-b.example.co", "a-b.example.co"),
    ("localhost", None), ("nodot", None), ("192.168.0.1", None), ("::1", None),
    ("-bad.com", None), ("bad-.com", None), ("bad_x.com", None), ("a" * 64 + ".com", None),
    (".".join(["a" * 63] * 4) + ".com", None), ("", None),
])
def test_normalize_hostname(raw, expected): assert normalize_hostname(raw) == expected

def test_candidates_prefer_32_then_64_then_range_then_16():
    html = '<head><link rel="icon" sizes="16x16" href="/16.png"><link rel="apple-touch-icon" sizes="180x180" href="/180.png">' \
           '<link rel="icon" sizes="48x48" href="/48.png"><link rel="icon" sizes="64x64" href="/64.png"><link rel="icon" sizes="32x32" href="/32.png"></head>'
    assert icon_candidates(html, "https://site.test/") == [f"https://site.test/{n}.png" for n in (32, 64, 48, 16, 180)]

def test_candidates_resolve_base_relative_protocol_relative_and_http():
    html = '<head><base href="https://cdn.site.test/assets/"><link rel="SHORTCUT ICON" href="fav.png">' \
           '<link rel="icon" href="//img.test/i.png"><link rel="icon" href="http://site.test/h.png"></head>'
    assert icon_candidates(html, "https://site.test/") == ["https://cdn.site.test/assets/fav.png", "https://img.test/i.png", "https://site.test/h.png"]

def test_candidates_skip_non_icon_rels_unsafe_schemes_body_links_and_cap_at_five():
    links = "".join(f'<link rel="icon" href="/{i}.png">' for i in range(7))
    html = '<head><link rel="stylesheet" href="/a.css"><link rel="icon" href="data:image/png;base64,AAA">' \
           '<link rel="icon" href="javascript:alert(1)"><link rel="icon" href="mailto:a@b.c">' + links + \
           '</head><body><link rel="icon" href="/body.png"></body>'
    assert icon_candidates(html, "https://site.test/") == [f"https://site.test/{i}.png" for i in range(5)]

@pytest.mark.parametrize("data,expected", [
    (b"\x89PNG\r\n\x1a\nrest", "image/png"), (b"\x00\x00\x01\x00rest", "image/x-icon"),
    (b"\xff\xd8\xffrest", "image/jpeg"), (b"<html>", None), (b"", None), (b"\x89PNG", None),
])
def test_sniff_image(data, expected): assert sniff_image(data) == expected
```

- [ ] **Step 2:** `venv/bin/python -m pytest tests/test_site_icon_parsing.py -q` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar no arquivo novo.
  - `normalize_hostname`: tira o ponto final, minúsculas, até 253 caracteres, cada parte casa `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`, precisa de ≥ 2 partes, recusa o que `ipaddress.ip_address` aceita.
  - `icon_candidates`: subclasse de `html.parser.HTMLParser` que junta `<link>` até `</head>` ou `<body>`; entra quando os tokens de `rel` (minúsculas, separados por espaço) têm `icon`, `apple-touch-icon` ou `apple-touch-icon-precomposed` (decisão do plano, cobre `shortcut icon`); `href` resolvido com `urljoin(base, href)`, onde `base = urljoin(page_url, <base href>)`; esquema `http` vira `https`; outro esquema é descartado. Prioridade pelo `sizes` (só `^\s*(\d+)x(\d+)\s*$`, sem diferenciar `x`/`X`): sem tamanho ou não quadrado 200; 32 → 1; 64 → 2; 24–128 → 3; 16 → 4; resto 100. `sorted` estável, corta em 5.
- [ ] **Step 4:** Mesmo comando → PASS. `venv/bin/ruff check app/services/site_icon_service.py` limpo.
- [ ] **Step 5:** Commit `feat(api): regras de hostname, links e bytes para ícones de site`.

### Task 3: Busca do ícone com IP fixado, redirecionamentos e cache

**Files:**
- Modify: `apps/api/app/services/site_icon_service.py`
- Test: `apps/api/tests/test_site_icon_fetch.py`

**Interfaces:**
- Consumes: `resolve_public_target`, `PinnedTarget` (Task 1); `icon_candidates`, `sniff_image` (Task 2).
- Produces:
  - `@dataclass(frozen=True) class SiteIcon: content: bytes; media_type: str`
  - `def _make_client() -> httpx.AsyncClient` — os testes trocam por um cliente com `httpx.MockTransport`.
  - `async def get_site_icon(hostname: str) -> SiteIcon | None` — com cache; nunca levanta exceção.
  - `def clear_icon_cache() -> None`

- [ ] **Step 1: Testes que falham.** Fixture `site(monkeypatch)` que recebe `{url: (status, headers, body)}` e: troca `_make_client` por `httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False)`; troca `resolve_public_target` em `site_icon_service` por um falso que devolve `PinnedTarget(url, url, host, host, "93.184.216.34")` e levanta `ValueError` para host `internal.test`; guarda a lista de requisições; URL fora do dict → 404. `clear_icon_cache()` antes de cada teste. `PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 20`, `ICO = b"\x00\x00\x01\x00" + b"x" * 20`.

```python
async def test_picks_best_link_and_sends_host_and_sni(site):
    reqs = site({"https://site.test/": (200, HTML, b'<head><link rel="icon" sizes="16x16" href="/16.png"><link rel="icon" sizes="32x32" href="/32.png"></head>'),
                 "https://site.test/32.png": (200, {"content-type": "text/plain"}, PNG)})
    icon = await get_site_icon("site.test")
    assert icon == SiteIcon(PNG, "image/png")
    assert "https://site.test/16.png" not in [str(r.url) for r in reqs]
    assert reqs[0].headers["host"] == "site.test" and reqs[0].extensions["sni_hostname"] == "site.test"

async def test_falls_back_to_favicon_ico(site):
    site({"https://site.test/": (200, HTML, b"<head></head>"), "https://site.test/favicon.ico": (200, {}, ICO)})
    assert (await get_site_icon("site.test")).media_type == "image/x-icon"

async def test_follows_redirect_and_resolves_hrefs_against_final_url(site):
    site({"https://site.test/": (301, {"location": "http://www.site.test/home"}, b""),
          "https://www.site.test/home": (200, HTML, b'<head><link rel="icon" href="i.png"></head>'),
          "https://www.site.test/i.png": (200, {}, PNG)})
    assert (await get_site_icon("site.test")).content == PNG

async def test_relative_location(site):
    site({"https://site.test/": (302, {"location": "/home"}, b""),
          "https://site.test/home": (200, HTML, b'<head><link rel="icon" href="/i.png"></head>'),
          "https://site.test/i.png": (200, {}, PNG)})
    assert await get_site_icon("site.test") is not None

async def test_third_redirect_gives_up(site):
    site({"https://site.test/": (302, {"location": "/a"}, b""), "https://site.test/a": (302, {"location": "/b"}, b""),
          "https://site.test/b": (302, {"location": "/c"}, b""), "https://site.test/c": (200, HTML, b'<head><link rel="icon" href="/i.png"></head>'),
          "https://site.test/i.png": (200, {}, PNG)})
    assert await get_site_icon("site.test") is None

async def test_redirect_to_private_target_is_never_requested(site):
    reqs = site({"https://site.test/": (302, {"location": "https://internal.test/"}, b"")})
    assert await get_site_icon("site.test") is None
    assert all(r.url.host != "internal.test" for r in reqs)

async def test_html_disguised_as_png_and_oversized_image_are_rejected(site):
    site({"https://site.test/": (200, HTML, b'<head><link rel="icon" href="/a.png"><link rel="icon" href="/b.png"></head>'),
          "https://site.test/a.png": (200, {"content-type": "image/png"}, b"<html>x</html>"),
          "https://site.test/b.png": (200, {}, PNG[:8] + b"0" * (200 * 1024))})
    assert await get_site_icon("site.test") is None

async def test_page_is_cut_at_512_kb_but_head_still_read(site):
    site({"https://site.test/": (200, HTML, b'<head><link rel="icon" href="/i.png">' + b" " * (600 * 1024) + b"</head>"),
          "https://site.test/i.png": (200, {}, PNG)})
    assert await get_site_icon("site.test") is not None

async def test_non_utf8_page(site):
    body = '<head><title>Açaí</title><link rel="icon" href="/i.png"></head>'.encode("latin-1") + b"\xff\xfe"
    site({"https://site.test/": (200, {"content-type": "text/html; charset=iso-8859-1"}, body), "https://site.test/i.png": (200, {}, PNG)})
    assert await get_site_icon("site.test") is not None

async def test_network_error_returns_none(site):
    site({"https://site.test/": httpx.ConnectError("boom")})  # a fixture levanta quando o valor é exceção
    assert await get_site_icon("site.test") is None

async def test_hit_is_cached(site):
    reqs = site({"https://site.test/": (200, HTML, b"<head></head>"), "https://site.test/favicon.ico": (200, {}, ICO)})
    await get_site_icon("site.test"); await get_site_icon("site.test")
    assert len(reqs) == 2  # página + favicon, só na 1ª chamada

async def test_miss_is_cached(site):
    reqs = site({})
    assert await get_site_icon("site.test") is None and await get_site_icon("site.test") is None
    assert len(reqs) == 2

async def test_icon_over_50_kb_is_not_cached(site):
    big = ICO[:4] + b"0" * (60 * 1024)
    reqs = site({"https://site.test/": (200, HTML, b"<head></head>"), "https://site.test/favicon.ico": (200, {}, big)})
    await get_site_icon("site.test"); await get_site_icon("site.test")
    assert len(reqs) == 4
```

  `HTML = {"content-type": "text/html; charset=utf-8"}`.
- [ ] **Step 2:** `venv/bin/python -m pytest tests/test_site_icon_fetch.py -q` → FAIL.
- [ ] **Step 3:** Implementar.
  - `_make_client()`: `httpx.AsyncClient(timeout=httpx.Timeout(5.0), follow_redirects=False, trust_env=False, headers={"User-Agent": "CriptEnv-Icons/1.0"})`.
  - Helper `_get(client, url, limit, *, truncate: bool)`: até 3 voltas (pedido + 2 redirecionamentos). Em cada uma, `resolve_public_target(url)` (`ValueError` → `None`), depois `client.stream("GET", t.request_url, headers={"Host": t.host_header}, extensions={"sni_hostname": t.sni_hostname})`. 301/302/303/307/308 com `location` → `urljoin(url_atual, location)`, `http` vira `https`. Status 2xx → lê com `aiter_bytes` até `limit`: com `truncate`, corta; sem `truncate`, passou do limite devolve `None`. Devolve URL final, `content-type`, `response.charset_encoding` e o corpo.
  - Página: `_get(..., f"https://{hostname}/", 512 * 1024, truncate=True)` com `Accept: text/html`; só segue se o `content-type` começa com `text/html`; decodifica com `charset or "utf-8"` e `errors="replace"` (charset desconhecido → `utf-8`); `icon_candidates(html, url_final)`.
  - Cada candidato e depois `https://{hostname}/favicon.ico`: `_get(..., 200 * 1024, truncate=False)` + `sniff_image`; o primeiro que passar ganha.
  - `get_site_icon`: confere o cache, depois `async with asyncio.timeout(10)` sobre a busca inteira, com `except Exception` → `None`. Cache em `OrderedDict[str, tuple[float, SiteIcon | None]]` com `time.monotonic()`, TTL 86400 s, 5.000 entradas (`popitem(last=False)`), ícone > 50 KB não entra. Comentário de uma linha: `# shortcut: cache por processo (3 workers no gunicorn), trocar por Redis se o tráfego crescer`.
- [ ] **Step 4:** `venv/bin/python -m pytest tests/test_site_icon_fetch.py tests/test_site_icon_parsing.py -q` → PASS.
- [ ] **Step 5:** Commit `feat(api): busca de ícone de site com IP fixado, limites e cache`.

### Task 4: Rota `/api/v1/icons` e balde de rate limit

**Files:**
- Create: `apps/api/app/routers/icons.py`
- Modify: `apps/api/main.py` (import e `app.include_router`, perto da linha 273), `apps/api/app/middleware/rate_limit.py:299-316`
- Test: `apps/api/tests/test_icons_route.py`, `apps/api/tests/test_rate_limit.py`

**Interfaces:**
- Consumes: `ICON_PATH_PREFIX`, `normalize_hostname`, `get_site_icon`, `SiteIcon` (Tasks 2–3); `get_current_web_user`, `get_db`.
- Produces: `router = APIRouter(prefix="/api/v1/icons", tags=["Icons"])` com `GET /{hostname}/icon.png`; `ICON_RATE_LIMIT = "300/minute"` em `rate_limit.py`.

- [ ] **Step 1: Testes que falham.** Cliente `AsyncClient(transport=ASGITransport(app=app))` como em `tests/test_personal_vault.py`, com `get_current_web_user` sobrescrito por um `User` e `get_db` sobrescrito por um falso que registra `commit`. `get_site_icon` trocado por `AsyncMock` em `app.routers.icons`.

```python
async def test_returns_icon_with_cache_headers(client, icon_mock):
    icon_mock.return_value = SiteIcon(PNG, "image/png")
    r = await client.get("/api/v1/icons/GitHub.com/icon.png")
    assert r.status_code == 200 and r.content == PNG and r.headers["content-type"] == "image/png"
    assert r.headers["cache-control"] == "private, max-age=604800" and r.headers["x-content-type-options"] == "nosniff"
    icon_mock.assert_awaited_once_with("github.com")

async def test_miss_is_404_cached_for_a_day(client, icon_mock):
    icon_mock.return_value = None
    r = await client.get("/api/v1/icons/github.com/icon.png")
    assert r.status_code == 404 and r.headers["cache-control"] == "private, max-age=86400"

@pytest.mark.parametrize("host", ["localhost", "10.0.0.1", "nodot", "bad_x.com"])
async def test_invalid_hostname_is_400_without_fetch(client, icon_mock, host):
    assert (await client.get(f"/api/v1/icons/{host}/icon.png")).status_code == 400
    icon_mock.assert_not_awaited()

async def test_commits_db_before_fetching(client, icon_mock, fake_db):
    icon_mock.side_effect = lambda h: fake_db.events.append("fetch") or None
    await client.get("/api/v1/icons/github.com/icon.png")
    assert fake_db.events == ["commit", "fetch"]

async def test_requires_web_session(raw_client):  # sem override de get_current_web_user
    assert (await raw_client.get("/api/v1/icons/github.com/icon.png")).status_code == 401
    assert (await raw_client.get("/api/v1/icons/github.com/icon.png", headers={"Authorization": "Bearer x"})).status_code == 403
```

  Em `tests/test_rate_limit.py`, com o `_request` que já existe:

```python
def test_icon_paths_get_their_own_bucket_and_limit():
    req = _request("/api/v1/icons/github.com/icon.png")
    assert build_rate_limit_key(req, "1.2.3.4") == "icons:1.2.3.4"
    assert resolve_rate_limit(req) == "300/minute"
    vault = _request("/api/v1/personal-vault/items")
    assert build_rate_limit_key(vault, "1.2.3.4") == "ip:1.2.3.4" and resolve_rate_limit(vault) == "100/minute"
```

- [ ] **Step 2:** `venv/bin/python -m pytest tests/test_icons_route.py tests/test_rate_limit.py -q` → FAIL.
- [ ] **Step 3:** Rota `async def get_icon(hostname: str, user: User = Depends(get_current_web_user), db: AsyncSession = Depends(get_db)) -> Response`: `normalize_hostname` → `None` dá `HTTPException(400)`; `await db.commit()` (comentário: libera conexão e trava da sessão antes da busca de até 10 s); `get_site_icon`; monta `Response` com os cabeçalhos das Global Constraints. Incluir o router no `main.py`. Em `rate_limit.py`, `build_rate_limit_key` e `resolve_rate_limit` checam `request.url.path.startswith(ICON_PATH_PREFIX)` antes de tudo.
- [ ] **Step 4:** `venv/bin/python -m pytest tests/test_icons_route.py tests/test_rate_limit.py tests/test_personal_vault.py -q` → PASS.
- [ ] **Step 5:** Commit `feat(api): rota de ícones de site com sessão web e limite próprio`.

### Task 5: Hostname fora dos logs (API, Sentry, Worker)

**Files:**
- Modify: `apps/api/app/observability/__init__.py` (perto da linha 132), `apps/api/main.py:186-200`
- Create: `apps/web/worker/redact.ts`, `apps/web/worker/__tests__/redact.test.ts`
- Modify: `apps/web/worker/index.ts:194-204`, `apps/web/wrangler.jsonc:21`
- Test: `apps/api/tests/test_observability.py`, `apps/api/tests/test_icons_route.py`

**Interfaces:**
- Produces (API, em `app.observability`): `def redact_icon_path(text: str) -> str` (`re.sub(r"/api/v1/icons/[^/?#\s]+", "/api/v1/icons/[oculto]", text)`); `class IconAccessLogFilter(logging.Filter)`; `def install_icon_log_redaction() -> None` (põe o filtro no logger `uvicorn.access`, sem duplicar); `def _drop_icon_transactions(event: dict, hint: dict) -> dict | None`.
- Produces (Worker): `export function redactIconPath(text: string): string` com a mesma regex.

- [ ] **Step 1: Testes que falham**

```python
def test_redact_icon_path():
    assert redact_icon_path("/api/v1/icons/github.com/icon.png") == "/api/v1/icons/[oculto]/icon.png"
    assert redact_icon_path("/api/v1/personal-vault/items") == "/api/v1/personal-vault/items"

def test_access_log_filter_hides_hostname():
    rec = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, '%s - "%s %s HTTP/%s" %d', ("1.2.3.4:5", "GET", "/api/v1/icons/github.com/icon.png", "1.1", 200), None)
    assert IconAccessLogFilter().filter(rec) is True and "github.com" not in rec.getMessage()

def test_install_is_idempotent():
    install_icon_log_redaction(); install_icon_log_redaction()
    assert sum(isinstance(f, IconAccessLogFilter) for f in logging.getLogger("uvicorn.access").filters) == 1

def test_sentry_drops_icon_transactions():
    assert _drop_icon_transactions({"transaction": "/api/v1/icons/{hostname}/icon.png"}, {}) is None
    assert _drop_icon_transactions({"transaction": "/x", "request": {"url": "https://h/api/v1/icons/github.com/icon.png"}}, {}) is None
    assert _drop_icon_transactions({"transaction": "/api/v1/projects"}, {}) == {"transaction": "/api/v1/projects"}

```

  Em `tests/test_icons_route.py` (usa as fixtures `client` e `icon_mock` da Task 4):

```python
async def test_request_log_line_hides_hostname(caplog, client, icon_mock):
    caplog.set_level(logging.INFO)
    icon_mock.return_value = None
    await client.get("/api/v1/icons/github.com/icon.png")
    assert "github.com" not in caplog.text and "/api/v1/icons/[oculto]/icon.png" in caplog.text
```

```ts
it("hides the hostname in paths and full URLs", () => {
  expect(redactIconPath("/api/v1/icons/github.com/icon.png")).toBe("/api/v1/icons/[oculto]/icon.png")
  expect(redactIconPath("https://api.test/api/v1/icons/github.com/icon.png")).toBe("https://api.test/api/v1/icons/[oculto]/icon.png")
  expect(redactIconPath("/api/v1/projects")).toBe("/api/v1/projects")
})
```

- [ ] **Step 2:** `cd apps/api && venv/bin/python -m pytest tests/test_observability.py tests/test_icons_route.py -q` e `cd apps/web && npx jest worker` → os novos FAIL.
- [ ] **Step 3:** Implementar. `IconAccessLogFilter.filter`: se `record.args` é tupla, passa `redact_icon_path` nos itens `str`; sempre devolve `True`. `sentry_sdk.init(..., before_send_transaction=_drop_icon_transactions)`. `main.py`: chama `install_icon_log_redaction()` uma vez ao importar (o `UvicornWorker` do gunicorn usa o logger `uvicorn.access`, e o filtro no logger continua valendo quando o worker troca os handlers); `request_logging_middleware` usa `redact_icon_path(request.url.path)`. Worker: `console.warn` usa `redactIconPath(url.pathname)`, `console.error` usa `redactIconPath(targetUrl)`. `wrangler.jsonc`: `"invocation_logs": false`.
- [ ] **Step 4:** Os dois comandos do Step 2 → PASS.
- [ ] **Step 5:** Commit `feat: esconde o domínio do ícone em logs, Sentry e Worker`.

### Task 6: Regras do navegador (hostname e opção)

**Files:**
- Create: `apps/web/src/lib/personal-vault/site-icons.ts`
- Test: `apps/web/src/lib/personal-vault/__tests__/site-icons.test.ts`

**Interfaces:**
- Consumes: `buildApiUrl` de `@/lib/api/base-url`.
- Produces:
  - `export function iconHostname(url: string | undefined): string | null`
  - `export function siteIconSrc(hostname: string): string` → `buildApiUrl(\`/api/v1/icons/${hostname}/icon.png\`)`
  - `export const SITE_ICONS_STORAGE_KEY = "criptenv:vault:site-icons"`
  - `export function readSiteIconsSetting(): boolean` (padrão `true`) e `export function writeSiteIconsSetting(on: boolean): void`

- [ ] **Step 1: Testes que falham**

```ts
it.each([
  ["https://github.com/login", "github.com"], ["http://GitHub.com", "github.com"], ["github.com/login", "github.com"],
  ["https://user:pw@GitHub.com:8443/x", "github.com"], ["https://münchen.de", "xn--mnchen-3ya.de"], ["https://github.com./", "github.com"],
])("accepts %s", (url, host) => expect(iconHostname(url)).toBe(host))

it.each([
  undefined, "", "androidapp://com.x", "ftp://files.site.com", "https://localhost:3000", "https://intranet",
  "https://192.168.0.1", "https://[::1]/", "https://printer.local", "https://router.lan", "https://db.internal",
  "https://nas.home.arpa", "https://app.localhost", "http://abc.onion", "http://x.i2p", "https://not a url",
])("refuses %s", (url) => expect(iconHostname(url)).toBeNull())

it("builds the icon URL", () => expect(siteIconSrc("github.com")).toMatch(/\/api\/v1\/icons\/github\.com\/icon\.png$/))

it("setting defaults to on, persists off and survives a broken localStorage", () => {
  localStorage.clear(); expect(readSiteIconsSetting()).toBe(true)
  writeSiteIconsSetting(false); expect(localStorage.getItem(SITE_ICONS_STORAGE_KEY)).toBe("off"); expect(readSiteIconsSetting()).toBe(false)
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
  expect(readSiteIconsSetting()).toBe(true); expect(() => writeSiteIconsSetting(true)).not.toThrow()
})
```

  Com `afterEach(() => jest.restoreAllMocks())` no arquivo.

- [ ] **Step 2:** `cd apps/web && npx jest src/lib/personal-vault/__tests__/site-icons.test.ts` → FAIL.
- [ ] **Step 3:** `iconHostname`: sem `://` prefixa `https://`; `new URL` dentro de `try`; só `http:`/`https:`; `hostname` em minúsculas, sem ponto final; recusa sem ponto, IPv4 (`/^\d+(\.\d+){3}$/`), IPv6 (começa com `[`), `localhost` e sufixos `.localhost .local .internal .lan .home.arpa .onion .i2p`.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Commit `feat(web): regras de hostname e opção dos ícones de site`.

### Task 7: Ícone na lista e opção nas configurações do cofre

**Files:**
- Create: `apps/web/src/app/[locale]/(dashboard)/vault/_components/site-icon.tsx`
- Modify: `.../vault/_components/vault-items.tsx:41-55,150-155,224-230`, `.../vault/_components/vault-settings-dialog.tsx:21-47`
- Modify: `apps/web/messages/pt-BR/vault.json`, `apps/web/messages/en/vault.json`, `apps/web/messages/es/vault.json` (`settings.siteIcons`, `settings.siteIconsHint`)
- Test: `apps/web/src/app/[locale]/(dashboard)/vault/__tests__/vault-items.test.tsx`

**Interfaces:**
- Consumes: tudo da Task 6.
- Produces: `export function SiteIcon({ url, enabled }: { url?: string; enabled: boolean })`; `VaultSettingsDialog` ganha as props `siteIcons: boolean` e `onSiteIconsChange: (on: boolean) => void`, que não vão para o `...rest` dos formulários de senha.

Textos (exatos):

| chave | pt-BR | en | es |
|---|---|---|---|
| `settings.siteIcons` | Mostrar ícones de sites | Show website icons | Mostrar íconos de sitios |
| `settings.siteIconsHint` | Para mostrar o ícone, o CriptEnv busca o site pelo domínio do item. O domínio passa pelo servidor, mas não é guardado. | To show the icon, CriptEnv looks up the site by the item's domain. The domain passes through the server but is not stored. | Para mostrar el ícono, CriptEnv busca el sitio por el dominio del elemento. El dominio pasa por el servidor, pero no se guarda. |

- [ ] **Step 1: Testes que falham** (no `vault-items.test.tsx`, com `localStorage.clear()` no `beforeEach`; `SUMMARIES` já tem Instagram e GitHub com URL e a nota Wi-Fi)

```tsx
it("shows the site icon for logins with a URL, not for notes", async () => {
  const { container } = renderItems(); await screen.findByText("Wi-Fi")
  expect(container.querySelector('img[src$="/api/v1/icons/instagram.com/icon.png"]')).not.toBeNull()
  expect(container.querySelectorAll("img")).toHaveLength(2)
})

it("falls back to the key icon when the image fails", async () => {
  const { container } = renderItems(); await screen.findByText("Wi-Fi")
  const img = container.querySelector('img[src$="/api/v1/icons/github.com/icon.png"]')!
  const row = img.closest("li")!; fireEvent.error(img)
  expect(row.querySelector("img")).toBeNull(); expect(row.querySelector(".lucide-key-round")).not.toBeNull()
})

it("turning icons off in settings hides them at once and remembers it", async () => {
  const { container } = renderItems(); await screen.findByText("Wi-Fi")
  fireEvent.click(screen.getByRole("button", { name: "Configurações" }))
  fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar ícones de sites" }))
  expect(container.querySelector("img")).toBeNull()
  expect(localStorage.getItem("criptenv:vault:site-icons")).toBe("off")
})

it("starts with icons off when this browser saved off", async () => {
  localStorage.setItem("criptenv:vault:site-icons", "off")
  const { container } = renderItems(); await screen.findByText("Wi-Fi")
  expect(container.querySelector("img")).toBeNull()
})
```

  O `renderItems` de hoje não devolve nada: passar a devolver o resultado do `renderWithIntl`. O `KeyRound` do lucide-react 1.46 sai com a classe `lucide-key-round`.
- [ ] **Step 2:** `cd apps/web && npx jest "src/app/\[locale\]/(dashboard)/vault"` → os 4 novos FAIL, os antigos PASS.
- [ ] **Step 3:** `SiteIcon`: sem `enabled` ou sem `iconHostname(url)` → `KeyRound` com as classes de hoje. Com hostname → `<img src={siteIconSrc(host)} alt="" aria-hidden width={16} height={16} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-4 w-4 shrink-0 rounded-sm" onError=...>`; depois do erro mostra `KeyRound`; o erro volta a zero quando o hostname muda (`key` pelo hostname). `VaultItems`: `const [siteIcons, setSiteIcons] = useState(readSiteIconsSetting)` (o cofre só renderiza a lista depois de abrir, no cliente, então não há diferença de hidratação); trocar grava com `writeSiteIconsSetting` e muda o estado. Login usa `<SiteIcon url={summary.url} enabled={siteIcons} />`. `VaultSettingsDialog`: seção nova antes da senha mestra (`<Checkbox checked onChange>` com `settings.siteIcons`, `<p className="text-xs text-(--text-muted)">` com `settings.siteIconsHint`, depois `<Separator />`). Textos nos 3 idiomas.
- [ ] **Step 4:** `npx jest "src/app/\[locale\]/(dashboard)/vault" src/lib/personal-vault` → PASS; `npm run lint` limpo; `npx tsc --noEmit` limpo.
- [ ] **Step 5:** Commit `feat(web): ícone do site nos logins do cofre e opção para desligar`.

### Task 8: E2E, doc de segurança e verificação final

**Files:**
- Create: `apps/web/cypress/fixtures/site-icon.png` (PNG 1×1 válido)
- Modify: `apps/web/cypress/e2e/personal-vault.cy.ts`
- Modify: `docs/security/personal-vault.md:36` e uma seção nova "Ícones de sites" antes de "Riscos conhecidos"

- [ ] **Step 1: Teste E2E que falha**

```ts
it("shows a login's site icon and stops asking for it when turned off", () => {
  cy.intercept("GET", "**/api/v1/icons/github.com/icon.png", { fixture: "site-icon.png", headers: { "content-type": "image/png" } }).as("icon")
  createVault()
  cy.contains("button", "Novo item", { timeout: 15000 }).click()
  inputByLabel("Título").type("GitHub")
  inputByLabel("URL").type("https://github.com/login")
  inputByLabel(/^Senha$/).type("s3nh@-gh")
  cy.contains("button", "Salvar").click()
  cy.get('img[src*="/api/v1/icons/github.com/icon.png"]', { timeout: CRYPTO_TIMEOUT }).should("be.visible")
    .and(($img) => expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0))
  cy.contains("button", "Configurações").click()
  cy.contains("label", "Mostrar ícones de sites").click()
  cy.get("body").type("{esc}")
  cy.get('img[src*="/api/v1/icons/"]').should("not.exist")
  cy.get("@icon.all").should("have.length", 1)
})
```

- [ ] **Step 2:** `cd apps/web && npm run test:e2e` (sobe o Postgres no Docker, a API e o web; o `-- --spec` não funciona porque o script é um `concurrently`) → o teste novo passa, porque as Tasks 4 e 7 já estão prontas. Se falhar, o problema é seletor ou texto: corrigir o teste, não a feature.
- [ ] **Step 3:** Doc de segurança. Linha 36: "O servidor **não vê** senhas, a chave de recuperação, títulos, usuários, URLs (com uma exceção: ver "Ícones de sites"), senhas guardadas, notas ou conteúdo." Seção nova: com a opção ligada (padrão), o navegador pede `/api/v1/icons/{domínio}/icon.png` para cada login com URL, então o servidor vê o domínio (não a URL inteira) junto com o cookie de sessão, que o navegador manda sozinho. O CriptEnv não guarda nem registra isso: o domínio sai oculto nos logs, no Sentry e no Worker, e os logs automáticos do Worker estão desligados. A Cloudflare, que fica na frente de todo o tráfego, também vê. Para não mandar nada, desligue "Mostrar ícones de sites" nas configurações do cofre (vale por navegador). A busca do ícone usa só HTTPS, recusa IP interno e conecta no IP já conferido.
- [ ] **Step 4: Verificação final**
  - `cd apps/api && venv/bin/python -m pytest -q && venv/bin/ruff check .` → tudo verde.
  - `cd apps/web && npm run test:unit && npm run lint && npx tsc --noEmit` → tudo verde.
  - `cd apps/web && npm run test:e2e` → suíte inteira verde.
- [ ] **Step 5:** Commit `test(e2e): ícone de site no cofre; docs(security): o que o servidor vê com ícones`.

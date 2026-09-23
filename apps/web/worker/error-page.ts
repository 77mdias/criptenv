/**
 * Emergency fallback page for unhandled Worker errors.
 *
 * Zero runtime dependencies by design: if the Worker crashed, the app bundle
 * is the thing that failed. This module must only use platform APIs that are
 * guaranteed to exist (Request/Response/Headers).
 *
 * Contract (see plans/error-pages.md §2.1):
 * - Self-contained HTML: inline CSS, no fonts, no images, no JS.
 * - 503 + Retry-After: 60 (avoids inherited 500 retry semantics).
 * - Dark by default, respects prefers-color-scheme (app default is dark).
 * - Accent #ff4500 — existing brand accent (plans/error-pages.md §4).
 * - Theme colors are hardcoded hex copies of src/app/globals.css — never
 *   referenced at runtime.
 * - Shows the Cloudflare Ray ID for support/debug.
 * - Never throws.
 */

interface EmergencyPageOptions {
  rayId: string | null;
}

const PAGE_CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0b;
  --bg-subtle:#111113;
  --bg-muted:#1a1a1b;
  --surface:#0f0f10;
  --border:rgba(255,255,255,.08);
  --text-primary:#e8e6e3;
  --text-secondary:rgba(232,230,227,.7);
  --text-muted:rgba(232,230,227,.52);
  --accent:#ff4500;
  --accent-soft:rgba(255,69,0,.12);
  --accent-glow:rgba(255,69,0,.22);
  --mono:ui-monospace,"Cascadia Code","Fira Code","JetBrains Mono",Menlo,Consolas,monospace;
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  color-scheme:dark;
}
@media (prefers-color-scheme: light){
  :root{
    --bg:#fafafa;
    --bg-subtle:#f5f5f5;
    --bg-muted:#efefef;
    --surface:#ffffff;
    --border:rgba(0,0,0,.1);
    --text-primary:#171717;
    --text-secondary:#525252;
    --text-muted:#767676;
    --accent-glow:rgba(255,69,0,.14);
  }
}
html{height:100%}
body{
  min-height:100%;
  background:var(--bg);
  color:var(--text-primary);
  font-family:var(--sans);
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  padding:24px;
  position:relative;
  overflow-x:hidden;
}
.bg-grid{
  position:fixed;
  inset:0;
  background-image:
    linear-gradient(to right,var(--border) 1px,transparent 1px),
    linear-gradient(to bottom,var(--border) 1px,transparent 1px);
  background-size:56px 56px;
  mask-image:radial-gradient(ellipse 90% 60% at 50% 35%,#000 25%,transparent 75%);
  -webkit-mask-image:radial-gradient(ellipse 90% 60% at 50% 35%,#000 25%,transparent 75%);
  pointer-events:none;
}
.bg-glow{
  position:fixed;
  top:-220px;
  left:50%;
  width:720px;
  height:480px;
  transform:translateX(-50%);
  background:radial-gradient(ellipse at center,var(--accent-glow) 0%,transparent 65%);
  pointer-events:none;
}
main{
  position:relative;
  width:100%;
  max-width:560px;
  text-align:center;
  animation:enter .5s ease-out both;
}
@keyframes enter{
  from{opacity:0;transform:translateY(14px)}
  to{opacity:1;transform:translateY(0)}
}
@media (prefers-reduced-motion: reduce){
  main{animation:none}
  .status-dot::after{animation:none}
}
.brand{
  display:inline-flex;
  align-items:center;
  gap:10px;
  margin-bottom:40px;
  text-decoration:none;
  color:var(--text-primary);
}
.brand-mark{
  width:34px;
  height:34px;
  border-radius:10px;
  background:linear-gradient(135deg,#ff6a33,var(--accent));
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow:0 0 0 1px rgba(255,255,255,.1),0 8px 24px -8px var(--accent-glow);
  flex-shrink:0;
}
.brand-name{
  font-size:20px;
  font-weight:700;
  letter-spacing:-.02em;
}
.brand-name small{
  display:block;
  font-family:var(--mono);
  font-size:9px;
  font-weight:400;
  letter-spacing:.28em;
  text-transform:uppercase;
  color:var(--text-muted);
  margin-top:1px;
}
.card{
  background:color-mix(in srgb,var(--surface) 88%,transparent);
  border:1px solid var(--border);
  border-radius:20px;
  padding:48px 40px 40px;
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  box-shadow:0 24px 48px -24px rgba(0,0,0,.5);
}
@supports not (backdrop-filter:blur(1px)){
  .card{background:var(--surface)}
}
.status-badge{
  display:inline-flex;
  align-items:center;
  gap:8px;
  font-family:var(--mono);
  font-size:11px;
  font-weight:600;
  letter-spacing:.22em;
  text-transform:uppercase;
  color:var(--accent);
  background:var(--accent-soft);
  border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);
  border-radius:999px;
  padding:7px 16px;
  margin-bottom:28px;
}
@supports not (color:color-mix(in srgb,red 50%,blue)){
  .status-badge{border-color:var(--accent)}
}
.status-dot{
  position:relative;
  width:7px;
  height:7px;
  border-radius:50%;
  background:var(--accent);
}
.status-dot::after{
  content:"";
  position:absolute;
  inset:-4px;
  border-radius:50%;
  border:1px solid var(--accent);
  opacity:.6;
  animation:pulse 2s ease-out infinite;
}
@keyframes pulse{
  0%{transform:scale(.5);opacity:.8}
  100%{transform:scale(1.6);opacity:0}
}
.error-icon{
  width:64px;
  height:64px;
  margin:0 auto 24px;
  color:var(--accent);
}
h1{
  font-size:clamp(26px,5vw,34px);
  font-weight:700;
  letter-spacing:-.03em;
  line-height:1.15;
  margin-bottom:14px;
}
h1 em{
  font-style:normal;
  background:linear-gradient(120deg,var(--text-primary) 30%,var(--accent));
  -webkit-background-clip:text;
  background-clip:text;
  -webkit-text-fill-color:transparent;
  color:transparent;
}
.card p{
  color:var(--text-secondary);
  font-size:15px;
  line-height:1.65;
  max-width:40ch;
  margin:0 auto 8px;
}
.kv{
  display:inline-flex;
  align-items:center;
  gap:10px;
  margin-top:24px;
  padding:10px 16px;
  border:1px solid var(--border);
  border-radius:12px;
  background:var(--bg-subtle);
  font-family:var(--mono);
  font-size:12px;
  color:var(--text-muted);
}
.kv label{
  font-size:10px;
  letter-spacing:.18em;
  text-transform:uppercase;
}
.kv code{
  color:var(--text-secondary);
  font-size:13px;
  letter-spacing:.04em;
  user-select:all;
  -webkit-user-select:all;
}
.actions{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:14px;
  margin-top:32px;
  flex-wrap:wrap;
}
.btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:9px;
  height:46px;
  padding:0 26px;
  border-radius:12px;
  font-size:14px;
  font-weight:600;
  text-decoration:none;
  transition:transform .15s ease,box-shadow .15s ease,background .15s ease;
}
.btn svg{width:15px;height:15px}
.btn-primary{
  color:#fff;
  background:linear-gradient(135deg,#ff6a33,var(--accent));
  box-shadow:0 10px 28px -10px var(--accent-glow),inset 0 1px 0 rgba(255,255,255,.18);
}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 14px 32px -10px var(--accent-glow),inset 0 1px 0 rgba(255,255,255,.18)}
.btn-primary:active{transform:translateY(0)}
.btn-secondary{
  color:var(--text-secondary);
  border:1px solid var(--border);
  background:transparent;
}
.btn-secondary:hover{color:var(--text-primary);background:var(--bg-muted)}
.assurance{
  position:relative;
  margin-top:36px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  font-family:var(--mono);
  font-size:11.5px;
  color:var(--text-muted);
  letter-spacing:.02em;
}
.assurance svg{width:13px;height:13px;color:#15803d;flex-shrink:0}
footer{
  position:relative;
  margin-top:40px;
  font-family:var(--mono);
  font-size:11px;
  color:var(--text-muted);
  letter-spacing:.06em;
}`;

const LOCK_SVG = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="12" y="28" width="40" height="28" rx="8" stroke="currentColor" stroke-width="3.5"/>
  <path d="M21 28v-7a11 11 0 0 1 22 0v7" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="32" cy="42" r="4" fill="currentColor"/>
  <path d="M32 46v5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M53 6L43 16M58 12l-6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".55"/>
</svg>`;

const SHIELD_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 3l7 2.5v5.09c0 4.66-3.2 8.4-7 9.41-3.8-1.01-7-4.75-7-9.41V5.5L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
  <path d="M8.8 11.8l2.2 2.2 4.2-4.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPageHtml({ rayId }: EmergencyPageOptions): string {
  const rayIdRow = rayId
    ? `<div class="kv"><label for="ray-id">Ray ID</label><code id="ray-id">${escapeHtml(rayId)}</code></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Serviço temporariamente indisponível · CriptEnv</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="bg-grid" aria-hidden="true"></div>
<div class="bg-glow" aria-hidden="true"></div>
<main>
  <a class="brand" href="/" aria-label="CriptEnv — página inicial">
    <span class="brand-mark" aria-hidden="true">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="10" width="16" height="11" rx="3" stroke="#fff" stroke-width="2.2"/>
        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="12" cy="15.5" r="1.6" fill="#fff"/>
      </svg>
    </span>
    <span class="brand-name">CriptEnv<small>zero-knowledge</small></span>
  </a>
  <div class="card">
    <span class="status-badge"><span class="status-dot" aria-hidden="true"></span>Erro 503 · serviço indisponível</span>
    <div class="error-icon" aria-hidden="true">${LOCK_SVG}</div>
    <h1>Algo deu errado <em>do nosso lado</em></h1>
    <p>Encontramos uma falha inesperada ao processar sua solicitação. Nossa equipe já foi notificada.</p>
    <p>Tente novamente em alguns instantes.</p>
    ${rayIdRow}
    <div class="actions">
      <a class="btn btn-primary" href="/">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M20 3v4h-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Tentar novamente
      </a>
      <a class="btn btn-secondary" href="https://status.criptenv.77mdevseven.tech" rel="noopener noreferrer">
        Status do serviço
      </a>
    </div>
    <div class="assurance">
      ${SHIELD_SVG}
      <span>Seus secrets continuam seguros — cifrados com AES-256-GCM no seu dispositivo.</span>
    </div>
  </div>
</main>
<footer>criptenv · você está vendo a página de emergência do edge</footer>
</body>
</html>`;
}

function extractRayId(request: Request): string | null {
  const header = request.headers.get("cf-ray");
  if (!header) {
    return null;
  }
  return header.split("-")[0] || header;
}

/**
 * Renders the branded emergency page. Never throws.
 */
export function renderEmergencyPage(request: Request): Response {
  let rayId: string | null = null;
  try {
    rayId = extractRayId(request);
  } catch {
    rayId = null;
  }

  try {
    return new Response(renderPageHtml({ rayId }), {
      status: 503,
      statusText: "Service Temporarily Unavailable",
      headers: {
        "content-type": "text/html; charset=utf-8",
        "retry-after": "60",
        "cache-control": "no-store",
        "x-emergency-fallback": "1",
      },
    });
  } catch {
    // Absolute last resort if even HTML generation fails.
    return new Response("CriptEnv — serviço temporariamente indisponível. Tente novamente em instantes.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "retry-after": "60",
        "x-emergency-fallback": "1",
      },
    });
  }
}

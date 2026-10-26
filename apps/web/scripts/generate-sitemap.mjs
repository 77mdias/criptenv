#!/usr/bin/env node
/**
 * Generates public/sitemap.xml from the public route tree, so new pages are
 * never left out of Google's index (the hand-written file had 3 of 38 pages).
 *
 * - Scans src/app/[locale]/(marketing) and (docs) for page.tsx; route groups
 *   are dropped from the URL and dynamic segments are skipped.
 * - Pages that use next-intl get one entry per locale with hreflang
 *   alternates (pt-BR unprefixed = x-default, en/es prefixed, matching
 *   `localePrefix: "as-needed"`). Portuguese-only pages are listed once, so
 *   untranslated copies under /en and /es are not advertised as duplicates.
 *
 * Usage: node scripts/generate-sitemap.mjs          # write the file
 *        node scripts/generate-sitemap.mjs --check  # CI: fail if stale
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SITE = "https://criptenv.77mdevseven.tech";
const LOCALES = ["pt-BR", "en", "es"];
const DEFAULT_LOCALE = "pt-BR";
const PUBLIC_GROUPS = ["(marketing)", "(docs)"];

const ROOT = process.cwd();
const APP = path.join(ROOT, "src", "app", "[locale]");
const OUT = path.join(ROOT, "public", "sitemap.xml");

function findPages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findPages(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

function routeOf(file) {
  const segments = path.relative(APP, path.dirname(file)).split(path.sep);
  if (segments.some((s) => s.startsWith("["))) return null; // dynamic route
  const visible = segments.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + visible.join("/");
}

function localizedUrl(route, locale) {
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  if (route === "/") return `${SITE}${prefix || "/"}`;
  return `${SITE}${prefix}${route}`;
}

const pages = PUBLIC_GROUPS.flatMap((group) => findPages(path.join(APP, group)))
  .map((file) => ({
    route: routeOf(file),
    translated: /\b(useTranslations|getTranslations)\(/.test(fs.readFileSync(file, "utf8")),
  }))
  .filter((page) => page.route !== null)
  .sort((a, b) => a.route.localeCompare(b.route));

const entries = [];
for (const { route, translated } of pages) {
  if (!translated) {
    entries.push(`  <url>\n    <loc>${localizedUrl(route, DEFAULT_LOCALE)}</loc>\n  </url>`);
    continue;
  }
  const alternates = [
    ...LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${localizedUrl(route, l)}"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${localizedUrl(route, DEFAULT_LOCALE)}"/>`,
  ].join("\n");
  for (const locale of LOCALES) {
    entries.push(`  <url>\n    <loc>${localizedUrl(route, locale)}</loc>\n${alternates}\n  </url>`);
  }
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...entries,
  "</urlset>",
  "",
].join("\n");

// Self-checks: a broken route mapping must never reach Google
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
assert.ok(locs.length > 0, "sitemap has no URLs");
assert.equal(new Set(locs).size, locs.length, "duplicate <loc> entries");
for (const loc of locs) {
  assert.ok(loc.startsWith(SITE), `foreign URL: ${loc}`);
  assert.ok(!/[()[\]]/.test(loc), `route group or dynamic segment leaked: ${loc}`);
}

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== xml) {
    console.error("public/sitemap.xml is out of date. Run: npm run sitemap");
    process.exit(1);
  }
  console.log(`sitemap OK — ${locs.length} URLs (${pages.length} pages)`);
} else {
  fs.writeFileSync(OUT, xml);
  console.log(`wrote public/sitemap.xml — ${locs.length} URLs (${pages.length} pages)`);
}

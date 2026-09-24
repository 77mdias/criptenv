#!/usr/bin/env node
/**
 * Pre-deploy guard: fails if a build artifact points at a localhost API.
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle at build time. If
 * the build runs without the production overrides (.env.production.local), the
 * localhost values from .env.local get baked in — OAuth and every API call then
 * break in production while looking perfectly fine in the build log
 * (happened 2026-09-24). This script runs after `vinext build` and before
 * `vinext deploy` to make that failure loud instead of silent.
 *
 * Usage: node scripts/check-deploy-env.mjs
 * Exits 1 if a localhost API host is found in the client bundle.
 */
import fs from "node:fs";
import path from "node:path";

const DIST_CLIENT = path.join(process.cwd(), "dist", "client");
const PATTERNS = [
  { re: /localhost:\d+/g, label: "localhost:<port>" },
  { re: /127\.0\.0\.1:\d+/g, label: "127.0.0.1:<port>" },
];

let files = [];
if (!fs.existsSync(DIST_CLIENT)) {
  console.error(
    `[check-deploy-env] dist/client not found — run the build before deploying.`,
  );
  process.exit(1);
}

walk(DIST_CLIENT, files);

const offenders = new Map();

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const { re, label } of PATTERNS) {
    const matches = content.match(re);
    if (matches) {
      const key = `${label} (${matches.length}×)`;
      if (!offenders.has(key)) offenders.set(key, []);
      offenders.get(key).push(path.relative(process.cwd(), file));
    }
  }
}

if (offenders.size > 0) {
  console.error(
    `\n[check-deploy-env] ABORTED: the client bundle contains localhost API hosts.\n` +
      `This breaks OAuth and every API call in production. The build ran without\n` +
      `the production overrides.\n\n` +
      `Fix: keep apps/web/.env.production.local filled in (see that file), then rebuild.\n`,
  );
  for (const [key, filesHit] of offenders) {
    console.error(`  ${key}`);
    for (const f of filesHit.slice(0, 5)) console.error(`    - ${f}`);
  }
  process.exit(1);
}

console.log(
  `[check-deploy-env] OK — no localhost API hosts in the client bundle (${files.length} files scanned).`,
);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "_worker" && entry.name !== "node_modules") walk(p, acc);
    } else if (/\.(js|mjs)$/.test(entry.name) && !/\.map$/.test(entry.name)) {
      acc.push(p);
    }
  }
  return acc;
}

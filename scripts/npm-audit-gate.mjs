#!/usr/bin/env node
// Production npm audit gate: fails on any high or critical advisory except the ones allowed below.
// Usage (in the package directory): npm audit --omit=dev --json | node ../../scripts/npm-audit-gate.mjs
//
// Allow an advisory only when no fixed version exists and the vulnerable code is unreachable in
// production; write down why and when to look again. Remove the entry as soon as a fix ships.
import { readFileSync } from "node:fs"

const ALLOWED = {
  // picomatch <= 4.0.7, ReDoS through repeated extglobs; no patched version published (2026-11-18).
  // Reaches the web app only through next-intl -> @parcel/watcher, the file watcher of its message
  // extractor: it matches globs from our own config at build/dev time, never user input, and is not
  // in the bundle. Revisit when picomatch publishes a fix (then drop this entry).
  "https://github.com/advisories/GHSA-fc5q-39xc-vjpf": "picomatch ReDoS, build-time file watcher only",
}

const BLOCKING = new Set(["high", "critical"])
const input = readFileSync(0, "utf8").trim()
if (!input) {
  // No report at all (npm crashed): never let that pass as "no advisories".
  console.error("npm audit produced no report.")
  process.exit(1)
}
const report = JSON.parse(input)
if (report.error) {
  console.error(`npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`)
  process.exit(1)
}

const advisories = new Map()
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    // Strings point at another package whose own entry carries the advisory.
    if (typeof via === "object" && BLOCKING.has(via.severity)) advisories.set(via.url, via)
  }
}

let blocked = 0
for (const [url, advisory] of advisories) {
  if (ALLOWED[url]) {
    console.log(`allowed  ${advisory.severity.padEnd(8)} ${advisory.name}: ${advisory.title} (${url}) — ${ALLOWED[url]}`)
  } else {
    blocked += 1
    console.log(`BLOCKING ${advisory.severity.padEnd(8)} ${advisory.name}: ${advisory.title} (${url})`)
  }
}
console.log(blocked ? `\n${blocked} blocking advisory(ies).` : "\nNo blocking advisories.")
process.exit(blocked ? 1 : 0)

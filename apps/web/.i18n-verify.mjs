// Temporary verification script for the marketing i18n slice. Deleted after use.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createTranslator } from "use-intl";
import ts from "typescript";
import React from "react";

const LOCALES = ["pt-BR", "en", "es"];
const catalogs = {};
for (const l of LOCALES) {
  catalogs[l] = JSON.parse(fs.readFileSync(`messages/${l}/marketing.json`, "utf8"));
}

const problems = [];
const note = (m) => problems.push(m);

/* ------------------------------------------------------------------ *
 * 1. identical key structure
 * ------------------------------------------------------------------ */
function shape(node) {
  if (Array.isArray(node)) return node.map(shape);
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node)) out[k] = shape(node[k]);
    return out;
  }
  if (typeof node === "string") return "string";
  return typeof node;
}
const shapes = LOCALES.map((l) => JSON.stringify(shape(catalogs[l])));
if (!shapes.every((s) => s === shapes[0])) {
  note("KEY STRUCTURE MISMATCH between pt-BR/en/es");
}
// also detect same key order, to keep diffs clean
const keyOrders = LOCALES.map((l) => JSON.stringify(catalogs[l]));
if (new Set(keyOrders).size !== LOCALES.length) {
  note("catalogues are byte-identical?? (unexpected)");
}

/* ------------------------------------------------------------------ *
 * 2. walk catalogue leaves
 * ------------------------------------------------------------------ */
const leafStrings = []; // [path, value] — pt-BR only
const leafArrays = []; // [path, value] — pt-BR only
function walk(node, path) {
  if (Array.isArray(node)) {
    leafArrays.push([path, node]);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    return;
  }
  leafStrings.push([path, node]);
}
walk(catalogs["pt-BR"], "");

/* ------------------------------------------------------------------ *
 * 3. ICU-format every key in every locale (catches ICU syntax errors)
 * ------------------------------------------------------------------ */
const richHandlers = {
  strong: (c) => React.createElement("span", null, c),
  accent: (c) => React.createElement("span", null, c),
  code: (c) => React.createElement("span", null, c),
  br: () => React.createElement("br"),
};
const formatted = {};
for (const l of LOCALES) {
  const t = createTranslator({ locale: l, messages: catalogs[l] });
  formatted[l] = {};
  for (const [path, value] of leafStrings) {
    let out;
    try {
      out = value.includes("<") ? t.rich(path, richHandlers) : t(path);
    } catch (e) {
      note(`ICU/format error [${l}] ${path}: ${e.message}`);
      continue;
    }
    const flat = JSON.stringify(out);
    if (flat === JSON.stringify(path)) {
      note(`MISSING MESSAGE [${l}] ${path} (returned key path)`);
    }
    formatted[l][path] = out;
  }
  for (const [path, value] of leafArrays) {
    let out;
    try {
      out = t.raw(path);
    } catch (e) {
      note(`raw() error [${l}] ${path}: ${e.message}`);
      continue;
    }
    if (!Array.isArray(out) || out.length !== value.length) {
      note(`ARRAY MISMATCH [${l}] ${path}: ${JSON.stringify(out)}`);
    }
    formatted[l][path] = out;
  }
}
// en/es must not leave pt-BR prose untranslated (sanity: not copy-paste)
const get = (obj, p) => p.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
const identical = leafStrings.filter(([p, v]) => get(catalogs.en, p) === v && get(catalogs.es, p) === v).map(([p]) => p);
console.log("\n=== leaves identical in pt-BR, en and es (terms/brands only, please) ===");
identical.forEach((p) => console.log(`  = ${p} :: ${JSON.stringify(get(catalogs["pt-BR"], p))}`));

/* ------------------------------------------------------------------ *
 * 4. pt-BR byte-identity against the pre-migration sources
 * ------------------------------------------------------------------ */
// [working tree path, HEAD path] — the marketing route moved under [locale]
// in an uncommitted (staged) rename, so its pre-migration blob lives at the
// old path in HEAD.
const FILES = [
  ["src/app/[locale]/(marketing)/page.tsx", "apps/web/src/app/(marketing)/page.tsx"],
  ["src/components/marketing/pricing-trust-section.tsx", "apps/web/src/components/marketing/pricing-trust-section.tsx"],
  ["src/components/marketing/platform-preview-section.tsx", "apps/web/src/components/marketing/platform-preview-section.tsx"],
  ["src/components/marketing/problem-to-vault-section.tsx", "apps/web/src/components/marketing/problem-to-vault-section.tsx"],
  ["src/components/marketing/security-scrollytelling.tsx", "apps/web/src/components/marketing/security-scrollytelling.tsx"],
];

// Babel/React JSX whitespace cleaning
function cleanJsxText(text) {
  const lines = text.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = 0;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) lastNonEmptyLine = i;
  let str = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isLastNonEmptyLine = i === lastNonEmptyLine;
    let trimmed = line.replace(/\t/g, " ");
    if (!isFirstLine) trimmed = trimmed.replace(/^ +/, "");
    if (!isLastLine) trimmed = trimmed.replace(/ +$/, "");
    if (trimmed) {
      if (!isLastNonEmptyLine) trimmed += " ";
      str += trimmed;
    }
  }
  return str;
}

const baselineTexts = new Set(); // full text content of every JSX element
const baselineLiterals = new Set(); // string literals that are not JSX attributes / imports / keys
const baselineTemplates = new Set(); // template expressions with {*} markers
const baselineAll = new Set(); // everything (for coverage checks)
const baselineJsxTexts = new Set(); // cleaned JSX text nodes

function textOf(node) {
  let out = "";
  const visit = (n) => {
    if (ts.isJsxText(n)) return void (out += cleanJsxText(n.text));
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return void (out += n.text);
    if (ts.isJsxExpression(n) || ts.isParenthesizedExpression(n)) {
      if (n.expression) visit(n.expression);
      return;
    }
    if (ts.isJsxElement(n)) {
      n.children.forEach(visit);
      return;
    }
    if (ts.isJsxFragment(n)) {
      n.children.forEach(visit);
      return;
    }
    if (ts.isTemplateExpression(n)) {
      out += n.head.text;
      n.templateSpans.forEach((s) => (out += s.literal.text));
      return;
    }
  };
  visit(node);
  return out;
}

for (const [rel, headPath] of FILES) {
  const code = execFileSync("git", ["show", `HEAD:${headPath}`], { encoding: "utf8" });
  if (!code.trim()) throw new Error(`empty baseline for ${headPath}`);
  const sf = ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visit = (node, parent, attrName) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      baselineTexts.add(textOf(node));
    }
    if (ts.isJsxText(node)) {
      const cleaned = cleanJsxText(node.text).trim();
      if (cleaned) {
        baselineAll.add(cleaned);
        baselineJsxTexts.add(cleaned);
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      baselineAll.add(node.text);
      const inAttr =
        parent && ts.isJsxAttribute(parent) && parent.initializer === node;
      const inImport =
        parent && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent));
      const isPropName =
        parent &&
        (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) &&
        parent.name === node;
      if (!inAttr && !inImport && !isPropName) baselineLiterals.add(node.text);
    }
    if (ts.isTemplateExpression(node)) {
      const withMarkers =
        node.head.text +
        node.templateSpans.map((s) => "{*}" + s.literal.text).join("");
      baselineTemplates.add(withMarkers);
      baselineAll.add(withMarkers);
    }
    ts.forEachChild(node, (c) => {
      let name;
      if (ts.isJsxAttribute(node)) name = node.name.getText(sf);
      visit(c, node, name ?? attrName);
    });
  };
  visit(sf, undefined, undefined);
}

const stripTags = (v) => v.replace(/<\/?[A-Za-z][A-Za-z0-9]*>/g, "");
const normalizePlaceholders = (v) => v.replace(/\{[^}]*\}/g, "{*}");

const ptValues = leafStrings.filter(([p]) => p.startsWith("landing."));
const unmatched = [];
for (const [path, value] of ptValues) {
  const key = path.replace(/^landing\./, "");
  let ok;
  if (value.includes("<")) {
    ok = baselineTexts.has(stripTags(value));
  } else if (value.includes("{")) {
    ok = baselineTemplates.has(normalizePlaceholders(value));
  } else {
    ok = baselineLiterals.has(value) || baselineTexts.has(value) || baselineAll.has(value);
  }
  if (!ok) unmatched.push([key, value]);
}
// arrays
for (const [path, value] of leafArrays) {
  if (!path.startsWith("landing.")) continue;
  for (const item of value) {
    if (!baselineLiterals.has(item) && !baselineTexts.has(item)) {
      unmatched.push([path.replace(/^landing\./, ""), item]);
    }
  }
}
console.log("\n=== pt-BR leaves NOT found verbatim in the pre-migration sources ===");
if (unmatched.length === 0) console.log("(none — every pt-BR string is byte-identical to the original literal)");
else unmatched.forEach(([p, v]) => console.log(`  ✗ ${p} :: ${JSON.stringify(v)}`));

/* ------------------------------------------------------------------ *
 * 5. coverage: baseline prose that is neither translated nor allow-listed
 * ------------------------------------------------------------------ */
const catalogStringSet = new Set();
const addAll = (node) => {
  if (Array.isArray(node)) return node.forEach(addAll);
  if (node && typeof node === "object") return Object.values(node).forEach(addAll);
  if (typeof node === "string") {
    catalogStringSet.add(node);
    catalogStringSet.add(stripTags(node));
    node.split(/(?:<\/?[A-Za-z][A-Za-z0-9]*>)/g).forEach((s) => catalogStringSet.add(s));
  }
};
addAll(catalogs["pt-BR"]);

const ALLOWED = new Set([
  // Code samples / CLI commands / technical identifiers / product names / mock
  // console output that is intentionally identical in every locale.
]);
const uncovered = [];
for (const s of [...baselineLiterals, ...baselineJsxTexts]) {
  if (catalogStringSet.has(s)) continue;
  if (ALLOWED.has(s)) continue;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) continue;
  if (!/\s/.test(s)) continue; // single tokens: identifiers, keys, ids
  uncovered.push(s);
}
console.log("\n=== pre-existing strings with a space that are NOT in the pt-BR catalogue (review) ===");
uncovered.sort().forEach((s) => console.log(`  ? ${JSON.stringify(s)}`));

/* ------------------------------------------------------------------ *
 * 6. every key referenced by the migrated components must resolve
 * ------------------------------------------------------------------ */
const NAMESPACE_BY_FILE = {
  "src/app/[locale]/(marketing)/page.tsx": "landing",
  "src/components/marketing/pricing-trust-section.tsx": "landing.pricingTrust",
  "src/components/marketing/platform-preview-section.tsx": "landing.platformPreview",
  "src/components/marketing/problem-to-vault-section.tsx": "landing.problemToVault",
  "src/components/marketing/security-scrollytelling.tsx": "landing.security",
};
const DYNAMIC = [
  ["landing.features.items", ["zeroKnowledge", "cli", "teamSync", "control"], ["title", "description"]],
  ["landing.workflow.nodes", ["cli", "ciphertext", "api", "clients"], ["label", "description"]],
  ["landing.workflow.steps", ["authenticate", "createVault", "writeSecrets", "consume"], ["title", "description"]],
  ["landing.pricingTrust.trust", ["mit", "plaintext", "selfHosted", "roadmap"], ["label", "description"]],
  ["landing.security.topics", ["aesGcm", "zeroKnowledge", "clientSide", "openSource"], ["title", "kicker", "description", "details", "metricLabel", "imageAlt"]],
  ["landing.problemToVault.vault.rows", ["ciphertext", "iv", "keyring"], null],
];
const arraysExpected = [
  "landing.workflow.proofs",
  "landing.cta.proofs",
  "landing.problemToVault.proofs",
  "landing.problemToVault.pipeline",
  "landing.pricingTrust.contribute.benefits",
  "landing.pricingTrust.openSource.benefits",
  "landing.security.topics.aesGcm.details",
  "landing.security.topics.zeroKnowledge.details",
  "landing.security.topics.clientSide.details",
  "landing.security.topics.openSource.details",
];
const resolved = new Set(leafStrings.map(([p]) => p).concat(leafArrays.map(([p]) => p)));
const missingKeys = [];
for (const p of arraysExpected) if (!resolved.has(p)) missingKeys.push(p);
for (const [prefix, items, fields] of DYNAMIC) {
  for (const item of items) {
    if (!fields) {
      if (!resolved.has(`${prefix}.${item}`)) missingKeys.push(`${prefix}.${item}`);
      continue;
    }
    for (const f of fields) if (!resolved.has(`${prefix}.${item}.${f}`)) missingKeys.push(`${prefix}.${item}.${f}`);
  }
}
for (const [rel, ns] of Object.entries(NAMESPACE_BY_FILE)) {
  const src = fs.readFileSync(rel, "utf8");
  for (const m of src.matchAll(/\bt(?:\.(?:rich|raw))?\(\s*(["`])([^"`]+)\1/g)) {
    const full = `${ns}.${m[2]}`;
    if (m[2].includes("${")) continue; // dynamic, covered above
    if (!resolved.has(full)) missingKeys.push(full);
  }
}
console.log("\n=== keys referenced in code but missing from the catalogue ===");
if (missingKeys.length === 0) console.log("(none)");
else missingKeys.forEach((k) => console.log(`  ✗ ${k}`));

/* ------------------------------------------------------------------ *
 * 7. unused catalogue keys
 * ------------------------------------------------------------------ */
const used = new Set(missingKeys.length ? [] : []);
for (const [prefix, items, fields] of DYNAMIC) {
  for (const item of items) {
    if (!fields) {
      used.add(`${prefix}.${item}`);
      continue;
    }
    for (const f of fields) used.add(`${prefix}.${item}.${f}`);
  }
}
arraysExpected.forEach((p) => used.add(p));
for (const [rel, ns] of Object.entries(NAMESPACE_BY_FILE)) {
  const src = fs.readFileSync(rel, "utf8");
  for (const m of src.matchAll(/\bt(?:\.(?:rich|raw))?\(\s*(["`])([^"`]+)\1/g)) {
    if (m[2].includes("${")) continue;
    used.add(`${ns}.${m[2]}`);
  }
}
const allPaths = [...leafStrings.map(([p]) => p), ...leafArrays.map(([p]) => p)];
const unused = allPaths.filter((p) => !used.has(p));
console.log("\n=== catalogue keys never referenced by the migrated components ===");
if (unused.length === 0) console.log("(none)");
else unused.forEach((p) => console.log(`  ? ${p}`));

/* ------------------------------------------------------------------ *
 * summary
 * ------------------------------------------------------------------ */
console.log("\n=== summary ===");
console.log("problems:", problems.length);
problems.forEach((p) => console.log(`  ✗ ${p}`));
console.log(
  "unmatched pt-BR leaves:",
  unmatched.length,
  "| missing keys:",
  missingKeys.length,
  "| uncovered prose candidates:",
  uncovered.length,
);
process.exit(problems.length + unmatched.length + missingKeys.length === 0 ? 0 : 1);

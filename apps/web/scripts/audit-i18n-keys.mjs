#!/usr/bin/env node
/**
 * Audits next-intl key coverage.
 *
 * For every translator variable in a file (`const t = useTranslations("ns")`,
 * `await getTranslations("ns")` or the `{ namespace: "ns" }` form) this collects
 * every key that variable is called with — including template literals expanded
 * against the file's `as const` key arrays — and verifies that each key resolves
 * in every locale catalogue.
 *
 * The first segment of a namespace is the catalogue file under
 * messages/<locale>/; the rest is the path inside it.
 *
 * Usage: node scripts/audit-i18n-keys.mjs [file ...]
 *        (no args = scan src/)      Exits 1 when any key is missing.
 */
import fs from "node:fs";
import path from "node:path";

const LOCALES = ["pt-BR", "en", "es"];
const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const MSG = path.join(ROOT, "messages");

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : walk(SRC);

const catalogues = {};
for (const locale of LOCALES) {
  catalogues[locale] = {};
  const dir = path.join(MSG, locale);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    catalogues[locale][path.basename(file, ".json")] = JSON.parse(
      fs.readFileSync(path.join(dir, file), "utf8"),
    );
  }
}

const lookup = (locale, path_) =>
  path_
    .split(".")
    .reduce(
      (node, key) => (node && typeof node === "object" ? node[key] : undefined),
      catalogues[locale],
    );

const resolves = (locale, catalogueName, path_) => {
  const value = lookup(locale, `${catalogueName}.${path_}`);
  return (
    typeof value === "string" ||
    Array.isArray(value) ||
    (value !== null && typeof value === "object")
  );
};

let problems = 0;
let checked = 0;

for (const file of targets) {
  const src = fs.readFileSync(file, "utf8");

  // 1) translator variable -> namespace(s). A name may be reused by two
  //    components in the same file with different namespaces; a key is then
  //    accepted if it resolves in any of them.
  const byName = new Map();
  const declRe =
    /(?:const|,)\s*(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]+)"|\{[^}]*?namespace:\s*"([^"]+)")/g;
  for (const m of src.matchAll(declRe)) {
    const name = m[1];
    const ns = m[2] ?? m[3];
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name).add(ns);
  }
  if (byName.size === 0) continue;

  // 2) stable key arrays used in template lookups (`t(`a.${item.key}.b`)`).
  const arrays = {};
  // covers `const xs = [...] as const` and typed forms like
  // `const xs: Item[] = [...]` — literals are only used as probe candidates.
  for (const m of src.matchAll(/const (\w+)(?::[^=]+)? = \[([^\]]*)\](?: as const)?/gs)) {
    const literals = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    if (literals.length) arrays[m[1]] = [...new Set(literals)];
  }

  let unresolvedInFile = 0;

  for (const [name, namespaces] of byName) {
    const keys = new Set();
    const ambiguous = [];

    const callRe = new RegExp(
      `\\b${name}(?:\\.(?:rich|raw))?\\(\\s*["'\`]([^"'\`]+)["'\`]`,
      "g",
    );
    for (const m of src.matchAll(callRe)) {
      const raw = m[1];
      if (raw.includes("${")) {
        const tpl = raw.match(/^([^$]*)\$\{([^}]+)\}/);
        if (!tpl) {
          keys.add(raw);
        } else {
          const base = tpl[2].split(".")[0];
          const literals = arrays[base] ?? arrays[tpl[2]];
          if (!literals) ambiguous.push(tpl[1]);
          else for (const lit of literals) keys.add(tpl[1] + lit);
        }
      } else {
        keys.add(raw);
      }
    }

    for (const namespace of namespaces) {
      const parts = namespace.split(".");
      const catalogueName = parts[0];
      const prefix = parts.slice(1).join(".");

      if (!(catalogueName in catalogues["pt-BR"])) {
        console.log(`MISSING catalogue messages/pt-BR/${catalogueName}.json (${rel(file)})`);
        problems += 1;
        continue;
      }

      // Expand ambiguous template prefixes against this namespace's own path.
      const everyKey = [...new Set(Object.values(arrays).flat())];
      for (const templatePrefix of ambiguous) {
        let resolvedAny = false;
        for (const literal of everyKey) {
          const path_ = `${prefix ? `${prefix}.` : ""}${templatePrefix}${literal}`;
          if (resolves("pt-BR", catalogueName, path_)) {
            // store relative to the namespace: the check below re-applies prefix
            keys.add(`${templatePrefix}${literal}`);
            resolvedAny = true;
          }
        }
        if (!resolvedAny) {
          console.log(
            `?? unresolved \${...} after "${templatePrefix}" in ${namespace} (${rel(file)})`,
          );
          unresolvedInFile += 1;
        }
      }
    }

    // 3) verify every locale.
    for (const namespace of namespaces) {
      const parts = namespace.split(".");
      const catalogueName = parts[0];
      const prefix = parts.slice(1).join(".");

      for (const locale of LOCALES) {
        if (!(catalogueName in catalogues[locale])) {
          console.log(`MISSING catalogue messages/${locale}/${catalogueName}.json`);
          problems += 1;
          continue;
        }
        for (const key of keys) {
          const path_ = prefix ? `${prefix}.${key}` : key;
          checked += 1;
          if (!resolves(locale, catalogueName, path_)) {
            console.log(
              `MISSING ${locale}  ${catalogueName}.${path_}  (${rel(file)})`,
            );
            problems += 1;
          }
        }
      }
    }
  }

  problems += unresolvedInFile;
}

console.log(
  problems === 0
    ? `i18n keys OK — ${checked} lookups resolved across ${LOCALES.length} locales`
    : `i18n keys: ${problems} problem(s) across ${checked} lookups`,
);
process.exit(problems === 0 ? 0 : 1);

function rel(file) {
  return path.relative(ROOT, file);
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|__tests__|\.next|dist/.test(entry.name)) walk(p, acc);
    } else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      acc.push(p);
    }
  }
  return acc;
}

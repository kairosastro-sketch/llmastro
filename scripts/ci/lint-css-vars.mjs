#!/usr/bin/env node
// CI-LINT-FRONTEND-V1 + LINT-CSS-CLEANUP-V1 — lint-css-vars.mjs
//
// Parse globals.css → liste des CSS custom properties déclarées.
// Scan apps/web/src/**/*.{tsx,ts,css} + apps/web/tailwind.config.ts → toutes les
// références `var(--xxx)`.
// Fail si une référence sans fallback n'est pas déclarée et pas dans la whitelist.
//
// Whitelist : --tw-* (Tailwind internals), --next-* (Next.js internals).
// Une référence avec fallback `var(--xxx, fallback)` est tolérée (assumée
// passée par inline style ou contexte local).
//
// LINT-CSS-CLEANUP-V1 : strip des commentaires (// et /* */) avant scan pour
// éviter les faux positifs sur les exemples documentés.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import process from "node:process";

const REPO_ROOT = resolve(process.argv[2] || ".");
const GLOBALS_CSS = join(REPO_ROOT, "apps/web/src/app/globals.css");
const SCAN_ROOTS = [
  join(REPO_ROOT, "apps/web/src"),
  join(REPO_ROOT, "apps/web/tailwind.config.ts"),
];
const SCAN_EXTS = new Set([".tsx", ".ts", ".css"]);

const WHITELIST_PREFIXES = ["--tw-", "--next-"];

function listFilesRec(start) {
  const out = [];
  let st;
  try {
    st = statSync(start);
  } catch {
    return out;
  }
  if (st.isFile()) {
    const ext = start.slice(start.lastIndexOf("."));
    if (SCAN_EXTS.has(ext)) out.push(start);
    return out;
  }
  if (!st.isDirectory()) return out;
  for (const name of readdirSync(start)) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    out.push(...listFilesRec(join(start, name)));
  }
  return out;
}

// Strip les commentaires en préservant les strings/templates et les sauts de
// ligne (pour conserver les numéros de ligne).
//   - .css : seulement /* ... */
//   - .ts/.tsx : // ... newline + /* ... */
function stripComments(src, ext) {
  const allowLine = ext !== ".css"; // CSS n'a pas de //
  let out = "";
  let i = 0;
  const n = src.length;
  let inSingle = false;
  let inDouble = false;
  let inTpl = false;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (!inSingle && !inDouble && !inTpl) {
      if (allowLine && c === "/" && c2 === "/") {
        while (i < n && src[i] !== "\n") i++;
        continue; // garde le '\n' suivant via la boucle principale
      }
      if (c === "/" && c2 === "*") {
        i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
          if (src[i] === "\n") out += "\n"; // préserve les lignes
          i++;
        }
        i += 2;
        continue;
      }
    }
    if (!inDouble && !inTpl && c === "'" && src[i - 1] !== "\\") inSingle = !inSingle;
    else if (!inSingle && !inTpl && c === '"' && src[i - 1] !== "\\") inDouble = !inDouble;
    else if (!inSingle && !inDouble && c === "`" && src[i - 1] !== "\\") inTpl = !inTpl;
    out += c;
    i++;
  }
  return out;
}

function extractDeclaredVars(cssText) {
  // Strip /* */ avant scan pour ignorer les déclarations en commentaire
  const stripped = stripComments(cssText, ".css");
  const declared = new Set();
  const re = /(--[a-z0-9_-]+)\s*:/gi;
  let m;
  while ((m = re.exec(stripped)) !== null) declared.add(m[1]);
  return declared;
}

function extractVarRefs(text) {
  const refs = [];
  const re = /var\(\s*(--[a-z0-9_-]+)(\s*,)?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    refs.push({ name: m[1], hasFallback: !!m[2] });
  }
  return refs;
}

function isWhitelisted(name) {
  return WHITELIST_PREFIXES.some((p) => name.startsWith(p));
}

function main() {
  let globalsText;
  try {
    globalsText = readFileSync(GLOBALS_CSS, "utf-8");
  } catch (e) {
    console.error(`[lint-css-vars] cannot read ${GLOBALS_CSS}: ${e.message}`);
    process.exit(2);
  }
  const declared = extractDeclaredVars(globalsText);

  const files = [];
  for (const root of SCAN_ROOTS) files.push(...listFilesRec(root));

  const orphans = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const ext = file.slice(file.lastIndexOf("."));
    const stripped = stripComments(text, ext);
    const lines = stripped.split("\n");
    lines.forEach((line, idx) => {
      const refs = extractVarRefs(line);
      for (const r of refs) {
        if (r.hasFallback) continue;
        if (declared.has(r.name)) continue;
        if (isWhitelisted(r.name)) continue;
        orphans.push({
          file: relative(REPO_ROOT, file),
          line: idx + 1,
          name: r.name,
        });
      }
    });
  }

  if (orphans.length === 0) {
    console.log(`[lint-css-vars] ✓ ${files.length} files scanned, ${declared.size} vars declared, no orphan reference.`);
    process.exit(0);
  }

  console.error(`[lint-css-vars] ✖ ${orphans.length} orphan var() references found:`);
  const byName = new Map();
  for (const o of orphans) {
    if (!byName.has(o.name)) byName.set(o.name, []);
    byName.get(o.name).push(`${o.file}:${o.line}`);
  }
  for (const [name, locs] of [...byName.entries()].sort()) {
    console.error(`  ${name}`);
    for (const loc of locs.slice(0, 5)) console.error(`    ${loc}`);
    if (locs.length > 5) console.error(`    ... (${locs.length - 5} more)`);
  }
  console.error("");
  console.error("Hint: declare the var in apps/web/src/app/globals.css, or use a fallback `var(--name, default)`.");
  process.exit(1);
}

main();

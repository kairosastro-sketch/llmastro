#!/usr/bin/env node
// CI-LINT-FRONTEND-V1 — lint-forbidden-classes.mjs
//
// Scan apps/web/src/**/*.{tsx,jsx,ts,js} pour des classes CSS blacklistées
// utilisées dans className= (string) ou className={template} ou clsx/cn().
// Fail si au moins une occurrence est trouvée.
//
// La liste noire correspond aux classes "fantômes" historiquement réintroduites
// par mégarde (cf. INPUTFIELD-FIX-V1, NATAL-FORM-CONTRACT-V1, TOASTER-FIX-V1).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import process from "node:process";

const REPO_ROOT = resolve(process.argv[2] || ".");
const SCAN_ROOT = join(REPO_ROOT, "apps/web/src");
const SCAN_EXTS = new Set([".tsx", ".jsx", ".ts", ".js"]);

const FORBIDDEN = [
  "input",
  "label",
  "form-error",
  "form-hint",
  "glass",
  "btn-primary",
  "text-mist",
];

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

// Strip C-style comments (line + block) so that we don't false-positive on notes.
// We're conservative: keep strings/template literals intact (no JSX-aware parser).
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let inSingle = false; // '...'
  let inDouble = false; // "..."
  let inTpl = false; //   `...`
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (!inSingle && !inDouble && !inTpl) {
      if (c === "/" && c2 === "/") {
        while (i < n && src[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && c2 === "*") {
        i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
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

// Return all `className` attribute *values* (raw inner text) and their source line.
function extractClassNameValues(src) {
  // We scan for className=" / className=' / className={`...`} / className={"..."} / className={'...'}
  // Also classes given to clsx() / cn() / twMerge() are NOT extracted here — that would need a JS parser.
  // Goal is detection on the most common cases.
  const out = []; // { value, line }
  // Build a line-index helper
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineStarts.push(i + 1);
  const lineOf = (offset) => {
    // binary search
    let lo = 0,
      hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  // Pattern A: className="..." or className='...'
  const reA = /className\s*=\s*(["'])([^"']*?)\1/g;
  let m;
  while ((m = reA.exec(src)) !== null) {
    out.push({ value: m[2], line: lineOf(m.index) });
  }
  // Pattern B: className={`...`} (template literal — capture only static parts)
  const reB = /className\s*=\s*\{`([^`]*?)`\}/g;
  while ((m = reB.exec(src)) !== null) {
    // Replace ${...} expressions with whitespace to keep static class detection
    const stripped = m[1].replace(/\$\{[^}]*\}/g, " ");
    out.push({ value: stripped, line: lineOf(m.index) });
  }
  // Pattern C: className={"..."} or className={'...'}
  const reC = /className\s*=\s*\{\s*(["'])([^"']*?)\1\s*\}/g;
  while ((m = reC.exec(src)) !== null) {
    out.push({ value: m[2], line: lineOf(m.index) });
  }
  return out;
}

function findForbidden(value) {
  // Tokenize on whitespace; check exact token match against blacklist.
  const tokens = value.split(/\s+/).filter(Boolean);
  const hits = new Set();
  for (const t of tokens) {
    // Some tokens may have responsive prefixes like "md:input" — strip them.
    const bare = t.includes(":") ? t.slice(t.lastIndexOf(":") + 1) : t;
    if (FORBIDDEN.includes(bare)) hits.add(bare);
  }
  return [...hits];
}

function main() {
  const files = listFilesRec(SCAN_ROOT);
  let total = 0;
  const findings = []; // { file, line, value, hits }

  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const stripped = stripComments(text);
    const values = extractClassNameValues(stripped);
    for (const v of values) {
      const hits = findForbidden(v.value);
      if (hits.length > 0) {
        findings.push({
          file: relative(REPO_ROOT, file),
          line: v.line,
          value: v.value.trim(),
          hits,
        });
        total += hits.length;
      }
    }
  }

  if (findings.length === 0) {
    console.log(`[lint-forbidden-classes] ✓ ${files.length} files scanned, no forbidden class found.`);
    process.exit(0);
  }

  console.error(`[lint-forbidden-classes] ✖ ${findings.length} occurrence(s) of forbidden classes:`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} → [${f.hits.join(", ")}]`);
    console.error(`    className="${f.value.length > 80 ? f.value.slice(0, 77) + "..." : f.value}"`);
  }
  console.error("");
  console.error("Forbidden list: " + FORBIDDEN.join(", "));
  console.error("Use real classes from apps/web/src/app/globals.css instead.");
  console.error("Reminder: .label → .form-label, .input → use base @layer input/textarea, .form-error → no class needed (style inline or via .alert-banner), .glass → .card, .btn-primary → .btn-ob");
  process.exit(1);
}

main();

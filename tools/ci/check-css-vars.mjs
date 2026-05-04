#!/usr/bin/env node
// CI-GUARDRAILS-V1 — check-css-vars (v2 — calibrated)
//
// Parses apps/web/src/app/globals.css to extract all declared CSS custom
// properties (--vars), plus whitelist entries via comments containing
// "ci-allow: --x". Then scans apps/web/src and tailwind.config.ts for
// var(--xxx) references. Fails if any reference has no declaration.
//
// CALIBRATION-V1 changes:
//   - Skip var() references inside JS/CSS comments
//   - Skip var(--xxx, fallback) references that have a fallback value
//
// Usage:
//   node tools/ci/check-css-vars.mjs --staged
//   node tools/ci/check-css-vars.mjs --full
//   node tools/ci/check-css-vars.mjs --json

import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  findRepoRoot, walkFiles, getStagedFiles, safeRead, hasSkipDirective,
  header, summarize, parseArgs, COLORS, relPath,
} from './_helpers.mjs';

const GLOBALS_CSS_REL = 'apps/web/src/app/globals.css';
const TAILWIND_CFG_REL = 'apps/web/tailwind.config.ts';
const SCAN_ROOT_REL = 'apps/web/src';

// Match `--name: value` declarations and ci-allow whitelist comments
const DECL_RE = /--([a-z][a-z0-9-]*)\s*:/gi;
// Note: pattern uses ci-allow with a colon to avoid the JSDoc closure issue
const ALLOW_RE = /ci-allow:\s*((?:--[a-z][a-z0-9-]*\s*,?\s*)+)/gi;
// Match `var(--name)` references; capture optional fallback comma to detect defensive pattern
const REF_RE = /var\(\s*(--[a-z][a-z0-9-]*)\s*(,)?/gi;

async function loadDeclaredVars(repoRoot) {
  const path = join(repoRoot, GLOBALS_CSS_REL);
  const content = await safeRead(path);
  if (content === null) {
    throw new Error(`Cannot read ${GLOBALS_CSS_REL} — is this run from the repo root?`);
  }
  const declared = new Set();

  for (const m of content.matchAll(DECL_RE)) {
    declared.add('--' + m[1]);
  }
  for (const m of content.matchAll(ALLOW_RE)) {
    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const n of names) declared.add(n);
  }
  return declared;
}

/**
 * Strip JS/CSS comments from a single line, given the current block-comment state.
 * Returns { code, inBlockComment } where code is the line with comments removed
 * (preserving column positions by replacing comment content with spaces).
 *
 * Handles:
 *   - // line comments (truncates rest of line)
 *   - / * block * / comments (single line and multi-line)
 *
 * Limitations:
 *   - Does not detect "//" inside string literals (rare for var(--x) usage)
 */
function stripCommentsFromLine(line, inBlockComment) {
  let result = '';
  let i = 0;
  let inBlock = inBlockComment;

  while (i < line.length) {
    if (inBlock) {
      // Look for end of block comment
      const endIdx = line.indexOf('*/', i);
      if (endIdx === -1) {
        // Block comment continues past this line
        // Replace remainder with spaces to preserve column positions
        result += ' '.repeat(line.length - i);
        return { code: result, inBlockComment: true };
      }
      // Replace comment content (up to and including */) with spaces
      result += ' '.repeat(endIdx + 2 - i);
      i = endIdx + 2;
      inBlock = false;
    } else {
      // Look for start of comment (block or line)
      const blockStart = line.indexOf('/*', i);
      const lineStart = line.indexOf('//', i);

      // No comment found in rest of line
      if (blockStart === -1 && lineStart === -1) {
        result += line.slice(i);
        return { code: result, inBlockComment: false };
      }

      // Determine which comes first
      const useBlock = blockStart !== -1 &&
        (lineStart === -1 || blockStart < lineStart);

      if (useBlock) {
        // Append code before block comment
        result += line.slice(i, blockStart);
        // Move to inside block comment
        i = blockStart + 2;
        result += '  '; // preserve cols of "/*"
        inBlock = true;
      } else {
        // Line comment: append code before, then spaces for the rest
        result += line.slice(i, lineStart);
        result += ' '.repeat(line.length - lineStart);
        return { code: result, inBlockComment: false };
      }
    }
  }
  return { code: result, inBlockComment: inBlock };
}

function findReferences(content) {
  const refs = [];
  const lines = content.split('\n');
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const { code, inBlockComment: nextState } = stripCommentsFromLine(
      lines[i], inBlockComment
    );
    inBlockComment = nextState;

    // Now scan the comment-stripped line for var(--xxx) references
    const re = new RegExp(REF_RE.source, 'gi');
    let m;
    while ((m = re.exec(code)) !== null) {
      const hasFallback = !!m[2]; // capture group 2 = the comma after var name
      if (hasFallback) {
        // var(--x, fallback) is a defensive pattern; tolerate it.
        continue;
      }
      refs.push({ name: m[1], line: i + 1, col: m.index + 1 });
    }
  }
  return refs;
}

async function scanFile(absPath, declared, repoRoot) {
  const content = await safeRead(absPath);
  if (content === null) return [];
  if (hasSkipDirective(content, 'ci-skip-css-vars')) return [];
  const refs = findReferences(content);
  const errors = [];
  for (const r of refs) {
    if (!declared.has(r.name)) {
      errors.push(`${relPath(repoRoot, absPath)}:${r.line}:${r.col}  unknown CSS var ${COLORS.red(r.name)}`);
    }
  }
  return errors;
}

function isScannable(absPath) {
  return /\.(tsx?|css|mjs|cjs|js|jsx)$/.test(absPath)
      && !/\.test\.(tsx?|jsx?)$/.test(absPath)
      && !/\.spec\.(tsx?|jsx?)$/.test(absPath)
      && !/\.next\//.test(absPath)
      && !/node_modules\//.test(absPath);
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = findRepoRoot();

  if (!args.json) header('check-css-vars');

  let declared;
  try {
    declared = await loadDeclaredVars(repoRoot);
  } catch (err) {
    if (args.json) console.log(JSON.stringify({ ok: false, error: err.message }));
    else console.error(COLORS.red(`✗ ${err.message}`));
    process.exit(2);
  }

  if (!args.json) console.log(COLORS.dim(`  ${declared.size} CSS vars declared in ${GLOBALS_CSS_REL}`));

  let files = [];
  if (args.staged) {
    files = getStagedFiles(repoRoot, ['ts', 'tsx', 'css', 'mjs', 'cjs', 'js', 'jsx'])
      .filter(isScannable);
    if (!args.json) console.log(COLORS.dim(`  Mode --staged: ${files.length} file(s)`));
  } else {
    const scanRoot = join(repoRoot, SCAN_ROOT_REL);
    files = await walkFiles(scanRoot, isScannable);
    // Also include tailwind.config.ts at the apps/web root
    const twCfg = join(repoRoot, TAILWIND_CFG_REL);
    if (await safeRead(twCfg) !== null) files.push(twCfg);
    if (!args.json) console.log(COLORS.dim(`  Mode --full: ${files.length} file(s) under ${SCAN_ROOT_REL}`));
  }

  // Always skip globals.css itself (it declares, doesn't reference)
  files = files.filter(f => !f.endsWith('/' + GLOBALS_CSS_REL.split('/').pop()));

  const allErrors = [];
  for (const f of files) {
    const errs = await scanFile(f, declared, repoRoot);
    allErrors.push(...errs);
  }

  if (args.json) {
    const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
    console.log(JSON.stringify({
      ok: allErrors.length === 0,
      declared_count: declared.size,
      scanned_count: files.length,
      errors: allErrors.map(stripAnsi),
    }, null, 2));
    process.exit(allErrors.length === 0 ? 0 : 1);
  }

  process.exit(summarize('check-css-vars', allErrors));
}

main().catch((err) => {
  console.error(COLORS.red(`✗ check-css-vars crashed: ${err.message}`));
  process.exit(2);
});

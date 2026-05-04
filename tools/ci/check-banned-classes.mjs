#!/usr/bin/env node
// CI-GUARDRAILS-V1 — check-banned-classes
//
// Scans source files for usage of historically-banned CSS class names and
// CSS custom properties. Reads the blacklist from tools/ci/banned-classes.json.
//
// Detects:
//   - Banned classes inside className="...", class="...", clsx(...), cn(...)
//   - Banned css_var_patterns inside var(--xxx) anywhere in source
//
// Usage:
//   node tools/ci/check-banned-classes.mjs --staged
//   node tools/ci/check-banned-classes.mjs --full
//   node tools/ci/check-banned-classes.mjs --json

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  findRepoRoot, walkFiles, getStagedFiles, safeRead, hasSkipDirective,
  header, summarize, parseArgs, COLORS, relPath,
} from './_helpers.mjs';

const BLACKLIST_REL = 'tools/ci/banned-classes.json';
const SCAN_ROOT_REL = 'apps/web/src';

async function loadBlacklist(repoRoot) {
  const path = join(repoRoot, BLACKLIST_REL);
  const content = await safeRead(path);
  if (content === null) {
    throw new Error(`Cannot read ${BLACKLIST_REL}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`${BLACKLIST_REL} is not valid JSON: ${err.message}`);
  }
  return {
    classes: Array.isArray(parsed.exact_classes) ? parsed.exact_classes : [],
    cssVars: Array.isArray(parsed.css_var_patterns) ? parsed.css_var_patterns : [],
  };
}

/**
 * Build a regex that matches a banned class name inside attribute strings.
 * Looks for the class in className="..." / class="..." / clsx(...) / cn(...) / classNames(...).
 *
 * Strategy: find the class as a whole word in any string-like literal context.
 * We use a permissive heuristic: match `className`, `class`, `clsx(`, `cn(`,
 * `classNames(`, `tw\`` (template literal) within ~200 chars before the match.
 */
function findBannedClassUsages(content, classes) {
  const findings = [];
  const lines = content.split('\n');
  const classSet = new Set(classes);

  // Scan tokens that look like CSS class names (word chars + dashes)
  const TOKEN_RE = /[a-z][a-z0-9_-]*/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look at lines containing className / class= / clsx( / cn( / classNames( / tw`
    const looksClassy =
      /\bclassName\s*=/.test(line) ||
      /\bclass\s*=/.test(line) ||
      /\bclsx\s*\(/.test(line) ||
      /\bcn\s*\(/.test(line) ||
      /\bclassNames\s*\(/.test(line) ||
      /\btw`/.test(line) ||
      /@apply\b/.test(line);  // CSS @apply directive

    if (!looksClassy) continue;

    // Within this line (and possibly next 2 lines for multi-line className)
    const window = lines.slice(i, Math.min(i + 3, lines.length)).join('\n');

    let m;
    const re = new RegExp(TOKEN_RE.source, 'gi');
    while ((m = re.exec(line)) !== null) {
      if (classSet.has(m[0])) {
        findings.push({
          name: m[0],
          line: i + 1,
          col: m.index + 1,
          kind: 'class',
        });
      }
    }
  }
  return findings;
}

function findBannedCssVarUsages(content, cssVars) {
  const findings = [];
  if (cssVars.length === 0) return findings;
  const lines = content.split('\n');
  // Build alternation of escaped names
  const escaped = cssVars.map(v => v.replace(/[-]/g, '\\-'));
  const RE = new RegExp(`var\\(\\s*(${escaped.join('|')})\\b`, 'g');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    const re = new RegExp(RE.source, 'g');
    while ((m = re.exec(line)) !== null) {
      findings.push({
        name: m[1],
        line: i + 1,
        col: m.index + 1,
        kind: 'css-var',
      });
    }
  }
  return findings;
}

async function scanFile(absPath, blacklist, repoRoot) {
  const content = await safeRead(absPath);
  if (content === null) return [];
  if (hasSkipDirective(content, 'ci-skip-banned-classes')) return [];

  const errors = [];

  for (const f of findBannedClassUsages(content, blacklist.classes)) {
    errors.push(`${relPath(repoRoot, absPath)}:${f.line}:${f.col}  banned class ${COLORS.red(f.name)}`);
  }
  for (const f of findBannedCssVarUsages(content, blacklist.cssVars)) {
    errors.push(`${relPath(repoRoot, absPath)}:${f.line}:${f.col}  banned CSS var ${COLORS.red(f.name)}`);
  }
  return errors;
}

function isScannable(absPath) {
  return /\.(tsx?|css|jsx?)$/.test(absPath)
      && !/\.test\.(tsx?|jsx?)$/.test(absPath)
      && !/\.spec\.(tsx?|jsx?)$/.test(absPath)
      && !/\.next\//.test(absPath)
      && !/node_modules\//.test(absPath);
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = findRepoRoot();

  if (!args.json) header('check-banned-classes');

  let blacklist;
  try {
    blacklist = await loadBlacklist(repoRoot);
  } catch (err) {
    if (args.json) console.log(JSON.stringify({ ok: false, error: err.message }));
    else console.error(COLORS.red(`✗ ${err.message}`));
    process.exit(2);
  }

  if (!args.json) {
    console.log(COLORS.dim(`  ${blacklist.classes.length} banned class(es), ${blacklist.cssVars.length} banned CSS var(s)`));
  }

  let files = [];
  if (args.staged) {
    files = getStagedFiles(repoRoot, ['ts', 'tsx', 'css', 'js', 'jsx'])
      .filter(isScannable);
    if (!args.json) console.log(COLORS.dim(`  Mode --staged: ${files.length} file(s)`));
  } else {
    const scanRoot = join(repoRoot, SCAN_ROOT_REL);
    files = await walkFiles(scanRoot, isScannable);
    if (!args.json) console.log(COLORS.dim(`  Mode --full: ${files.length} file(s) under ${SCAN_ROOT_REL}`));
  }

  const allErrors = [];
  for (const f of files) {
    const errs = await scanFile(f, blacklist, repoRoot);
    allErrors.push(...errs);
  }

  if (args.json) {
    const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
    console.log(JSON.stringify({
      ok: allErrors.length === 0,
      blacklist: { classes: blacklist.classes.length, css_vars: blacklist.cssVars.length },
      scanned_count: files.length,
      errors: allErrors.map(stripAnsi),
    }, null, 2));
    process.exit(allErrors.length === 0 ? 0 : 1);
  }

  process.exit(summarize('check-banned-classes', allErrors));
}

main().catch((err) => {
  console.error(COLORS.red(`✗ check-banned-classes crashed: ${err.message}`));
  process.exit(2);
});

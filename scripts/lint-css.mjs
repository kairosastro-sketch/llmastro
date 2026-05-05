#!/usr/bin/env node
// CI-CSS-LINT-V1
// Scans a directory tree for:
//  1. var(--xxx) references that are not declared in the given globals.css
//  2. CSS class names that are in a hard-coded blacklist (historical inventions)
//
// Usage:
//   node lint-css.mjs [src_dir] [globals_css_path]
//
// Defaults:
//   src_dir         = apps/web/src
//   globals_css_path = <src_dir>/app/globals.css
//
// Exits 0 on success, 1 on lint failures, 2 on fatal error (missing globals.css).

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const SRC_DIR = path.resolve(args[0] || 'apps/web/src');
const GLOBALS_CSS = path.resolve(args[1] || path.join(SRC_DIR, 'app/globals.css'));

const BLACKLIST = new Set([
  'input',
  'label',
  'form-error',
  'form-hint',
  'glass',
  'glass-strong',
  'glass-card',
  'btn-primary',
  'btn-secondary',
  'text-mist',
  'text-primary',
]);

const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const IGNORE_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'out']);

// ───────────────────────────── helpers ─────────────────────────────

function stripCommentsCSS(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripCommentsJS(src) {
  // Block comments first (covers /* */ and JSX {/* */} contents)
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Line comments (careful: this can break URLs in strings, but blacklist matches
  // are token-specific so the risk of false positives stays negligible)
  src = src.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return src;
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && SCAN_EXTS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

// ───────────────────── 1. extract declared CSS vars ─────────────────────

function extractDeclaredVars(cssPath) {
  if (!fs.existsSync(cssPath)) {
    console.error(`[lint-css] FATAL — globals.css not found at ${cssPath}`);
    process.exit(2);
  }
  const css = stripCommentsCSS(fs.readFileSync(cssPath, 'utf-8'));
  const vars = new Set();
  // Match `--name:` declarations only (not `var(--name)` references)
  const re = /(--[a-zA-Z0-9_-]+)\s*:/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    vars.add(m[1]);
  }
  return vars;
}

// ───────────────────── 2. scan files for issues ─────────────────────

const issues = [];

function scanForVars(src, file, declared) {
  const stripped = file.endsWith('.css') ? stripCommentsCSS(src) : stripCommentsJS(src);
  // Match var(--name)  or  var(--name, fallback)
  // Group 2 is the char following the name: ',' = explicit fallback (skip), ')' = no fallback (must be declared)
  const re = /var\(\s*(--[a-zA-Z0-9_-]+)\s*([,)])/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const name = m[1];
    const followed = m[2];
    if (followed === ',') continue; // var(--x, fallback) — intentional, skip
    if (!declared.has(name)) {
      issues.push({
        file,
        line: lineOf(stripped, m.index),
        kind: 'var',
        message: `uses var(${name}) — not declared in globals.css`,
      });
    }
  }
}

function checkTokens(value, file, lineNum, contextLabel) {
  const tokens = value.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (BLACKLIST.has(tok)) {
      issues.push({
        file,
        line: lineNum,
        kind: 'class',
        message: `class "${tok}" is blacklisted (${contextLabel})`,
      });
    }
  }
}

function scanForClasses(src, file) {
  const stripped = stripCommentsJS(src);

  // Direct className= usages: string literal, single quote, or template (no ${} expressions)
  const directPatterns = [
    { re: /className\s*=\s*"([^"]*)"/g, label: 'className=""' },
    { re: /className\s*=\s*'([^']*)'/g, label: "className=''" },
    { re: /className\s*=\s*\{\s*"([^"]*)"\s*\}/g, label: 'className={""}' },
    { re: /className\s*=\s*\{\s*'([^']*)'\s*\}/g, label: "className={''}" },
    { re: /className\s*=\s*\{\s*`([^`$]*)`\s*\}/g, label: 'className={``}' },
  ];

  for (const { re, label } of directPatterns) {
    let m;
    while ((m = re.exec(stripped)) !== null) {
      checkTokens(m[1], file, lineOf(stripped, m.index), label);
    }
  }

  // cn(...) / clsx(...) / classnames(...) / twMerge(...) — extract string literals from args
  const wrapperRe = /\b(?:cn|clsx|classnames|twMerge|twJoin)\s*\(([^)]*)\)/g;
  let wm;
  while ((wm = wrapperRe.exec(stripped)) !== null) {
    const argsBlock = wm[1];
    const argLine = lineOf(stripped, wm.index);
    // Pull out all string literals inside the wrapper args
    const stringLiterals = [
      ...argsBlock.matchAll(/"([^"]*)"/g),
      ...argsBlock.matchAll(/'([^']*)'/g),
      ...argsBlock.matchAll(/`([^`$]*)`/g),
    ];
    for (const s of stringLiterals) {
      checkTokens(s[1], file, argLine, 'cn/clsx/classnames(...)');
    }
  }
}

// ───────────────────── run ─────────────────────

if (!fs.existsSync(SRC_DIR)) {
  console.error(`[lint-css] FATAL — src dir not found: ${SRC_DIR}`);
  process.exit(2);
}

console.log(`[lint-css] Source dir   : ${SRC_DIR}`);
console.log(`[lint-css] Globals CSS  : ${GLOBALS_CSS}`);

const declared = extractDeclaredVars(GLOBALS_CSS);
console.log(`[lint-css] Declared vars: ${declared.size}`);

let scanned = 0;
for (const file of walk(SRC_DIR)) {
  const src = fs.readFileSync(file, 'utf-8');
  scanForVars(src, file, declared);
  if (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.js')) {
    scanForClasses(src, file);
  }
  scanned++;
}

console.log(`[lint-css] Scanned files: ${scanned}`);

if (issues.length === 0) {
  console.log('[lint-css] ✓ PASS — no issues found');
  process.exit(0);
}

issues.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

// Group output by kind for readability
const byKind = { var: [], class: [] };
for (const i of issues) byKind[i.kind].push(i);

if (byKind.var.length) {
  console.log(`\n── Undeclared CSS vars (${byKind.var.length}) ──`);
  for (const i of byKind.var) {
    console.log(`  ✗ ${path.relative(process.cwd(), i.file)}:${i.line} — ${i.message}`);
  }
}
if (byKind.class.length) {
  console.log(`\n── Blacklisted classes (${byKind.class.length}) ──`);
  for (const i of byKind.class) {
    console.log(`  ✗ ${path.relative(process.cwd(), i.file)}:${i.line} — ${i.message}`);
  }
}

console.log(`\n[lint-css] ✗ FAIL — ${issues.length} issue(s)`);
process.exit(1);

// CI-GUARDRAILS-V1 helpers (Node ESM, zero deps)
//
// Provides minimal utilities used by check-css-vars, check-banned-classes
// and test-fresh-db scripts. Native Node only — no npm packages.

import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

export const COLORS = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue:   (s) => `\x1b[34m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

/**
 * Find the repo root by walking up looking for .git directory.
 * Returns absolute path or throws.
 */
export function findRepoRoot(startDir = process.cwd()) {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) {
      throw new Error('Could not find repo root (no .git directory in ancestors)');
    }
    dir = parent;
  }
}

/**
 * Walk a directory recursively and return all file paths matching a predicate.
 * Skips node_modules, .next, .git, dist, build by default.
 */
export async function walkFiles(rootDir, predicate, opts = {}) {
  const skipDirs = new Set(opts.skipDirs ?? [
    'node_modules', '.next', '.git', 'dist', 'build', '.turbo', 'coverage',
  ]);
  const results = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EACCES') return;
      throw err;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        if (predicate(full)) results.push(full);
      }
    }
  }

  await walk(rootDir);
  return results;
}

/**
 * Get list of files staged for commit (mode --staged).
 * Returns absolute paths. Filters by extension predicate if provided.
 */
export function getStagedFiles(repoRoot, extensions = null) {
  let out;
  try {
    out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: repoRoot, encoding: 'utf8',
    });
  } catch (err) {
    throw new Error(`git diff failed: ${err.message}`);
  }
  const lines = out.split('\n').map(s => s.trim()).filter(Boolean);
  let files = lines.map(l => join(repoRoot, l));
  if (extensions) {
    const set = new Set(extensions.map(e => e.startsWith('.') ? e : '.' + e));
    files = files.filter(f => {
      const idx = f.lastIndexOf('.');
      return idx >= 0 && set.has(f.slice(idx));
    });
  }
  // Filter to files that still exist (could be deleted in working tree)
  return files.filter(f => existsSync(f));
}

/**
 * Read file, return null if not readable.
 */
export async function safeRead(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Check if a file's first 5 lines contain a skip directive.
 * Used for opt-out via line or block comments containing @ci-skip-X.
 */
export function hasSkipDirective(content, directive) {
  if (!content) return false;
  const head = content.split('\n').slice(0, 5).join('\n');
  return head.includes(`@${directive}`);
}

/**
 * Pretty-print a relative path from repo root.
 */
export function relPath(repoRoot, abs) {
  return relative(repoRoot, abs);
}

/**
 * Print a section header.
 */
export function header(title) {
  const bar = '─'.repeat(Math.max(0, 60 - title.length - 2));
  console.log(`\n${COLORS.blue('▸')} ${COLORS.blue(title)} ${COLORS.dim(bar)}`);
}

/**
 * Print result summary; return exit code (0 ok, 1 fail).
 */
export function summarize(label, errors) {
  if (errors.length === 0) {
    console.log(`${COLORS.green('✓')} ${label}: OK`);
    return 0;
  }
  console.log(`${COLORS.red('✗')} ${label}: ${errors.length} issue(s)`);
  for (const e of errors) console.log(`  ${COLORS.red('•')} ${e}`);
  return 1;
}

/**
 * Parse argv flags. Returns { staged: bool, full: bool, json: bool, ... }
 */
export function parseArgs(argv) {
  const args = { staged: false, full: false, json: false, fix: false, _: [] };
  for (const a of argv.slice(2)) {
    if (a === '--staged') args.staged = true;
    else if (a === '--full') args.full = true;
    else if (a === '--json') args.json = true;
    else if (a === '--fix') args.fix = true;
    else args._.push(a);
  }
  // Default to --full if neither staged nor full specified
  if (!args.staged && !args.full) args.full = true;
  return args;
}

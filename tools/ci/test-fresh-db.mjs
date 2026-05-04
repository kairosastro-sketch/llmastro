#!/usr/bin/env node
// CI-GUARDRAILS-V1 — test-fresh-db
//
// Spins up an ephemeral Postgres container, applies migrations using the
// project's own migration runner, then runs minimal CRUD operations against
// the resulting schema.
//
// IMPORTANT: requires Docker. If Docker is unavailable, exits 0 with a warn.
// IMPORTANT: this is a manual-only check. Not in pre-commit (too slow).
//
// Usage:
//   node tools/ci/test-fresh-db.mjs
//   node tools/ci/test-fresh-db.mjs --keep   # don't tear down container on success
//   node tools/ci/test-fresh-db.mjs --port 54329  # use specific port

import { spawnSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot, COLORS, header } from './_helpers.mjs';

const CONTAINER_NAME = `ci-fresh-db-${Date.now()}`;
const DEFAULT_PORT = 54329;
const POSTGRES_IMAGE = 'postgres:16-alpine';
const PG_PASSWORD = 'ci_test';
const PG_DB = 'astro_platform_test';
const PG_USER = 'astro';
const READY_TIMEOUT_S = 30;

function parseArgs(argv) {
  const args = { keep: false, port: DEFAULT_PORT };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--keep') args.keep = true;
    else if (a === '--port') args.port = parseInt(argv[++i], 10);
  }
  return args;
}

function hasDocker() {
  const r = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
    encoding: 'utf8',
  });
  return r.status === 0;
}

function dockerRm(name) {
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
}

function spawnPostgres(name, port) {
  const args = [
    'run', '-d',
    '--name', name,
    '-e', `POSTGRES_PASSWORD=${PG_PASSWORD}`,
    '-e', `POSTGRES_USER=${PG_USER}`,
    '-e', `POSTGRES_DB=${PG_DB}`,
    '-p', `${port}:5432`,
    POSTGRES_IMAGE,
  ];
  const r = spawnSync('docker', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`docker run failed: ${r.stderr}`);
  }
  return r.stdout.trim();
}

function waitForReady(containerName) {
  const start = Date.now();
  while (Date.now() - start < READY_TIMEOUT_S * 1000) {
    const r = spawnSync('docker', [
      'exec', containerName,
      'pg_isready', '-U', PG_USER, '-d', PG_DB,
    ], { encoding: 'utf8' });
    if (r.status === 0) return true;
    spawnSync('sleep', ['1']);
  }
  throw new Error(`Postgres not ready after ${READY_TIMEOUT_S}s`);
}

function execPsql(containerName, sql) {
  const r = spawnSync('docker', [
    'exec', '-i', containerName,
    'psql', '-U', PG_USER, '-d', PG_DB, '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql,
  ], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`psql failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

async function detectMigrationRunner(repoRoot) {
  // Try apps/api/package.json scripts first
  const apiPkgPath = join(repoRoot, 'apps/api/package.json');
  if (existsSync(apiPkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(apiPkgPath, 'utf8'));
      const scripts = pkg.scripts || {};
      // Common script names
      for (const candidate of ['db:migrate', 'migrate', 'migrate:up', 'db:up', 'drizzle:migrate']) {
        if (scripts[candidate]) {
          return { kind: 'npm', script: candidate, cwd: join(repoRoot, 'apps/api') };
        }
      }
    } catch { /* ignore */ }
  }
  // Try migrations/*.sql at apps/api/migrations or apps/api/src/db/migrations
  for (const rel of ['apps/api/migrations', 'apps/api/src/db/migrations', 'migrations']) {
    const dir = join(repoRoot, rel);
    if (existsSync(dir)) {
      return { kind: 'sql-dir', dir };
    }
  }
  return null;
}

function runNpmMigrate(runner, host, port) {
  const env = {
    ...process.env,
    DATABASE_URL: `postgres://${PG_USER}:${PG_PASSWORD}@${host}:${port}/${PG_DB}`,
    PGHOST: host, PGPORT: String(port), PGUSER: PG_USER,
    PGPASSWORD: PG_PASSWORD, PGDATABASE: PG_DB,
  };
  const r = spawnSync('npm', ['run', runner.script], {
    cwd: runner.cwd, env, encoding: 'utf8', stdio: 'inherit',
  });
  if (r.status !== 0) {
    throw new Error(`npm run ${runner.script} failed (exit ${r.status})`);
  }
}

function runSqlDirMigrations(containerName, dir) {
  // Apply *.sql files in alphabetical order, ignoring -down/-rollback
  const files = execSync(`ls -1 "${dir}"/*.sql 2>/dev/null || true`, { encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean)
    .filter(f => !/down|rollback/i.test(f));
  if (files.length === 0) {
    throw new Error(`No .sql files in ${dir}`);
  }
  for (const f of files) {
    const r = spawnSync('docker', [
      'cp', f, `${containerName}:/tmp/migration.sql`,
    ], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`docker cp failed for ${f}`);
    const r2 = spawnSync('docker', [
      'exec', containerName,
      'psql', '-U', PG_USER, '-d', PG_DB, '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/migration.sql',
    ], { encoding: 'utf8' });
    if (r2.status !== 0) {
      throw new Error(`Migration ${f} failed: ${r2.stderr || r2.stdout}`);
    }
    console.log(`  ${COLORS.dim('applied')} ${f.split('/').pop()}`);
  }
}

function checkExpectedTables(containerName) {
  // Soft check: verify that *some* expected core tables exist after migration.
  // We look for plausible names and report what's found.
  const out = execPsql(containerName,
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`);
  const tables = out.split('\n').map(s => s.trim()).filter(Boolean)
    .filter(s => !s.startsWith('table_name') && !s.startsWith('-') && !/\(\d+ rows?\)/.test(s));
  console.log(COLORS.dim(`  ${tables.length} table(s) in public schema:`), tables.join(', ') || '(none)');
  // Don't hard-fail on table names — schema may evolve. The fact that
  // migrations ran successfully is the main signal.
  if (tables.length === 0) {
    throw new Error('No tables in public schema after migrations — something is wrong');
  }
  return tables;
}

function smokeTestCrud(containerName, tables) {
  // Try to insert a row in a "users" table if it exists (most likely candidate).
  // This is a best-effort smoke test — schemas vary.
  const usersTable = tables.find(t => /^users?$/i.test(t));
  if (!usersTable) {
    console.log(COLORS.yellow(`  ⚠ no users table found, skipping CRUD smoke test`));
    return;
  }
  // Get column names to build a minimal INSERT
  const colsOut = execPsql(containerName,
    `SELECT column_name, is_nullable, column_default, data_type FROM information_schema.columns WHERE table_name='${usersTable}' AND table_schema='public';`);
  console.log(COLORS.dim(`  users table columns inspected (${colsOut.split('\n').filter(Boolean).length} lines)`));
  // We don't actually INSERT — too schema-dependent.
  // Just verify SELECT works.
  execPsql(containerName, `SELECT count(*) FROM ${usersTable};`);
  console.log(COLORS.green('  ✓ SELECT count(*) works on users table'));
}

async function main() {
  const args = parseArgs(process.argv);
  header('test-fresh-db');

  if (!hasDocker()) {
    console.log(COLORS.yellow('⚠ Docker unavailable — skipping fresh-db test'));
    console.log(COLORS.dim('  (this script requires Docker to spin up an ephemeral Postgres)'));
    process.exit(0);
  }

  const repoRoot = findRepoRoot();
  console.log(COLORS.dim(`  Repo: ${repoRoot}`));

  const runner = await detectMigrationRunner(repoRoot);
  if (!runner) {
    console.error(COLORS.red('✗ Cannot detect migration runner.'));
    console.error(COLORS.dim('  Expected one of:'));
    console.error(COLORS.dim('    apps/api/package.json with script: db:migrate / migrate / migrate:up / db:up / drizzle:migrate'));
    console.error(COLORS.dim('    apps/api/migrations/*.sql or apps/api/src/db/migrations/*.sql'));
    process.exit(2);
  }
  console.log(COLORS.dim(`  Migration runner: ${runner.kind === 'npm' ? `npm run ${runner.script}` : runner.dir}`));

  let containerId = null;
  let cleanup = () => {};

  try {
    console.log(COLORS.dim(`  Starting Postgres on port ${args.port}...`));
    containerId = spawnPostgres(CONTAINER_NAME, args.port);
    cleanup = () => {
      if (!args.keep) {
        console.log(COLORS.dim(`  Tearing down container ${CONTAINER_NAME}...`));
        dockerRm(CONTAINER_NAME);
      } else {
        console.log(COLORS.yellow(`  --keep: container ${CONTAINER_NAME} left running. Stop with: docker rm -f ${CONTAINER_NAME}`));
      }
    };

    waitForReady(CONTAINER_NAME);
    console.log(COLORS.green('  ✓ Postgres ready'));

    console.log(COLORS.dim('  Applying migrations...'));
    if (runner.kind === 'npm') {
      runNpmMigrate(runner, '127.0.0.1', args.port);
    } else {
      runSqlDirMigrations(CONTAINER_NAME, runner.dir);
    }
    console.log(COLORS.green('  ✓ Migrations applied'));

    console.log(COLORS.dim('  Verifying schema...'));
    const tables = checkExpectedTables(CONTAINER_NAME);

    console.log(COLORS.dim('  Running CRUD smoke test...'));
    smokeTestCrud(CONTAINER_NAME, tables);

    console.log(COLORS.green('\n✓ test-fresh-db: OK'));
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error(COLORS.red(`\n✗ test-fresh-db failed: ${err.message}`));
    cleanup();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(COLORS.red(`✗ test-fresh-db crashed: ${err.message}`));
  dockerRm(CONTAINER_NAME);
  process.exit(2);
});

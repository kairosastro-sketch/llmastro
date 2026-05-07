# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules (read first)

- **Never invent code or APIs.** If a function, file, route, env var, or library symbol isn't visible in the repo, **ask for the source** before writing anything that depends on it. No plausible-looking imports, no guessed type signatures, no stubbed-out "we'll wire this later" code paths.
- **Before touching code, run the existing CI checks locally** — they encode rules that are easy to violate by accident:
  1. `pnpm lint:css-vars` — every `var(--xxx)` referenced anywhere in `apps/web/src/**` or `tailwind.config.ts` must be declared in `apps/web/src/app/globals.css` (see `scripts/ci/lint-css-vars.mjs`).
  2. `pnpm test:fresh-db` — boots an empty Postgres + Neo4j + Redis, applies all migrations, and runs CRUD smoke tests (signup, login, create natal, create chat message). Fails if anything breaks (see `scripts/ci/fresh-db-test.sh`).
  3. `pnpm lint:forbidden-classes` — refuses CSS classes from the historical blacklist `\b(input|label|form-error|form-hint|glass|btn-primary|text-mist)\b` in `className=` (see `scripts/ci/lint-forbidden-classes.mjs`).
- `pnpm lint:ci` runs the two static lints together. Run them before opening a PR or applying a patch — both are CI-blocking on `main`/`develop`.

## Stack & layout

Monorepo pnpm + Turborepo (`pnpm-workspace.yaml` → `apps/*`, `packages/*`).

- `apps/api` — Fastify 4 backend (port 4000), Drizzle ORM on Postgres, Redis, Neo4j. Built with `tsup`, dev with `tsx watch`. ES modules: imports use `.js` suffix even for `.ts` files.
- `apps/web` — Next.js 14 App Router (port 3000), Tailwind, React Query. `output: "standalone"` for Docker. `swisseph` is treated as an external native module.
- `packages/ephemeris` — Astronomical calculations (Swiss Ephemeris in Moshier mode, with a `astracore` fallback engine selectable via `ASTRO_ENGINE`). Tested with vitest.
- `packages/neo4j` — Neo4j driver wrapper for the ephemeris graph.
- `packages/types` — Shared TS types.

Workspace deps use `workspace:*`. The API consumes packages directly from source (`main: ./src/index.ts`) — no separate build step for packages during dev.

## Common commands

```bash
# Bootstrap dev (checks prereqs, copies .env.local, starts postgres/neo4j/redis in Docker, then `pnpm dev`)
./scripts/dev.sh

# Workspace-wide via Turborepo
pnpm dev               # all dev servers
pnpm build             # api (tsup) + web (next build)
pnpm lint              # ESLint via turbo
pnpm type-check        # tsc --noEmit per package
pnpm test              # vitest in packages
pnpm lint:ci           # css-vars + forbidden-classes guardrails (frontend)
pnpm test:fresh-db     # spin up empty pg+neo4j+redis, boot the API image, assert migrations apply

# Single app
pnpm --filter @astro-platform/api dev
pnpm --filter @astro-platform/web build
pnpm --filter @astro-platform/ephemeris test

# Run a single vitest file
pnpm --filter @astro-platform/ephemeris exec vitest run path/to/file.test.ts

# Pre-commit/pre-push secret scan
bash safety-check.sh
```

The API expects Postgres, Redis, and Neo4j reachable per `.env.local`; use `docker compose up -d postgres redis neo4j` if you don't run `scripts/dev.sh`.

## API architecture

Entry: `apps/api/src/index.ts` exports `buildApp()`. Boot order matters:

1. **Fail-fast on secrets** — `requireSecret("JWT_SECRET", 32)` and `JWT_REFRESH_SECRET` must be ≥32 chars or the process exits. There is no dev fallback. `BACKEND_CORS_ORIGIN` must be set.
2. Fastify plugins: helmet, cors, rate-limit, jwt, cookie, swagger (UI at `/docs`).
3. **Boot tasks** in `src/boot/` run schema/init logic before route registration: `runMigrations` (Postgres), `initSchemaCoherence`, `initCities`, `initChat`, `initReadings`, `initStatsTables`, `initAdminFlag`, `bootTiers` (seed plans), `startTokenCleanup`, `startSkyPublication`.
4. Routes mounted from `src/routes/` (auth, natal, ephemeris, public-ephemeris, public-sky, horoscope, transits, ai, chat, compat, health, cities, subscriptions, admin, admin-panel).

`src/db/index.ts` owns the pg `Pool` and the Drizzle instance; `src/db/schema.ts` is the source of truth, `src/db/migrations/*.sql` are sequential SQL migrations applied at boot.

### Entitlements & quota gates

Two middlewares in `src/middleware/entitlements.middleware.ts` plug into Fastify `preHandler` after `authMiddleware`:

- `requireEntitlement("feature.key")` — boolean access check.
- `requireQuota("feature_or_bundle")` — increments a counter; result is exposed on `req.quotaResult` (`{ remaining, source: "quota" | "credit" }`).

Stock-cap features (e.g. `natal.profiles.max`) and forecast-window caps (`transits.forecast_days`) are enforced inline in handlers, not as middleware. The error code `FEATURE_NOT_AVAILABLE` triggers the front-end paywall.

Enforcement is gated by `ENTITLEMENTS_ENFORCED`. While `false`, middlewares log `would deny` / `would block` but pass through. Flip to `true` and `docker compose -f docker-compose.prod.yml restart api` once everything looks right. Mapping of routes → feature keys lives in `GATES_SNIPPETS.md`.

A dev-only `POST /subscriptions/dev/set-plan` is exposed when `DEV_PLAN_SWITCH=true` for plan switching during testing — must be off in prod.

## Web architecture

App Router under `apps/web/src/app/`. Page-level routes correspond to product surfaces (`dashboard`, `pricing`, `ciel`, `tarot` via components, `auth`, `admin`, etc.). Server components import `swisseph` via `experimental.serverComponentsExternalPackages`.

`NEXT_PUBLIC_API_URL` is **inlined at build time** — the value baked into `docker/web.Dockerfile` (`https://llmastro.com/api` in prod) wins over `.env.local`. SSR uses `INTERNAL_API_URL=http://api:4000` to reach the API container directly.

Strict CSP-adjacent headers (`X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=()…`) are set in `next.config.mjs`. Build errors are intentionally ignored (`typescript.ignoreBuildErrors: true`); rely on `pnpm type-check` instead.

## Frontend CSS guardrails (CI-blocking)

Two custom lints under `scripts/ci/` run in CI and locally as `pnpm lint:ci`:

- `lint-css-vars.mjs` — every `var(--xxx)` referenced in `apps/web/src/**/*.{tsx,ts,css}` must be declared in `apps/web/src/app/globals.css`, unless prefixed `--tw-*` / `--next-*` or written with a fallback `var(--xxx, default)`.
- `lint-forbidden-classes.mjs` — blacklists historically-reintroduced classes (`input`, `label`, `form-error`, `form-hint`, `glass`, `btn-primary`, `text-mist`). Only catches static `className` strings/template-literals; `clsx()`/`cn()`/`twMerge()` aren't parsed.

If you introduce a new design-system token, add it to `globals.css` first; if you remove an old class, also drop any blacklist entry that referenced it.

## Patches convention

Edits often follow a versioned-patch pattern (see README and the `// PATCH-…-V1 applied` / `# CONFIG-HYGIENE-V1 applied` markers throughout the codebase):

- Each change set has a name (`PATCH-FOO-V1`, `ARCHIVE-BAR-V1`, `HOTFIX-BAZ`).
- Marker comment at end of touched files; root-level marker file `.PATCH-FOO-V1-APPLIED`.
- Idempotent: re-running must be a no-op.
- SHA256-verified backup before write; bit-perfect rollback.

When you see `# PATCH-X-Y applied` lines (e.g. multiple `PATCH-COMPOSE-SECRETS-V*` lines in `docker-compose.prod.yml`), do **not** delete them — they are the audit trail.

## Secrets & safety

- `.env.example` is the only env file ever committed; everything else (`.env`, `.env.local`, `.env.production`, `.backup-*`) is gitignored. The boot will exit immediately if JWT secrets are weak.
- Generate secrets: `openssl rand -base64 48` (JWT), `openssl rand -hex 16` (admin token), `openssl rand -base64 24` (DB password). See `SECURITY.md` for the per-variable rotation procedure if anything leaks.
- `safety-check.sh` greps tracked files for committed secret patterns (xAI keys `xai-…`, postgres URLs with embedded passwords, `JWT_SECRET=…`, etc.). Run before any push.
- `.env.example` is meant to list **only variables actually consumed by code** (CONFIG-HYGIENE-V1). When adding a new env var to the template, either add a `process.env[…]` reference in code or annotate "réservée pour archive future X".

## Deployment

Production runs `docker-compose.prod.yml` on Ubuntu 24.04, behind Caddy 2 (auto Let's Encrypt). Caddyfile routes `/api/*` to `api:4000` and everything else to `web:3000`. Postgres password, Neo4j password, xAI key, etc. are read from `.env.local` on the VPS. The Swiss Ephemeris data volume (`swisseph_data`) is declared `external` in prod and must be created out-of-band.

CI (`.github/workflows/ci.yml`): setup → type-check / guardrails-css / lint / test (with pg+redis services) → build → docker (multi-arch push to GHCR on `main`/`develop`) → fresh-db-test (pulls the freshly-pushed API image and runs `scripts/ci/fresh-db-test.sh` against an empty DB; failure blocks the pipeline).

## Conventions

- TS strictness is partial: `strictNullChecks` and `noImplicitAny` are on, but full `strict` is off. `exactOptionalPropertyTypes` is off.
- Commit messages follow `@commitlint/config-conventional` (enforced via husky + lint-staged on touched files).
- ESM in the API: when adding imports between API source files, use the `.js` suffix.

#!/usr/bin/env bash
# CI-FRESH-DB-V1 — fresh-db-test.sh
#
# Prouve qu'une DB vide peut booter intégralement avec le code actuel.
# Spin up des containers Docker temporaires (postgres + redis + l'image
# API locale), attend que le boot init de l'API applique ses migrations, vérifie
# que le schéma final contient les tables attendues, puis nettoie tout.
#
# Le test fail explicitement si :
#   - les containers temporaires ne montent pas
#   - l'image API n'est pas disponible localement
#   - le boot API timeout (≥ 60s) sans appliquer les migrations
#   - une table CORE attendue est absente du schéma
#
# Usage :
#   bash scripts/ci/fresh-db-test.sh [REPO_ROOT]
#
# Variables d'env optionnelles :
#   FRESH_DB_API_IMAGE   image API à utiliser (défaut: astro-platform-api:latest)
#   FRESH_DB_BOOT_TIMEOUT  timeout boot en secondes (défaut: 60)
#   FRESH_DB_KEEP        si "1", ne nettoie pas les containers (debug)

set -euo pipefail

LABEL="fresh-db-test"
REPO_ROOT="${1:-${REPO_ROOT:-$(pwd)}}"
SUFFIX="$$-$(date +%s)"

API_IMAGE="${FRESH_DB_API_IMAGE:-astro-platform-api:latest}"
BOOT_TIMEOUT="${FRESH_DB_BOOT_TIMEOUT:-60}"
KEEP_CONTAINERS="${FRESH_DB_KEEP:-0}"

NETWORK="freshdb-net-$SUFFIX"
PG_NAME="freshdb-pg-$SUFFIX"
REDIS_NAME="freshdb-redis-$SUFFIX"
API_NAME="freshdb-api-$SUFFIX"

# Tables attendues — adapter cette liste si le schéma évolue.
CORE_TABLES=(
  users
  natal_data
  chat_conversations
  chat_messages
)
OPTIONAL_TABLES=(
  sessions
  refresh_tokens
  email_verifications
)

log()  { printf "[%s] %s\n" "$LABEL" "$*"; }
warn() { printf "[%s] ⚠ %s\n" "$LABEL" "$*" >&2; }
die()  { printf "[%s] ✖ %s\n" "$LABEL" "$*" >&2; cleanup_exit 2; }

cleanup_exit() {
  local code="${1:-0}"
  if [ "$KEEP_CONTAINERS" = "1" ]; then
    warn "FRESH_DB_KEEP=1 — leaving containers and network in place for debug"
    warn "  network: $NETWORK"
    warn "  containers: $PG_NAME $REDIS_NAME $API_NAME"
    exit "$code"
  fi
  for c in "$API_NAME" "$PG_NAME" "$REDIS_NAME"; do
    docker rm -f "$c" >/dev/null 2>&1 || true
  done
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  exit "$code"
}
trap 'cleanup_exit 130' INT TERM

# 0. Sanity
[ -d "$REPO_ROOT" ] || die "REPO_ROOT not found: $REPO_ROOT"
command -v docker >/dev/null 2>&1 || die "docker required"

if ! docker image inspect "$API_IMAGE" >/dev/null 2>&1; then
  die "API image not found locally: $API_IMAGE
       Build it first:
         cd $REPO_ROOT
         docker compose -f docker-compose.prod.yml build api
       Or override via FRESH_DB_API_IMAGE=<image:tag> bash scripts/ci/fresh-db-test.sh"
fi

log "Starting fresh DB test (suffix=$SUFFIX, api=$API_IMAGE, timeout=${BOOT_TIMEOUT}s)"

# 1. Network
log "Creating network: $NETWORK"
docker network create "$NETWORK" >/dev/null

# 2. Postgres
log "Starting postgres: $PG_NAME"
docker run -d --rm --name "$PG_NAME" \
  --network "$NETWORK" \
  -e POSTGRES_USER=astro \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=astro_platform_test \
  postgres:16-alpine >/dev/null

# 3. Redis
log "Starting redis: $REDIS_NAME"
docker run -d --rm --name "$REDIS_NAME" \
  --network "$NETWORK" \
  redis:7-alpine >/dev/null

# 4. Wait postgres ready
log "Waiting for postgres…"
for i in $(seq 1 30); do
  if docker exec "$PG_NAME" pg_isready -U astro -d astro_platform_test >/dev/null 2>&1; then
    log "  postgres ready (after ${i}s)"
    break
  fi
  if [ "$i" -eq 30 ]; then die "postgres did not become ready in 30s"; fi
  sleep 1
done

# 5. Run API container — only the boot/migrations should run, then we kill
log "Starting API container: $API_NAME (image=$API_IMAGE)"

# Collect env vars from real .env / .env.local if available (Next.js convention).
# Order matters: docker --env-file is "last wins" → .env first, .env.local last.
ENV_FILE_ARGS=()
for f in .env .env.local; do
  if [ -f "$REPO_ROOT/$f" ]; then
    ENV_FILE_ARGS+=("--env-file" "$REPO_ROOT/$f")
    log "  using $REPO_ROOT/$f"
  fi
done

docker run -d --name "$API_NAME" \
  --network "$NETWORK" \
  "${ENV_FILE_ARGS[@]}" \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://astro:test@$PG_NAME:5432/astro_platform_test" \
  -e REDIS_URL="redis://$REDIS_NAME:6379" \
  -e JWT_SECRET="ci_test_jwt_secret_dummy_value_min_32_chars_long_safe" \
  -e JWT_REFRESH_SECRET="ci_test_refresh_secret_dummy_value_min_32_chars_safe" \
  -e ENTITLEMENTS_ENFORCED="true" \
  -e DEV_PLAN_SWITCH="true" \
  "$API_IMAGE" >/dev/null

# 8. Poll : wait for migrations to land. Test = at least one CORE table present.
log "Waiting for migrations to apply (timeout ${BOOT_TIMEOUT}s)…"
SUCCESS=0
for i in $(seq 1 "$BOOT_TIMEOUT"); do
  found=$(docker exec "$PG_NAME" psql -U astro -d astro_platform_test -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users';" 2>/dev/null || echo "0")
  if [ "$found" = "1" ]; then
    SUCCESS=1
    log "  migrations applied (after ${i}s)"
    break
  fi
  # Also bail early if the api container died
  if ! docker ps --format '{{.Names}}' | grep -q "^${API_NAME}$"; then
    log "  API container exited — collecting logs:"
    docker logs --tail 50 "$API_NAME" 2>&1 | sed 's/^/    /' || true
    die "API container died before migrations were applied"
  fi
  sleep 1
done

if [ "$SUCCESS" = "0" ]; then
  log "API logs (tail 50):"
  docker logs --tail 50 "$API_NAME" 2>&1 | sed 's/^/    /' || true
  die "Boot timeout: 'users' table never appeared after ${BOOT_TIMEOUT}s"
fi

# Give 5s extra for the rest of the migrations to finish
sleep 5

# 9. Verify schema
log "Verifying schema…"
ALL_TABLES=$(docker exec "$PG_NAME" psql -U astro -d astro_platform_test -tAc \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;")
log "  tables found in schema:"
# shellcheck disable=SC2001
echo "$ALL_TABLES" | sed 's/^/    /'

MISSING_CORE=()
for t in "${CORE_TABLES[@]}"; do
  if ! echo "$ALL_TABLES" | grep -qx "$t"; then
    MISSING_CORE+=("$t")
  fi
done

MISSING_OPT=()
for t in "${OPTIONAL_TABLES[@]}"; do
  if ! echo "$ALL_TABLES" | grep -qx "$t"; then
    MISSING_OPT+=("$t")
  fi
done

if [ "${#MISSING_OPT[@]}" -gt 0 ]; then
  warn "Optional tables missing (info only): ${MISSING_OPT[*]}"
fi

if [ "${#MISSING_CORE[@]}" -gt 0 ]; then
  log "API logs (tail 30):"
  docker logs --tail 30 "$API_NAME" 2>&1 | sed 's/^/    /' || true
  die "Missing CORE tables: ${MISSING_CORE[*]}"
fi

# 10. CI-FRESH-DB-V2-CRUD : Verify seed (plans + plan_entitlements)
log "Verifying plans seed…"

PLANS_COUNT=$(docker exec "$PG_NAME" psql -U astro -d astro_platform_test -tAc \
  "SELECT count(*) FROM plans WHERE is_active = true;")
if [ "$PLANS_COUNT" -lt 3 ]; then
  log "API logs (tail 30):"
  docker logs --tail 30 "$API_NAME" 2>&1 | sed 's/^/    /' || true
  die "Expected at least 3 active plans, got $PLANS_COUNT (seeder did not run?)"
fi
log "  active plans: $PLANS_COUNT (>=3 OK)"

EXPECTED_CODES="essential|free|premium"
ACTUAL_CODES=$(docker exec "$PG_NAME" psql -U astro -d astro_platform_test -tAc \
  "SELECT string_agg(code, '|' ORDER BY code) FROM plans WHERE is_active = true;")
if [ "$ACTUAL_CODES" != "$EXPECTED_CODES" ]; then
  die "Expected plan codes '$EXPECTED_CODES', got '$ACTUAL_CODES'"
fi
log "  plan codes: $ACTUAL_CODES OK"

ENTITLEMENTS_COUNT=$(docker exec "$PG_NAME" psql -U astro -d astro_platform_test -tAc \
  "SELECT count(*) FROM plan_entitlements;")
if [ "$ENTITLEMENTS_COUNT" -lt 90 ]; then
  die "Expected at least 90 plan_entitlements (prod has 105), got $ENTITLEMENTS_COUNT"
fi
log "  plan_entitlements: $ENTITLEMENTS_COUNT (>=90 OK)"

MIN_PER_PLAN=30
INCOMPLETE=$(docker exec "$PG_NAME" psql -U astro -d astro_platform_test -tAc \
  "SELECT p.code FROM plans p
   LEFT JOIN plan_entitlements pe ON pe.plan_id = p.id
   WHERE p.is_active = true
   GROUP BY p.code
   HAVING count(pe.id) < $MIN_PER_PLAN;")
if [ -n "$INCOMPLETE" ]; then
  die "Plans with fewer than $MIN_PER_PLAN entitlements: $(echo "$INCOMPLETE" | tr '\n' ' ')"
fi
log "  each plan has >=$MIN_PER_PLAN entitlements OK"

# 11. CI-FRESH-DB-V2-CRUD : Smoke test — INSERT into users
# Validates that the users table can accept a row with the documented
# schema (defaults, NOT NULL, UNIQUE on email). Deletes the test row at
# the end so the DB stays pristine.
log "Smoke test: INSERT into users…"
TEST_EMAIL="freshdb-test-${SUFFIX}@example.com"
# CI-FRESH-DB-V2-CRUD-FIX-V1: psql -tAc émet le tag "INSERT 0 1" en plus de
# l'UUID retourné par RETURNING. On capture la sortie complète puis on
# extrait strictement un UUID valide via regex (pas de tag, pas de
# whitespace parasite). Si le grep ne match rien → vraie erreur.
INSERT_OUTPUT=$(docker exec "$PG_NAME" psql -U astro -d astro_platform_test -tAc \
  "INSERT INTO users (email, name, provider, password_hash)
   VALUES ('$TEST_EMAIL', 'Fresh DB Test', 'local', 'fake-hash-not-real')
   RETURNING id;" 2>&1)
INSERTED_ID=$(echo "$INSERT_OUTPUT" | grep -Eo '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' | head -n1)
if [ -z "$INSERTED_ID" ]; then
  log "API logs (tail 30):"
  docker logs --tail 30 "$API_NAME" 2>&1 | sed 's/^/    /' || true
  die "Failed to INSERT user — schema may be incoherent. psql output: $INSERT_OUTPUT"
fi
log "  inserted user id=$INSERTED_ID OK"

# Verify defaults applied (email_verified default false, timestamps NOT NULL)
DEFAULTS_OK=$(docker exec "$PG_NAME" psql -U astro -d astro_platform_test -tAc \
  "SELECT email_verified IS NOT NULL
       AND created_at IS NOT NULL
       AND updated_at IS NOT NULL
   FROM users WHERE id = '$INSERTED_ID';")
if [ "$DEFAULTS_OK" != "t" ]; then
  die "User row created but defaults not applied (email_verified/created_at/updated_at)"
fi
log "  defaults applied OK"

# Cleanup: remove test user so the DB ends clean (in case KEEP=1 is used)
docker exec "$PG_NAME" psql -U astro -d astro_platform_test -c \
  "DELETE FROM users WHERE id = '$INSERTED_ID';" >/dev/null
log "  cleanup OK"

# 12. CI-FRESH-DB-V3-GATES : HTTP smoke test des gates d'entitlements
# Le container API tourne avec ENTITLEMENTS_ENFORCED=true + DEV_PLAN_SWITCH=true.
# On signup un user → switch en free → on appelle les routes gated et on
# vérifie les codes/erreurs renvoyés.
log "Testing entitlement gates over HTTP (enforcement=on)…"

GATES_SCRIPT="$REPO_ROOT/scripts/ci/test-entitlements-gates.mjs"
if [ ! -f "$GATES_SCRIPT" ]; then
  die "Missing gates test script: $GATES_SCRIPT"
fi

# Wait for /health to respond (Fastify ready)
log "  Waiting for API /health…"
API_OK=0
for i in $(seq 1 60); do
  if docker exec "$API_NAME" node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    API_OK=1
    log "    API ready (after ${i}s)"
    break
  fi
  if ! docker ps --format '{{.Names}}' | grep -q "^${API_NAME}$"; then
    docker logs --tail 30 "$API_NAME" 2>&1 | sed 's/^/    /' || true
    die "API container died before /health responded"
  fi
  sleep 1
done
if [ "$API_OK" = "0" ]; then
  docker logs --tail 30 "$API_NAME" 2>&1 | sed 's/^/    /' || true
  die "API /health never responded"
fi

# Copy gates test script into the API container then run it
docker cp "$GATES_SCRIPT" "$API_NAME:/tmp/test-entitlements-gates.mjs" >/dev/null

GATES_EMAIL="gates-test-${SUFFIX}@example.com"
log "  Running gates test (user=$GATES_EMAIL)…"
set +e
GATES_OUT=$(docker exec \
  -e BASE_URL="http://localhost:4000" \
  -e TEST_EMAIL="$GATES_EMAIL" \
  "$API_NAME" \
  node /tmp/test-entitlements-gates.mjs 2>&1)
GATES_EXIT=$?
set -e

# Display structured output regardless
echo "$GATES_OUT" | sed 's/^/    /'

if [ "$GATES_EXIT" != "0" ]; then
  log "  API logs (tail 40):"
  docker logs --tail 40 "$API_NAME" 2>&1 | sed 's/^/    /' || true
  die "Entitlement gates HTTP test failed (exit=$GATES_EXIT)"
fi
log "  gates HTTP test OK"

log "✅ Fresh DB test passed. CORE schema is coherent + gates enforce as expected."
log "  CORE tables present: ${CORE_TABLES[*]}"

cleanup_exit 0

# CI-FRESH-DB-V1-FIX-V1 applied
# CI-FRESH-DB-V2-CRUD applied
# CI-FRESH-DB-V2-CRUD-FIX-V1 applied
# CI-FRESH-DB-V3-GATES applied

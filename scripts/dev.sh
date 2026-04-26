#!/usr/bin/env bash
# ============================================================
# ASTRO PLATFORM — Dev Bootstrap
# Usage: ./scripts/dev.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✕${NC}  $*" >&2; }
header()  { echo -e "\n${CYAN}══ $* ══${NC}\n"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Prerequisite checks ──────────────────────────────────────
header "Checking prerequisites"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    success "$1 found ($(command -v "$1"))"
  else
    error "$1 not found. Please install it."
    exit 1
  fi
}

check_cmd node
check_cmd pnpm
check_cmd docker

NODE_VER=$(node -e "process.stdout.write(process.version.slice(1))")
MAJOR="${NODE_VER%%.*}"
if [[ $MAJOR -lt 20 ]]; then
  error "Node.js ≥ 20 required (found $NODE_VER)"
  exit 1
fi
success "Node.js $NODE_VER"

# ── .env.local ───────────────────────────────────────────────
header "Environment"

if [[ ! -f .env.local ]]; then
  warn ".env.local not found — copying from .env.example"
  cp .env.example .env.local
  warn "Edit .env.local with your OAuth credentials before using OAuth login"
else
  success ".env.local exists"
fi

# ── Install dependencies ─────────────────────────────────────
header "Installing dependencies"

pnpm install --frozen-lockfile
success "Dependencies installed"

# ── Start infrastructure ─────────────────────────────────────
header "Starting Docker services (Postgres, Neo4j, Redis)"

docker compose up -d postgres neo4j redis
info "Waiting for services to be healthy…"

wait_healthy() {
  local name="$1" max=30 i=0
  while [[ $i -lt $max ]]; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "astro-$name" 2>/dev/null || echo "starting")
    if [[ "$status" == "healthy" ]]; then
      success "$name is healthy"
      return 0
    fi
    sleep 2; ((i++))
    echo -n "."
  done
  echo
  error "$name did not become healthy in time"
  return 1
}

wait_healthy postgres
wait_healthy redis

# Neo4j takes longer
info "Waiting for Neo4j (may take ~30s on first run)…"
for i in {1..20}; do
  if docker exec astro-neo4j neo4j status &>/dev/null; then
    success "Neo4j is ready"
    break
  fi
  sleep 3; echo -n "."
  if [[ $i -eq 20 ]]; then echo; warn "Neo4j may still be starting — check logs with: docker logs astro-neo4j"; fi
done

# ── Print access URLs ─────────────────────────────────────────
header "Services ready"

echo -e "  ${CYAN}Web app${NC}       → http://localhost:3000"
echo -e "  ${CYAN}API${NC}           → http://localhost:4000"
echo -e "  ${CYAN}API Docs${NC}      → http://localhost:4000/docs"
echo -e "  ${CYAN}Neo4j Browser${NC} → http://localhost:7474"
echo -e "  ${CYAN}Adminer${NC}       → http://localhost:8080  (run with: docker compose --profile tools up adminer)"
echo ""

# ── Start Turborepo dev ───────────────────────────────────────
header "Starting dev servers"
info "Running: pnpm dev (Turborepo)"
pnpm dev

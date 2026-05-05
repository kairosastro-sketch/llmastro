#!/usr/bin/env bash
# CI-GUARDRAILS-V1 — check-css-guardrails.sh
#
# Wrapper qui run les deux checks CSS (vars + blacklist) et fail si l'un d'eux fail.
#
# Usage : bash scripts/ci/check-css-guardrails.sh [REPO_ROOT]
#         défaut REPO_ROOT = pwd
#
# Conçu pour tourner :
#   - en CI (job guardrails-css)
#   - localement avant push
#   - depuis un futur apply.sh d'archive (en pre-flight check)

set -uo pipefail

REPO_ROOT="${1:-$(pwd)}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "$REPO_ROOT" ]; then
  printf "[guardrails-css] REPO_ROOT not a directory: %s\n" "$REPO_ROOT" >&2
  exit 2
fi

PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then
  printf "[guardrails-css] python3 not found in PATH\n" >&2
  exit 2
fi

VARS_SCRIPT="$SCRIPT_DIR/check-css-vars.py"
BLACKLIST_SCRIPT="$SCRIPT_DIR/check-css-blacklist.py"

if [ ! -f "$VARS_SCRIPT" ]; then
  printf "[guardrails-css] missing: %s\n" "$VARS_SCRIPT" >&2
  exit 2
fi
if [ ! -f "$BLACKLIST_SCRIPT" ]; then
  printf "[guardrails-css] missing: %s\n" "$BLACKLIST_SCRIPT" >&2
  exit 2
fi

printf "[guardrails-css] running check-css-vars on %s\n" "$REPO_ROOT"
"$PY" "$VARS_SCRIPT" "$REPO_ROOT"
RC_VARS=$?

printf "[guardrails-css] running check-css-blacklist on %s\n" "$REPO_ROOT"
"$PY" "$BLACKLIST_SCRIPT" "$REPO_ROOT"
RC_BL=$?

if [ "$RC_VARS" -eq 0 ] && [ "$RC_BL" -eq 0 ]; then
  printf "[guardrails-css] ✓ ALL CHECKS PASSED\n"
  exit 0
fi

printf "[guardrails-css] ✗ FAIL — vars=%d blacklist=%d\n" "$RC_VARS" "$RC_BL" >&2

# Return the worst exit code (priority to IO errors = 2)
if [ "$RC_VARS" -eq 2 ] || [ "$RC_BL" -eq 2 ]; then
  exit 2
fi
exit 1

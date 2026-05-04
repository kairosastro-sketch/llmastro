#!/usr/bin/env bash
# CI-GUARDRAILS-V1 — git hooks installer (opt-in)
#
# Run from repo root: bash tools/git-hooks/install.sh
# Creates a symlink .git/hooks/pre-commit -> tools/git-hooks/pre-commit
# Use --copy to copy instead of symlink (Windows-friendly).
# Use --uninstall to remove.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

HOOK_SRC="tools/git-hooks/pre-commit"
HOOK_DST=".git/hooks/pre-commit"

MODE="symlink"
UNINSTALL=0

for arg in "$@"; do
  case "$arg" in
    --copy)      MODE="copy" ;;
    --uninstall) UNINSTALL=1 ;;
    *) echo "Unknown arg: $arg"; exit 2 ;;
  esac
done

if [ "$UNINSTALL" -eq 1 ]; then
  if [ -e "$HOOK_DST" ] || [ -L "$HOOK_DST" ]; then
    rm -f "$HOOK_DST"
    echo "✓ Removed $HOOK_DST"
  else
    echo "  No hook installed at $HOOK_DST"
  fi
  exit 0
fi

if [ ! -f "$HOOK_SRC" ]; then
  echo "✗ $HOOK_SRC not found. Run from repo root after applying CI-GUARDRAILS-V1."
  exit 2
fi

mkdir -p .git/hooks

# Remove existing hook if present
if [ -e "$HOOK_DST" ] || [ -L "$HOOK_DST" ]; then
  echo "  Replacing existing $HOOK_DST"
  rm -f "$HOOK_DST"
fi

if [ "$MODE" = "symlink" ]; then
  ln -s "../../$HOOK_SRC" "$HOOK_DST"
  echo "✓ Symlinked $HOOK_DST -> ../../$HOOK_SRC"
else
  cp "$HOOK_SRC" "$HOOK_DST"
  chmod +x "$HOOK_DST"
  echo "✓ Copied $HOOK_SRC -> $HOOK_DST"
fi

echo ""
echo "Pre-commit hook is now active."
echo "  Bypass for emergencies with: git commit --no-verify"
echo "  Uninstall with: bash tools/git-hooks/install.sh --uninstall"

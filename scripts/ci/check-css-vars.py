#!/usr/bin/env python3
"""
CI-GUARDRAILS-V1 — check-css-vars.py
MINOR-FIXES-V1: now strips comments before scanning AND accepts var(--x, fallback).

Vérifie que toute var CSS référencée via var(--xxx) dans le code TS/TSX/CSS
ou tailwind.config.ts est bien déclarée dans apps/web/src/app/globals.css.

Skip cases (intentional, no error raised):
  - var(--xxx, fallback)  — explicit fallback means caller knows the var
                            might not exist; lint allows it
  - // var(--xxx)          — line comment (stripped before scan)
  - /* var(--xxx) */       — block comment (stripped before scan)
  - vars containing "${"   — template literal expressions
  - vars in WHITELIST_PREFIXES (tw-, next-, radix-)

Exit codes :
  0 — clean
  1 — au moins une var non-déclarée trouvée (sans fallback, hors commentaires)
  2 — erreur d'IO (globals.css introuvable, etc.)

Usage : python3 check-css-vars.py [REPO_ROOT]
        défaut REPO_ROOT = pwd
"""

from __future__ import annotations
import os
import re
import sys
from pathlib import Path

WHITELIST_PREFIXES = ("tw-", "next-", "radix-")

# Match :   --foo:   or   --foo-bar:   en début de ligne
DECL_RE = re.compile(r"^\s*--([\w-]+)\s*:", re.MULTILINE)

# Match var(--foo) OR var(--foo, fallback) and capture:
#   group(1) = name
#   group(2) = "," (fallback present) or ")" (no fallback)
USAGE_RE = re.compile(r"var\(\s*--([\w-]+)\s*([,)])")

# Comment strippers
BLOCK_COMMENT_RE = re.compile(r"/\*[\s\S]*?\*/")
LINE_COMMENT_RE = re.compile(r"(^|[^:])//[^\n]*")  # avoid matching URLs like https://

# Extensions à scanner pour les usages
SCAN_EXT = (".ts", ".tsx", ".css", ".js", ".jsx")

# Dossiers à exclure
EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".turbo",
    "dist",
    "build",
    ".git",
    "coverage",
}


def find_globals_css(repo_root: Path) -> Path:
    candidates = [
        repo_root / "apps" / "web" / "src" / "app" / "globals.css",
    ]
    for c in candidates:
        if c.is_file():
            return c
    sys.stderr.write(
        f"[check-css-vars] globals.css not found. Tried: {[str(c) for c in candidates]}\n"
    )
    sys.exit(2)


def read_declared_vars(globals_css: Path) -> set[str]:
    text = globals_css.read_text(encoding="utf-8")
    # Strip block comments before extracting decls (avoid matching --foo: in comments)
    text = BLOCK_COMMENT_RE.sub("", text)
    return set(DECL_RE.findall(text))


def is_whitelisted(name: str) -> bool:
    return any(name.startswith(p) for p in WHITELIST_PREFIXES)


def should_skip_dir(name: str) -> bool:
    if name in EXCLUDE_DIRS:
        return True
    # backups runtime laissés par les archives
    if name.startswith(".archive-") and name.endswith("-backup"):
        return True
    if name.startswith(".") and name not in {".github"}:
        return True
    return False


def strip_comments(src: str, is_css: bool) -> str:
    """Strip block + line comments so the var(...) scanner doesn't false-positive
    on commented-out code or doc strings like `// CSS color (var(--xxx) ou hex)`."""
    src = BLOCK_COMMENT_RE.sub("", src)
    if not is_css:
        # CSS doesn't have // line comments (they're invalid). Only strip in JS/TS.
        # Preserve the leading char of the match (group(1)) to not eat URL prefixes.
        src = LINE_COMMENT_RE.sub(lambda m: m.group(1), src)
    return src


def iter_source_files(repo_root: Path):
    """Yield Path de tous les fichiers source à scanner."""
    targets = [
        repo_root / "apps" / "web" / "src",
        repo_root / "apps" / "web" / "tailwind.config.ts",
        repo_root / "apps" / "web" / "tailwind.config.js",
    ]
    for target in targets:
        if not target.exists():
            continue
        if target.is_file():
            if target.suffix in SCAN_EXT:
                yield target
            continue
        # walk dir
        for root, dirs, files in os.walk(target):
            dirs[:] = [d for d in dirs if not should_skip_dir(d)]
            for f in files:
                if f.endswith(SCAN_EXT):
                    yield Path(root) / f


def line_of(src: str, idx: int) -> int:
    return src.count("\n", 0, idx) + 1


def scan_file(path: Path, declared: set[str]) -> list[tuple[int, str]]:
    """Return list of (lineno, varname) for undeclared, non-fallback,
    non-commented references in this file."""
    try:
        src = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []
    is_css = path.suffix == ".css"
    cleaned = strip_comments(src, is_css)
    issues = []
    for m in USAGE_RE.finditer(cleaned):
        name = m.group(1)
        followed = m.group(2)
        if "$" in name:
            continue  # template literal expr
        if followed == ",":
            continue  # explicit fallback present
        if is_whitelisted(name):
            continue
        if name not in declared:
            issues.append((line_of(cleaned, m.start()), name))
    return issues


def main() -> int:
    repo_root = Path(sys.argv[1] if len(sys.argv) > 1 else os.getcwd()).resolve()
    if not repo_root.is_dir():
        sys.stderr.write(f"[check-css-vars] not a directory: {repo_root}\n")
        return 2

    globals_css = find_globals_css(repo_root)
    declared = read_declared_vars(globals_css)

    all_issues: list[tuple[Path, int, str]] = []
    for f in iter_source_files(repo_root):
        for line, name in scan_file(f, declared):
            all_issues.append((f, line, name))

    if not all_issues:
        print(f"[check-css-vars] OK — {len(declared)} declared vars, all references resolved")
        return 0

    print(f"[check-css-vars] FAIL — {len(all_issues)} undeclared var usage(s):")
    for f, line, name in sorted(all_issues, key=lambda x: (str(x[0]), x[1])):
        rel = f.relative_to(repo_root) if f.is_relative_to(repo_root) else f
        print(f"  {rel}:{line}: var(--{name}) is not declared in globals.css")

    print("[check-css-vars] declared vars in apps/web/src/app/globals.css:")
    print("  " + ", ".join(sorted(declared)))
    return 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
CI-GUARDRAILS-V1 — check-css-vars.py

Vérifie que toute var CSS référencée via var(--xxx) dans le code TS/TSX/CSS
ou tailwind.config.ts est bien déclarée dans apps/web/src/app/globals.css.

Whitelist :
  - --tw-*    (Tailwind built-in)
  - --next-*  (Next.js built-in)
  - --radix-* (shadcn/Radix)

Skip :
  - Vars contenant "$" (template literals dynamiques type var(--gold-${variant}))

Exit codes :
  0 — clean
  1 — au moins une var non-déclarée trouvée
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

# Match :
#   --foo:
#   --foo-bar:
# en début de ligne (potentiellement précédé de whitespace).
DECL_RE = re.compile(r"^\s*--([\w-]+)\s*:", re.MULTILINE)

# Match var(--foo) ou var(--foo, fallback)
USAGE_RE = re.compile(r"var\(\s*--([\w-]+)")

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
            yield target
            continue
        for root, dirs, files in os.walk(target):
            dirs[:] = [d for d in dirs if not should_skip_dir(d)]
            for fname in files:
                if any(fname.endswith(ext) for ext in SCAN_EXT):
                    yield Path(root) / fname


def find_usages(repo_root: Path):
    """Yield (Path, line_number, var_name) pour chaque var(--xxx) trouvée."""
    for src in iter_source_files(repo_root):
        try:
            content = src.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for line_no, line in enumerate(content.splitlines(), 1):
            for m in USAGE_RE.finditer(line):
                name = m.group(1)
                # Skip template-literal-style vars (dynamic, can't statically check)
                # Match scope: full match span in line
                start, end = m.span()
                # If $ appears in the span, it's likely dynamic — skip
                fragment = line[start:end + 30]  # peek a bit further for ${
                if "$" in fragment[:end - start + 30] and "${" in line:
                    # Tighter check: $ must appear inside the var(...) parens
                    # Find the matching closing paren
                    paren_depth = 1
                    i = end
                    while i < len(line) and paren_depth > 0:
                        if line[i] == "(":
                            paren_depth += 1
                        elif line[i] == ")":
                            paren_depth -= 1
                        i += 1
                    inner = line[start:i]
                    if "${" in inner:
                        continue
                yield src, line_no, name


def main():
    repo_root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
    if not repo_root.is_dir():
        sys.stderr.write(f"[check-css-vars] REPO_ROOT not a directory: {repo_root}\n")
        sys.exit(2)

    globals_css = find_globals_css(repo_root)
    declared = read_declared_vars(globals_css)

    violations: list[tuple[Path, int, str]] = []
    for src, line_no, name in find_usages(repo_root):
        if name in declared:
            continue
        if is_whitelisted(name):
            continue
        violations.append((src, line_no, name))

    if not violations:
        print(f"[check-css-vars] OK — {len(declared)} vars declared, all usages valid.")
        sys.exit(0)

    sys.stderr.write(f"[check-css-vars] FAIL — {len(violations)} undeclared var usage(s):\n")
    for src, line_no, name in violations:
        try:
            rel = src.relative_to(repo_root)
        except ValueError:
            rel = src
        sys.stderr.write(f"  {rel}:{line_no}: var(--{name}) is not declared in globals.css\n")
    sys.stderr.write(
        f"\n[check-css-vars] declared vars in {globals_css.relative_to(repo_root)}:\n"
    )
    sys.stderr.write("  " + ", ".join(sorted(declared)) + "\n")
    sys.exit(1)


if __name__ == "__main__":
    main()

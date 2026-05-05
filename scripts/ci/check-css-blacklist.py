#!/usr/bin/env python3
"""
CI-GUARDRAILS-V1 — check-css-blacklist.py

Refuse l'usage de classes CSS connues comme inventées dans les attributs
className= (TSX/JSX) ou class= (HTML).

Liste blacklist (dérivée du Project File LLMASTRO 2026-05-01 — section §5
"Variables/Classes INVENTÉES dans le passé") :

  Class             |  Bonne version
  ------------------|---------------------------
  input             |  héritage @layer base input (pas de classe)
  label             |  form-label
  form-error        |  inexistant — créer une classe propre
  form-hint         |  inexistant — créer une classe propre
  glass             |  inexistant
  glass-strong      |  inexistant
  btn-primary       |  btn-ob
  btn-secondary     |  btn-ghost
  text-mist         |  utiliser var(--muted) ou --muted-2
  alert-warning     |  alert-banner + ab-ico
  alert-error       |  alert-banner + ab-ico
  alert-success     |  alert-banner + ab-ico
  spinner-sm        |  spinner

Échappatoire : commentaire "css-blacklist-ignore" sur la ligne (ou
"css-blacklist-ignore-next-line" sur la ligne précédente). Utiliser
parcimonieusement, justifier en commentaire.

Scope strict : ne match QUE les valeurs d'attribut className= ou class=.
Ne match PAS les balises <input>, <label>, etc. — c'est voulu.

Exit codes :
  0 — clean
  1 — au moins une violation
  2 — erreur d'IO
"""

from __future__ import annotations
import os
import re
import sys
from pathlib import Path

BLACKLIST: dict[str, str] = {
    "input": "héritage @layer base input (pas de classe)",
    "label": "form-label",
    "form-error": "n'existe pas — créer une classe propre",
    "form-hint": "n'existe pas — créer une classe propre",
    "glass": "n'existe pas",
    "glass-strong": "n'existe pas",
    "btn-primary": "btn-ob",
    "btn-secondary": "btn-ghost",
    "text-mist": "var(--muted) ou var(--muted-2)",
    "alert-warning": "alert-banner + ab-ico",
    "alert-error": "alert-banner + ab-ico",
    "alert-success": "alert-banner + ab-ico",
    "spinner-sm": "spinner",
}

IGNORE_INLINE_RE = re.compile(r"css-blacklist-ignore(?!-next-line)")
IGNORE_NEXT_LINE_RE = re.compile(r"css-blacklist-ignore-next-line")

# Match les valeurs des attributs className=… et class=…
# Capture la valeur "à plat" — splitting des tokens fait après.
ATTR_PATTERNS = [
    # className="..."
    re.compile(r'''className\s*=\s*"([^"]*)"'''),
    # className='...'
    re.compile(r'''className\s*=\s*'([^']*)' '''.strip()),
    # className={"..."}
    re.compile(r'''className\s*=\s*\{\s*"([^"]*)"\s*\}'''),
    # className={'...'}
    re.compile(r'''className\s*=\s*\{\s*'([^']*)'\s*\}'''),
    # className={`...`}
    re.compile(r'''className\s*=\s*\{\s*`([^`]*)`\s*\}'''),
    # class="..." (HTML/SVG)
    re.compile(r'''(?<!\w)class\s*=\s*"([^"]*)"'''),
    # class='...' (HTML/SVG)
    re.compile(r'''(?<!\w)class\s*=\s*'([^']*)' '''.strip()),
]

SCAN_EXT = (".ts", ".tsx", ".js", ".jsx", ".html", ".htm")

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".turbo",
    "dist",
    "build",
    ".git",
    "coverage",
}


def should_skip_dir(name: str) -> bool:
    if name in EXCLUDE_DIRS:
        return True
    if name.startswith(".archive-") and name.endswith("-backup"):
        return True
    if name.startswith(".") and name not in {".github"}:
        return True
    return False


def should_skip_file(path: Path) -> bool:
    name = path.name
    # backups runtime
    if ".bak-" in name or name.endswith(".bak"):
        return True
    return False


def iter_source_files(repo_root: Path):
    targets = [
        repo_root / "apps" / "web" / "src",
    ]
    for target in targets:
        if not target.exists():
            continue
        for root, dirs, files in os.walk(target):
            dirs[:] = [d for d in dirs if not should_skip_dir(d)]
            for fname in files:
                if not any(fname.endswith(ext) for ext in SCAN_EXT):
                    continue
                p = Path(root) / fname
                if should_skip_file(p):
                    continue
                yield p


def tokens_in_value(value: str) -> list[str]:
    """Split une valeur d'attribut className en tokens.
    Les ${...} embarqués deviennent des tokens non-matchables, c'est OK."""
    return [t for t in re.split(r"\s+", value) if t]


def check_file(path: Path) -> list[tuple[int, str, str]]:
    """Retourne liste de (line_no, class_name, suggestion) pour les violations."""
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []

    lines = content.splitlines()
    violations: list[tuple[int, str, str]] = []
    next_line_ignored = False

    for line_no, line in enumerate(lines, 1):
        if next_line_ignored:
            next_line_ignored = False
            if IGNORE_NEXT_LINE_RE.search(line):
                # chained next-line, propagate
                next_line_ignored = True
            continue

        if IGNORE_NEXT_LINE_RE.search(line):
            next_line_ignored = True
            # Skip checking this line itself? No — the comment is on its own line
            # but the ignore applies to the NEXT line. The current line might still
            # be checked. But if it also has 'css-blacklist-ignore' we skip it too.
            if not IGNORE_INLINE_RE.search(line):
                # Continue to check this line normally
                pass
            else:
                continue

        if IGNORE_INLINE_RE.search(line):
            continue

        for pat in ATTR_PATTERNS:
            for m in pat.finditer(line):
                value = m.group(1)
                for tok in tokens_in_value(value):
                    if tok in BLACKLIST:
                        violations.append((line_no, tok, BLACKLIST[tok]))

    return violations


def main():
    repo_root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
    if not repo_root.is_dir():
        sys.stderr.write(f"[check-css-blacklist] REPO_ROOT not a directory: {repo_root}\n")
        sys.exit(2)

    total_violations: list[tuple[Path, int, str, str]] = []
    files_scanned = 0
    for src in iter_source_files(repo_root):
        files_scanned += 1
        for line_no, cls, suggestion in check_file(src):
            total_violations.append((src, line_no, cls, suggestion))

    if not total_violations:
        print(f"[check-css-blacklist] OK — {files_scanned} file(s) scanned, no violation.")
        sys.exit(0)

    sys.stderr.write(
        f"[check-css-blacklist] FAIL — {len(total_violations)} violation(s) "
        f"in {files_scanned} file(s) scanned:\n"
    )
    for src, line_no, cls, suggestion in total_violations:
        try:
            rel = src.relative_to(repo_root)
        except ValueError:
            rel = src
        sys.stderr.write(f"  {rel}:{line_no}: forbidden class \"{cls}\" → use {suggestion}\n")
    sys.stderr.write(
        "\n[check-css-blacklist] To override on a specific line, append "
        "`/* css-blacklist-ignore */` or `// css-blacklist-ignore`.\n"
    )
    sys.exit(1)


if __name__ == "__main__":
    main()

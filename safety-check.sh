#!/usr/bin/env bash
# safety-check.sh V2 — scan les fichiers tracés Git pour secrets en clair.
# V2 : ignore les valeurs entre ${...} (interpolations Docker Compose).
#
# Usage : bash safety-check.sh [TARGET_ROOT]
# Exit 0 si OK, 1 si secret détecté.

set -euo pipefail

TARGET_ROOT="${1:-$(pwd)}"
TARGET_ROOT="$(cd "$TARGET_ROOT" && pwd)"

cd "$TARGET_ROOT"

if [[ ! -d ".git" ]]; then
    echo "⚠ Pas de repo Git ici. Le scan se fera sur tous les fichiers (mode pré-init)."
    SCAN_MODE="all"
else
    SCAN_MODE="git"
fi

ISSUES=0

# ============================================================
# 1. Fichiers .env sensibles tracés ?
# ============================================================
echo "🔍 Check 1/4 : fichiers .env sensibles tracés ?"
SENSITIVE_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    ".env.development"
    ".env.staging"
)

env_issues=0
for f in "${SENSITIVE_FILES[@]}"; do
    if [[ "$SCAN_MODE" == "git" ]]; then
        if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
            echo "  ❌ $f est tracé par Git ! Retire-le : git rm --cached $f"
            env_issues=$((env_issues + 1))
        fi
    fi
done
ISSUES=$((ISSUES + env_issues))
[[ $env_issues -eq 0 ]] && echo "  ✓ OK"

# ============================================================
# 2. Patterns de secrets dans les fichiers tracés
# ============================================================
echo "🔍 Check 2/4 : patterns de secrets dans fichiers tracés..."

# Patterns : NOM:regex
PATTERNS=(
    "JWT_SECRET assigné:JWT_SECRET[=:][ \"']?[a-zA-Z0-9+/=_-]{30,}"
    "JWT_REFRESH_SECRET:JWT_REFRESH_SECRET[=:][ \"']?[a-zA-Z0-9+/=_-]{30,}"
    "DB password Postgres URL:postgresql://[^:[:space:]\"']+:[a-zA-Z0-9_-]{6,}@"
    "POSTGRES_PASSWORD:POSTGRES_PASSWORD[=:][ \"']?[a-zA-Z0-9_-]{6,}"
    "Neo4j password:NEO4J_PASSWORD[=:][ \"']?[a-zA-Z0-9_-]{6,}"
    "xAI API key:xai-[a-zA-Z0-9]{20,}"
    "ADMIN_API_TOKEN:ADMIN_API_TOKEN[=:][ \"']?[a-zA-Z0-9]{20,}"
    "Resend API key:re_[a-zA-Z0-9]{15,}"
    "Google client secret:GOCSPX-[a-zA-Z0-9_-]{20,}"
    "GitHub PAT:gh[ops]_[a-zA-Z0-9]{30,}"
    "JWT token (eyJ...):eyJ[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}"
    "AWS access key:AKIA[0-9A-Z]{16}"
)

if [[ "$SCAN_MODE" == "git" ]]; then
    FILES_TO_SCAN=$(git ls-files 2>/dev/null || true)
else
    FILES_TO_SCAN=$(find . -type f \
        ! -path "./node_modules/*" \
        ! -path "./.next/*" \
        ! -path "./dist/*" \
        ! -path "./.turbo/*" \
        ! -path "./.git/*" \
        ! -path "./.backup-*" \
        ! -path "./.archive-infra-*" \
        ! -path "./_salvage/*" \
        ! -path "./cleanup-salvage/*" \
        ! -name ".env*" \
        ! -name "*.tar.gz" \
        ! -name "*.bak-*" \
        2>/dev/null | head -2000)
fi

if [[ -z "$FILES_TO_SCAN" ]]; then
    echo "  ℹ Aucun fichier à scanner"
else
    found_secrets=0

    # check_pattern_in_file <pattern> <file>
    # Retourne 0 si match valide trouvé (ie. ligne sans interpolation ${...}),
    # 1 sinon. Affiche les lignes en cas de match.
    check_pattern_in_file() {
        local regex="$1"
        local file="$2"
        # Cherche le pattern, exclut les lignes contenant ${...} (interpolation Docker)
        # ET les commentaires (lignes commençant par # ou //)
        local matches
        matches=$(grep -nE "$regex" "$file" 2>/dev/null \
            | grep -v '\${' \
            | grep -v "^[[:space:]]*[0-9]*:[[:space:]]*#" \
            | grep -v "^[[:space:]]*[0-9]*:[[:space:]]*//" \
            || true)
        if [[ -n "$matches" ]]; then
            echo "$matches"
            return 0
        fi
        return 1
    }

    for entry in "${PATTERNS[@]}"; do
        name="${entry%%:*}"
        regex="${entry#*:}"
        offending_files=()
        for f in $FILES_TO_SCAN; do
            # Skip fichiers de doc et le scanner lui-même
            case "$(basename "$f")" in
                .env.example|SECURITY.md|README.md|safety-check.sh)
                    continue
                    ;;
            esac
            # Skip les templates aussi
            if [[ "$f" == *.template* ]] || [[ "$f" == *templates/* ]]; then
                continue
            fi
            local_match=$(check_pattern_in_file "$regex" "$f" 2>/dev/null || true)
            if [[ -n "$local_match" ]]; then
                offending_files+=("$f:$local_match")
            fi
        done
        if [[ ${#offending_files[@]} -gt 0 ]]; then
            echo "  ❌ Pattern '$name' détecté dans :"
            for line in "${offending_files[@]}"; do
                echo "      $line"
            done
            found_secrets=$((found_secrets + 1))
        fi
    done

    if [[ $found_secrets -eq 0 ]]; then
        echo "  ✓ Aucun secret en clair trouvé"
    else
        ISSUES=$((ISSUES + found_secrets))
    fi
fi

# ============================================================
# 3. .gitignore exclut .env* ?
# ============================================================
echo "🔍 Check 3/4 : .gitignore exclut bien les .env* ?"
if [[ -f ".gitignore" ]]; then
    if grep -qE "^\.env(\.local|\.production)?$|^\.env\*?$" .gitignore; then
        echo "  ✓ .gitignore couvre les .env"
    else
        echo "  ⚠ .gitignore ne semble pas exclure les .env"
        ISSUES=$((ISSUES + 1))
    fi
else
    echo "  ⚠ Pas de .gitignore"
    ISSUES=$((ISSUES + 1))
fi

# ============================================================
# 4. Backups tracés ?
# ============================================================
echo "🔍 Check 4/4 : backups potentiellement tracés ?"
if [[ "$SCAN_MODE" == "git" ]]; then
    backup_tracked=$(git ls-files | grep -E "\.backup-|\.archive-infra-" || true)
    if [[ -n "$backup_tracked" ]]; then
        echo "  ❌ Des fichiers de backup sont tracés :"
        echo "$backup_tracked" | head -5 | sed 's/^/      /'
        ISSUES=$((ISSUES + 1))
    else
        echo "  ✓ Aucun backup tracé"
    fi
else
    echo "  ℹ Mode pré-init, skip ce check"
fi

# ============================================================
# Récap
# ============================================================
echo ""
if [[ $ISSUES -eq 0 ]]; then
    echo "═══════════════════════════════════════════════════════════"
    echo "✅ Safety check OK — pas de secret détecté"
    echo "═══════════════════════════════════════════════════════════"
    exit 0
else
    echo "═══════════════════════════════════════════════════════════"
    echo "❌ Safety check FAILED — $ISSUES problème(s) détecté(s)"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "NE PUSH PAS tant que ces problèmes ne sont pas résolus."
    echo "Voir SECURITY.md pour les procédures de correction."
    exit 1
fi

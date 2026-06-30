#!/usr/bin/env bash
# SECURITY-RESTORE-V1 — restore an encrypted llmastro V1 Postgres backup.
#
# WHY THIS SHAPE: the backup PRIVATE GPG key must NEVER live on the server
# (that is the whole point of asymmetric backups — a compromised VPS or B2
# account still cannot read the dumps). So decryption happens HERE, on your
# local machine, and the decrypted stream is piped over SSH into the target
# database on the VPS. The plaintext dump never touches persistent disk on the
# server; it exists only transiently in a tmpfs throwaway container (test mode)
# or in the live DB (prod mode).
#
# Companion of the backup script deployed on the VPS at
# /opt/astro-platform/backups/pg-backup.sh
# (cron 03:30 -> gpg encrypt -> local 7d + Backblaze B2 7d).
#
# ── USAGE ──────────────────────────────────────────────────────────────────
#   Run from Git Bash on your machine, with your private key handy.
#
#   PRIV_KEY=/path/to/llmastro-backup-PRIVATE.asc \
#   PASSPHRASE='your-passphrase' \
#   ./restore-from-backup.sh <SOURCE> [test|prod]
#
#   SOURCE:
#     latest-vps          newest .gpg on the VPS (scp'd down, default)
#     vps:<filename>      a specific .gpg on the VPS
#     /local/path.gpg     a .gpg already on this machine
#   MODE:
#     test   (default) restore into a throwaway tmpfs container, compare row
#            counts vs prod, then destroy it. Non-destructive. Use for drills.
#     prod   restore into the LIVE database. DESTRUCTIVE. Requires typing the
#            confirmation phrase when prompted.
#
# ── EXAMPLES ─────────────────────────────────────────────────────────────────
#   # Monthly restore drill (safe):
#   PRIV_KEY=~/secrets/llmastro-backup-PRIVATE.asc PASSPHRASE='…' \
#     ./restore-from-backup.sh latest-vps test
#
#   # Real disaster recovery into prod (destructive):
#   PRIV_KEY=~/secrets/llmastro-backup-PRIVATE.asc PASSPHRASE='…' \
#     ./restore-from-backup.sh latest-vps prod
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

VPS_HOST="${VPS_HOST:-astro@72.62.58.240}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/llmastro_deploy}"
PG_CONTAINER="${PG_CONTAINER:-astro-platform-postgres-1}"
BACKUP_DIR="${BACKUP_DIR:-/opt/astro-platform/backups}"
PRIV_KEY="${PRIV_KEY:?set PRIV_KEY=/path/to/llmastro-backup-PRIVATE.asc}"
PASSPHRASE="${PASSPHRASE:?set PASSPHRASE=...}"

SOURCE="${1:-latest-vps}"
MODE="${2:-test}"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $VPS_HOST"

# Short-path, isolated keyring — dodges the Windows/MSYS gpg-agent socket-path bug
# and keeps the imported secret out of your real keyring. Wiped on exit.
G="$(mktemp -d /c/tmp/llmastro-restore.XXXXXX 2>/dev/null || mktemp -d)"
export GNUPGHOME="$G"
chmod 700 "$G"
cleanup(){ GNUPGHOME="$G" gpgconf --kill all 2>/dev/null || true; rm -rf "$G" "${TMP_GPG:-}" "${TMP_DEC:-}" 2>/dev/null || true; }
trap cleanup EXIT

echo "[1/5] importing private key into temporary keyring…"
gpg --batch --pinentry-mode loopback --passphrase "$PASSPHRASE" --import "$PRIV_KEY" 2>&1 | grep -i secret || true

echo "[2/5] locating backup ($SOURCE)…"
TMP_GPG="$G/backup.dump.gpg"
case "$SOURCE" in
  latest-vps)
    REMOTE=$($SSH "ls -1t $BACKUP_DIR/astro_platform-*.dump.gpg | head -1")
    echo "       newest: $REMOTE"
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$VPS_HOST:$REMOTE" "$TMP_GPG" ;;
  vps:*)
    REMOTE="$BACKUP_DIR/${SOURCE#vps:}"
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$VPS_HOST:$REMOTE" "$TMP_GPG" ;;
  *)
    cp "$SOURCE" "$TMP_GPG" ;;
esac

echo "[3/5] decrypting locally…"
TMP_DEC="$G/backup.dump"
gpg --batch --pinentry-mode loopback --passphrase "$PASSPHRASE" --decrypt --output "$TMP_DEC" "$TMP_GPG" 2>/dev/null
test "$(head -c 5 "$TMP_DEC")" = "PGDMP" || { echo "ERROR: decrypted file is not a Postgres custom dump"; exit 1; }
echo "       OK — valid PGDMP ($(du -h "$TMP_DEC" | cut -f1))"

if [ "$MODE" = "test" ]; then
  echo "[4/5] restoring into THROWAWAY db on VPS (tmpfs, no network)…"
  $SSH 'docker rm -f astro-restore-test >/dev/null 2>&1 || true; \
        docker run -d --rm --name astro-restore-test --network none --tmpfs /var/lib/postgresql/data \
          -e POSTGRES_PASSWORD=test -e POSTGRES_DB=restore_test postgres:16-alpine >/dev/null; \
        for i in $(seq 1 30); do docker exec astro-restore-test pg_isready -U postgres -d restore_test >/dev/null 2>&1 && break; sleep 1; done'
  cat "$TMP_DEC" | $SSH 'docker exec -i astro-restore-test pg_restore -U postgres -d restore_test --no-owner --no-privileges' 2>/dev/null || true
  echo "[5/5] verifying row counts (prod vs restored)…"
  $SSH 'bash -s' <<'REMOTE'
SRC=astro-platform-postgres-1; TEST=astro-restore-test
DB=$(docker exec $SRC printenv POSTGRES_DB); U=$(docker exec $SRC printenv POSTGRES_USER)
Q=$(docker exec $SRC psql -U "$U" -d "$DB" -tAc "select string_agg(format('select %L tbl, count(*) n from %I', table_name, table_name),' union all ') from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
printf 'select tbl,n from (%s) z order by tbl;\n' "$Q" > /tmp/count.sql
docker exec -i $SRC  psql -U "$U" -d "$DB"         -tA < /tmp/count.sql > /tmp/src.txt
docker exec -i $TEST psql -U postgres -d restore_test -tA < /tmp/count.sql > /tmp/rst.txt
join -t'|' /tmp/src.txt /tmp/rst.txt | awk -F'|' '{printf "  %-28s %8s -> %-8s %s\n",$1,$2,$3,($2==$3?"OK":"MISMATCH")}'
diff -q /tmp/src.txt /tmp/rst.txt >/dev/null && echo "  VERDICT: ALL TABLES IDENTICAL ✅" || { echo "  VERDICT: DIFFERENCES ☝"; diff /tmp/src.txt /tmp/rst.txt; }
docker rm -f $TEST >/dev/null 2>&1 || true
REMOTE
  echo "Done — throwaway DB destroyed."
else
  echo "[4/5] PROD restore requested — THIS OVERWRITES THE LIVE DATABASE."
  read -r -p "       Type 'RESTORE PROD' to proceed: " CONFIRM
  [ "$CONFIRM" = "RESTORE PROD" ] || { echo "aborted."; exit 1; }
  echo "       stopping API to drop connections…"
  $SSH "cd /opt/astro-platform && docker compose -f docker-compose.prod.yml stop api"
  cat "$TMP_DEC" | $SSH "docker exec -i $PG_CONTAINER pg_restore -U \$(docker exec $PG_CONTAINER printenv POSTGRES_USER) -d \$(docker exec $PG_CONTAINER printenv POSTGRES_DB) --clean --if-exists --no-owner --no-privileges" 2>/dev/null || true
  echo "[5/5] restarting API…"
  $SSH "cd /opt/astro-platform && docker compose -f docker-compose.prod.yml start api"
  echo "Done — prod restored. Verify the app."
fi

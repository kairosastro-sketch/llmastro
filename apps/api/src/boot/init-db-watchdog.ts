// ============================================================
// apps/api/src/boot/init-db-watchdog.ts
// SECURITY-DB-WATCHDOG-V1
// ------------------------------------------------------------
// Surveillance « intrusion » de la base, sans dépendance externe
// ni install VPS. Deux gardes tournent ensemble sur un intervalle :
//
//   A) Connexions Postgres anormales (pg_stat_activity)
//      En prod, Postgres n'est PAS exposé : seuls l'API et les
//      process internes s'y connectent, donc tous les client_addr
//      légitimes sont dans des plages privées (réseau Docker
//      astro-net = 172.16/12, loopback, etc.). Une connexion depuis
//      une IP publique = signal fort de compromission (port exposé
//      par erreur, ou attaquant ayant un pied sur l'hôte). On alerte
//      aussi sur un rôle Postgres inattendu (ex. superuser `postgres`).
//
//   B) Brute-force / credential-stuffing sur /auth/login
//      On lit la table `login_events` (déjà alimentée par
//      logLoginEvent au login) pour repérer, sur une fenêtre
//      glissante : un compte ciblé par trop d'échecs (éventuellement
//      depuis plusieurs IP — ce que le rate-limit par IP ne voit
//      pas), une IP qui pilonne, ou un pic global d'échecs.
//
// Alertes : toujours loggées (niveau warn/error → capturé par les
// logs Docker, greppable) ; en prod, email dédupliqué (cooldown)
// vers SECURITY_ALERT_EMAIL (fallback CONTACT_INBOX) si le mailer
// Resend est configuré. Le cooldown évite de spammer pendant une
// attaque continue.
//
// Strategy : run immédiat au boot puis setInterval. Idempotent,
// aucune écriture en base (lecture seule).
// ============================================================

import { pool } from "../db/index.js";
import { isMailerConfigured, sendEmail } from "../services/mailer.js";

interface WatchdogLogger {
  info:  (...a: any[]) => void;
  warn:  (...a: any[]) => void;
  error: (...a: any[]) => void;
}

// ─── Réglages (overridables par env, valeurs par défaut sûres) ───
const INTERVAL_MS = parseIntEnv("DB_WATCHDOG_INTERVAL_MS", 5 * 60 * 1000); // 5 min
const LOGIN_FAIL_WINDOW_MIN = parseIntEnv("DB_WATCHDOG_LOGIN_WINDOW_MIN", 15);
const LOGIN_FAIL_PER_ACCOUNT = parseIntEnv("DB_WATCHDOG_LOGIN_FAIL_PER_ACCOUNT", 10);
const LOGIN_FAIL_PER_IP = parseIntEnv("DB_WATCHDOG_LOGIN_FAIL_PER_IP", 20);
const LOGIN_FAIL_TOTAL = parseIntEnv("DB_WATCHDOG_LOGIN_FAIL_TOTAL", 60);
// Cooldown anti-spam des emails d'alerte (par type d'alerte).
const ALERT_EMAIL_COOLDOWN_MS = parseIntEnv("DB_WATCHDOG_ALERT_COOLDOWN_MS", 30 * 60 * 1000); // 30 min

// Plages considérées « internes » (jamais alertées pour une connexion PG).
// RFC1918 + loopback + IPv6 unique-local/loopback/link-local. On y ajoute
// les CIDR de DB_WATCHDOG_ALLOWED_CIDRS (séparés par virgule) si fournis.
const DEFAULT_PRIVATE_CIDRS = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
];

// Rôles Postgres attendus. Tout autre usename connecté = alerte.
const EXPECTED_DB_ROLES = (process.env["DB_WATCHDOG_EXPECTED_ROLES"] ?? "astro")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Dernier envoi email par type d'alerte (cooldown).
const lastEmailAt = new Map<string, number>();

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function allowedCidrs(): string[] {
  const extra = (process.env["DB_WATCHDOG_ALLOWED_CIDRS"] ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return [...DEFAULT_PRIVATE_CIDRS, ...extra];
}

function alertRecipient(): string | null {
  return (
    process.env["SECURITY_ALERT_EMAIL"]?.trim() ||
    process.env["CONTACT_INBOX"]?.trim() ||
    null
  );
}

// ─────────────────────────────────────────────────────────────
// A) Connexions Postgres anormales
// ─────────────────────────────────────────────────────────────
interface SuspectConn { addr: string; role: string | null; datname: string | null; state: string | null; n: number }

async function checkConnections(): Promise<{ external: SuspectConn[]; badRole: SuspectConn[] }> {
  // External : client_addr hors plages internes. Le filtrage CIDR est fait
  // par Postgres via l'opérateur inet `<<=` (contenu dans le réseau) —
  // robuste IPv4/IPv6, pas de parsing maison.
  const externalRes = await pool.query<SuspectConn>(
    `SELECT client_addr::text AS addr,
            usename            AS role,
            datname,
            state,
            count(*)::int      AS n
       FROM pg_stat_activity
      WHERE client_addr IS NOT NULL
        AND NOT (client_addr <<= ANY ($1::inet[]))
      GROUP BY 1, 2, 3, 4`,
    [allowedCidrs()],
  );

  // Bad role : un usename connecté qui n'est pas dans la liste attendue
  // (ex. quelqu'un qui se connecte en superuser `postgres`).
  const badRoleRes = await pool.query<SuspectConn>(
    `SELECT client_addr::text AS addr,
            usename            AS role,
            datname,
            state,
            count(*)::int      AS n
       FROM pg_stat_activity
      WHERE usename IS NOT NULL
        AND NOT (usename = ANY ($1::text[]))
      GROUP BY 1, 2, 3, 4`,
    [EXPECTED_DB_ROLES],
  );

  return { external: externalRes.rows, badRole: badRoleRes.rows };
}

// ─────────────────────────────────────────────────────────────
// B) Brute-force login (table login_events)
// ─────────────────────────────────────────────────────────────
interface AccountAttack { email: string; fails: number; ips: number }
interface IpAttack { ip: string | null; fails: number; emails: number }

async function checkBruteForce(): Promise<{ byAccount: AccountAttack[]; byIp: IpAttack[]; total: number }> {
  const windowExpr = `now() - ($1 * interval '1 minute')`;

  const byAccountRes = await pool.query<AccountAttack>(
    `SELECT email,
            count(*)::int                  AS fails,
            count(DISTINCT ip)::int        AS ips
       FROM login_events
      WHERE success = false
        AND kind = 'login'
        AND created_at > ${windowExpr}
      GROUP BY email
     HAVING count(*) >= $2
      ORDER BY fails DESC
      LIMIT 20`,
    [LOGIN_FAIL_WINDOW_MIN, LOGIN_FAIL_PER_ACCOUNT],
  );

  const byIpRes = await pool.query<IpAttack>(
    `SELECT ip,
            count(*)::int                  AS fails,
            count(DISTINCT email)::int     AS emails
       FROM login_events
      WHERE success = false
        AND kind = 'login'
        AND created_at > ${windowExpr}
      GROUP BY ip
     HAVING count(*) >= $2
      ORDER BY fails DESC
      LIMIT 20`,
    [LOGIN_FAIL_WINDOW_MIN, LOGIN_FAIL_PER_IP],
  );

  const totalRes = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total
       FROM login_events
      WHERE success = false
        AND kind = 'login'
        AND created_at > ${windowExpr}`,
    [LOGIN_FAIL_WINDOW_MIN],
  );

  return {
    byAccount: byAccountRes.rows,
    byIp:      byIpRes.rows,
    total:     totalRes.rows[0]?.total ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Alerte (log + email dédupliqué)
// ─────────────────────────────────────────────────────────────
async function raiseAlert(
  logger: WatchdogLogger,
  type: string,
  summary: string,
  details: Record<string, unknown>,
): Promise<void> {
  logger.error({ watchdog: type, ...details }, `[db-watchdog] 🚨 ${summary}`);

  // Email seulement en prod, mailer configuré, destinataire connu, et
  // hors cooldown pour ce type d'alerte.
  if (process.env["NODE_ENV"] !== "production") return;
  const to = alertRecipient();
  if (!to || !isMailerConfigured()) return;

  const now = Date.now();
  const last = lastEmailAt.get(type) ?? 0;
  if (now - last < ALERT_EMAIL_COOLDOWN_MS) return;
  lastEmailAt.set(type, now);

  const body = `${summary}\n\n${JSON.stringify(details, null, 2)}\n\n— db-watchdog (llmastro)`;
  try {
    await sendEmail({
      to,
      subject: `[llmastro] Alerte sécurité base : ${summary}`,
      text:    body,
      html:    `<pre style="font:13px/1.5 monospace">${escapeHtml(body)}</pre>`,
    });
  } catch (err) {
    logger.warn({ err, type }, "[db-watchdog] alert email failed (logged only)");
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

// ─────────────────────────────────────────────────────────────
// Boucle principale
// ─────────────────────────────────────────────────────────────
async function runOnce(logger: WatchdogLogger): Promise<void> {
  // A) Connexions
  try {
    const { external, badRole } = await checkConnections();
    if (external.length > 0) {
      await raiseAlert(
        logger,
        "pg_external_connection",
        `Connexion Postgres depuis une IP non-interne (${external.length} source(s))`,
        { connections: external },
      );
    }
    if (badRole.length > 0) {
      await raiseAlert(
        logger,
        "pg_unexpected_role",
        `Connexion Postgres avec un rôle inattendu`,
        { expected: EXPECTED_DB_ROLES, connections: badRole },
      );
    }
  } catch (err) {
    logger.error({ err }, "[db-watchdog] connection check failed");
  }

  // B) Brute-force
  try {
    const { byAccount, byIp, total } = await checkBruteForce();
    if (byAccount.length > 0) {
      await raiseAlert(
        logger,
        "login_bruteforce_account",
        `Comptes ciblés par du brute-force (${byAccount.length}) sur ${LOGIN_FAIL_WINDOW_MIN} min`,
        { window_min: LOGIN_FAIL_WINDOW_MIN, threshold: LOGIN_FAIL_PER_ACCOUNT, accounts: byAccount },
      );
    }
    if (byIp.length > 0) {
      await raiseAlert(
        logger,
        "login_bruteforce_ip",
        `IP(s) en brute-force login (${byIp.length}) sur ${LOGIN_FAIL_WINDOW_MIN} min`,
        { window_min: LOGIN_FAIL_WINDOW_MIN, threshold: LOGIN_FAIL_PER_IP, ips: byIp },
      );
    }
    if (total >= LOGIN_FAIL_TOTAL) {
      await raiseAlert(
        logger,
        "login_fail_spike",
        `Pic global d'échecs de login (${total} sur ${LOGIN_FAIL_WINDOW_MIN} min)`,
        { window_min: LOGIN_FAIL_WINDOW_MIN, threshold: LOGIN_FAIL_TOTAL, total },
      );
    }
  } catch (err) {
    logger.error({ err }, "[db-watchdog] brute-force check failed");
  }
}

/**
 * Démarre le watchdog : run immédiat au boot puis toutes les
 * DB_WATCHDOG_INTERVAL_MS (5 min par défaut). À appeler depuis
 * index.ts après app.listen(), comme les autres schedulers.
 * Désactivable via DB_WATCHDOG_ENABLED=false.
 */
export function startDbWatchdog(logger: WatchdogLogger): void {
  if (process.env["DB_WATCHDOG_ENABLED"] === "false") {
    logger.info("[db-watchdog] disabled via DB_WATCHDOG_ENABLED=false");
    return;
  }

  logger.info(
    {
      interval_ms: INTERVAL_MS,
      login_window_min: LOGIN_FAIL_WINDOW_MIN,
      email_alerts: process.env["NODE_ENV"] === "production" && isMailerConfigured() && Boolean(alertRecipient()),
    },
    "[db-watchdog] started",
  );

  const run = () => { void runOnce(logger); };
  run(); // immédiat au boot

  const interval = setInterval(run, INTERVAL_MS);
  interval.unref?.();
}

// SECURITY-DB-WATCHDOG-V1 applied

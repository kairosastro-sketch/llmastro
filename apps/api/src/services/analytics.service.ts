// ============================================================
// ANALYTICS-V1
// apps/api/src/services/analytics.service.ts
// ------------------------------------------------------------
// Logger fire-and-forget des page views (mesure d'audience).
// Source des stats admin « pages les plus vues » + « temps passé ».
// ============================================================

import { pool } from "../db/index.js";

export interface PageViewInput {
  userId?:    string | null;
  sessionId:  string;
  path:       string;
  activeMs:   number;
  referrer?:  string | null;
}

/**
 * Normalise un chemin pour limiter la cardinalité ET éviter de stocker
 * des identifiants en clair :
 *   - segments UUID            → :id
 *   - segments purement numériques → :id
 * Tronque query string + fragment, borne la longueur à 255.
 */
export function normalizePath(raw: string): string {
  let path = (raw || "/").split("?")[0].split("#")[0].trim();
  if (!path.startsWith("/")) path = "/" + path;

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  path = path
    .split("/")
    .map((seg) => (UUID.test(seg) || /^\d+$/.test(seg) ? ":id" : seg))
    .join("/");

  // dé-doublonne les slashs et retire le slash final (sauf racine)
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  return path.slice(0, 255);
}

export function logPageView(entry: PageViewInput): void {
  // Borne active_ms : refuse négatif, plafonne à 30 min (anti-aberration).
  const activeMs = Math.min(Math.max(0, Math.round(entry.activeMs || 0)), 30 * 60 * 1000);

  pool
    .query(
      `INSERT INTO page_views (user_id, session_id, path, active_ms, referrer)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        entry.userId ?? null,
        entry.sessionId.slice(0, 64),
        normalizePath(entry.path),
        activeMs,
        entry.referrer ? entry.referrer.slice(0, 255) : null,
      ]
    )
    .catch((err: { message?: string }) => {
      // eslint-disable-next-line no-console
      console.error("[analytics] failed to insert page_view:", err?.message ?? err);
    });
}

// ANALYTICS-V1 applied

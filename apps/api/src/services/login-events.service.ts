// ============================================================
// ADMIN-STATS-V1-BACKEND
// apps/api/src/services/login-events.service.ts
// ------------------------------------------------------------
// Logger fire-and-forget des événements de connexion (login,
// register, oauth callbacks). Source pour les stats long-terme.
// La purge de refresh_tokens (7 jours) ne s'applique pas ici.
// ============================================================

import { pool } from "../db/index.js";

export type LoginEventKind = "login" | "register" | "oauth_google" | "oauth_github";

export interface LoginEventInput {
  userId?:    string | null;
  email:      string;
  kind:       LoginEventKind;
  success:    boolean;
  errorCode?: string | null;
  ip?:        string | null;
  userAgent?: string | null;
}

export function logLoginEvent(entry: LoginEventInput): void {
  pool
    .query(
      `INSERT INTO login_events (user_id, email, kind, success, error_code, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId    ?? null,
        entry.email,
        entry.kind,
        entry.success,
        entry.errorCode ?? null,
        entry.ip        ?? null,
        entry.userAgent ?? null,
      ]
    )
    .catch((err: { message?: string }) => {
      // eslint-disable-next-line no-console
      console.error("[login-events] failed to insert log:", err?.message ?? err);
    });
}

// ADMIN-STATS-V1-BACKEND applied

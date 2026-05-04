// ============================================================
// ADMIN-STATS-V1-BACKEND
// apps/api/src/services/xai-log.service.ts
// ------------------------------------------------------------
// Logger fire-and-forget des appels xAI/Grok dans la table
// xai_calls_log. NE DOIT JAMAIS faire échouer un appel xAI :
// la promesse insert est .catch()'d silencieusement.
// ============================================================

import { pool } from "../db/index.js";

export interface XaiCallLog {
  userId?:    string | null;
  model:      string;
  tokensIn?:  number;
  tokensOut?: number;
  latencyMs:  number;
  success:    boolean;
  errorKind?: string | null;
}

export function logXaiCall(entry: XaiCallLog): void {
  pool
    .query(
      `INSERT INTO xai_calls_log (user_id, model, tokens_in, tokens_out, latency_ms, success, error_kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId    ?? null,
        entry.model,
        entry.tokensIn  ?? 0,
        entry.tokensOut ?? 0,
        entry.latencyMs,
        entry.success,
        entry.errorKind ?? null,
      ]
    )
    .catch((err: { message?: string }) => {
      // eslint-disable-next-line no-console
      console.error("[xai-log] failed to insert log:", err?.message ?? err);
    });
}

// ADMIN-STATS-V1-BACKEND applied

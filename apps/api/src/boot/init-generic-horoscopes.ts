// ============================================================
// GENERIC-HOROSCOPES-V1
// apps/api/src/boot/init-generic-horoscopes.ts
// ------------------------------------------------------------
// Génération automatique des horoscopes génériques presse :
// ensure au boot puis vérification horaire (même rythme
// qu'init-sky). À minuit UTC (jour) et au lundi (semaine), la
// période change → la vérification suivante génère l'édition.
// L'admin (/admin/horoscopes) peut ensuite relire/retoucher.
// ============================================================

import { pool } from "../db/index.js";
import {
  ensureGenericHoroscopes,
  HOROSCOPE_CADENCES,
} from "../services/generic-horoscope.service.js";

interface MinimalLogger {
  info:  (...a: any[]) => void;
  error: (...a: any[]) => void;
  warn?: (...a: any[]) => void;
}

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 h

// GENERIC-HOROSCOPES-DDL-FIX-V1 : dans ce repo les fichiers
// db/migrations/*.sql sont HISTORIQUES — jamais exécutés au boot
// (runMigrations = DDL inline). La DDL doit donc vivre ici, en
// miroir fidèle de 0019_generic_horoscopes.sql (IF NOT EXISTS,
// idempotent), comme init-community pour 0018.
export async function initGenericHoroscopeTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS generic_horoscopes (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cadence       VARCHAR(10) NOT NULL,
      period_start  TIMESTAMP NOT NULL,
      sign_idx      INTEGER NOT NULL,
      text          TEXT NOT NULL,
      edited        BOOLEAN NOT NULL DEFAULT false,
      llm_model     VARCHAR(100),
      generated_at  TIMESTAMP NOT NULL DEFAULT now(),
      updated_at    TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT generic_horoscopes_period_sign_uq UNIQUE (cadence, period_start, sign_idx),
      CONSTRAINT generic_horoscopes_sign_idx_ck CHECK (sign_idx >= 0 AND sign_idx <= 11)
    );

    CREATE INDEX IF NOT EXISTS generic_horoscopes_lookup_idx
      ON generic_horoscopes (cadence, period_start);

    CREATE TABLE IF NOT EXISTS partner_api_keys (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name          VARCHAR(120) NOT NULL,
      key_prefix    VARCHAR(12) NOT NULL,
      key_hash      VARCHAR(64) NOT NULL UNIQUE,
      active        BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMP NOT NULL DEFAULT now(),
      last_used_at  TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS partner_api_keys_hash_idx
      ON partner_api_keys (key_hash) WHERE active;
  `);
}

export function startGenericHoroscopes(logger: MinimalLogger): void {
  const run = async () => {
    for (const cadence of HOROSCOPE_CADENCES) {
      try {
        await ensureGenericHoroscopes(cadence, logger);
      } catch (err) {
        logger.error({ err, cadence }, "[generic-horoscopes] ensure failed");
      }
    }
  };

  void run();

  const interval = setInterval(() => { void run(); }, CHECK_INTERVAL_MS);
  interval.unref?.();
}

// GENERIC-HOROSCOPES-V1 boot applied

// ============================================================
// apps/api/src/boot/init-sky.ts
// CIEL-PUBLIC-V1-DATA-POSITIONS
// ------------------------------------------------------------
// Au boot, ensure que les 4 publications éphémérides existent
// pour la période courante. Puis vérifie toutes les heures —
// `ensureSkyPublication` est idempotent (UNIQUE constraint), donc
// no-op tant qu'on n'a pas changé de période.
//
// Pourquoi vérifier toutes les heures et pas juste à minuit :
// - plus robuste si l'API redémarre/plante autour de minuit
// - `ensureSkyPublication` est cheap si la pub existe (1 SELECT)
// - au pire la regen tombe avec 1h de retard sur le minuit pile
//
// CIEL-ISR-REVALIDATE-V1 : dès qu'une publication change de période
// (ou que son texte Kairos vient d'être généré), on POST vers le
// web pour invalider le cache ISR de la cadence concernée. Le cache
// /ciel est alors busté pile au bon moment plutôt qu'à un délai fixe.
// ============================================================

import { pool } from "../db/index.js";
import { CADENCES, ensureSkyPublication, type Cadence } from "../services/sky-publication.service.js";
import { fillSkyLLMIfNeeded } from "../services/sky-llm.service.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 heure

interface MinimalLogger {
  info: (...a: any[]) => void;
  error: (...a: any[]) => void;
}

// SKY-PUBLICATION-DDL-FIX-V1 : dans ce repo les fichiers db/migrations/*.sql
// sont HISTORIQUES — jamais exécutés au boot (runMigrations = DDL inline). La
// table `sky_publication` (migration 0008) doit donc être recréée ici, en
// miroir idempotent (IF NOT EXISTS), comme initGenericHoroscopeTables pour 0019.
// Les 3 colonnes `llm_*_advanced` (CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2) n'ont
// jamais eu de migration → ADD COLUMN IF NOT EXISTS les ajoute aux bases
// existantes comme aux fraîches. À appeler avant startSkyPublication().
export async function initSkyTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sky_publication (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cadence           VARCHAR(10) NOT NULL CHECK (cadence IN ('day','week','month','year')),
      period_start      TIMESTAMP NOT NULL,
      period_end        TIMESTAMP NOT NULL,
      data              JSONB NOT NULL,
      llm_text          TEXT,
      llm_model         VARCHAR(100),
      llm_generated_at  TIMESTAMP,
      created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS sky_publication_cadence_period_uq
      ON sky_publication(cadence, period_start);

    CREATE INDEX IF NOT EXISTS sky_publication_lookup_idx
      ON sky_publication(cadence, period_start DESC);

    -- CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2 : lecture technique (sans migration dédiée)
    ALTER TABLE sky_publication ADD COLUMN IF NOT EXISTS llm_text_advanced         TEXT;
    ALTER TABLE sky_publication ADD COLUMN IF NOT EXISTS llm_advanced_model        TEXT;
    ALTER TABLE sky_publication ADD COLUMN IF NOT EXISTS llm_advanced_generated_at TIMESTAMP;
  `);
}

// Dernier `periodStart` connu par cadence — sert à détecter le
// basculement de période entre deux passages de la routine horaire.
const lastPeriodStart = new Map<Cadence, string>();

/**
 * Notifie le web qu'une cadence /ciel doit voir son cache ISR invalidé.
 * No-op silencieux si la feature n'est pas configurée (dev, CI) — la
 * page se rafraîchit alors via son `revalidate` de secours.
 */
async function revalidateWeb(
  cadence: Cadence,
  logger: MinimalLogger,
  // ISR-BOOT-REVALIDATE-V1 : au boot, le conteneur web peut encore être en
  // train de démarrer (recreate simultané au deploy) → on retente.
  attempts = 1,
): Promise<void> {
  const url = process.env["WEB_REVALIDATE_URL"];
  const secret = process.env["REVALIDATE_SECRET"];
  if (!url || !secret) return;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-revalidate-secret": secret,
        },
        body: JSON.stringify({ cadence }),
      });
      if (!res.ok) {
        logger.error({ cadence, status: res.status }, "[init-sky] web revalidation rejected");
        return; // réponse du web (secret/cadence) — inutile de retenter
      }
      logger.info({ cadence }, "[init-sky] web ISR cache revalidated");
      return;
    } catch (err) {
      if (attempt === attempts) {
        logger.error({ err, cadence, attempts }, "[init-sky] web revalidation request failed");
        return;
      }
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }
}

/**
 * Lance la routine d'ensure au boot et programme la vérification
 * horaire. À appeler depuis index.ts après runMigrations().
 */
export function startSkyPublication(logger: MinimalLogger): void {
  const run = async (forceRevalidate = false) => {
    for (const cadence of CADENCES) {
      let periodChanged = false;
      try {
        const pub = await ensureSkyPublication(cadence);
        const periodStart = pub.periodStart instanceof Date
          ? pub.periodStart.toISOString()
          : String(pub.periodStart);
        // Premier passage : on enregistre sans considérer ça comme un
        // changement (la pub n'est pas "nouvelle", elle existait déjà).
        periodChanged =
          lastPeriodStart.has(cadence) && lastPeriodStart.get(cadence) !== periodStart;
        lastPeriodStart.set(cadence, periodStart);
        logger.info({ cadence, periodStart }, "[init-sky] publication ensured");
      } catch (err) {
        logger.error({ err, cadence }, "[init-sky] failed to ensure publication");
        continue;
      }
      // CIEL-PUBLIC-V1-LLM : génère/persist le texte Kairos si manquant.
      // Idempotent et error-safe (catch interne) ; retourne `true` si
      // un variant a été (re)généré pendant ce passage.
      const llmGenerated = await fillSkyLLMIfNeeded(cadence, logger);

      // Le contenu servi a changé → on invalide le cache ISR du web.
      // ISR-BOOT-REVALIDATE-V1 : au boot on revalide TOUJOURS — un deploy
      // vient potentiellement de recréer le conteneur web, dont le cache
      // ISR repart du fallback « ciel mystérieux » pré-rendu au build CI
      // (l'API y est injoignable). Sans ce ping, /ciel restait vide pour
      // tout le monde jusqu'à la publication suivante (jusqu'à 24 h).
      if (forceRevalidate || periodChanged || llmGenerated) {
        await revalidateWeb(cadence, logger, forceRevalidate ? 6 : 1);
      }
    }
  };

  // Run immédiatement au boot — avec revalidation ISR forcée
  void run(true);

  // Puis toutes les heures
  const interval = setInterval(() => {
    void run();
  }, CHECK_INTERVAL_MS);

  // Empêche le timer de bloquer le shutdown SIGTERM/SIGINT
  interval.unref?.();
}

// CIEL-PUBLIC-V1-DATA-POSITIONS boot applied

// CIEL-PUBLIC-V1-LLM init-sky integration applied

// CIEL-ISR-REVALIDATE-V1 init-sky applied
// ISR-BOOT-REVALIDATE-V1 applied

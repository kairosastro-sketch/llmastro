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
// ============================================================

import { CADENCES, ensureSkyPublication } from "../services/sky-publication.service.js";
import { fillSkyLLMIfNeeded } from "../services/sky-llm.service.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 heure

interface MinimalLogger {
  info: (...a: any[]) => void;
  error: (...a: any[]) => void;
}

/**
 * Lance la routine d'ensure au boot et programme la vérification
 * horaire. À appeler depuis index.ts après runMigrations().
 */
export function startSkyPublication(logger: MinimalLogger): void {
  const run = async () => {
    for (const cadence of CADENCES) {
      try {
        const pub = await ensureSkyPublication(cadence);
        logger.info(
          { cadence, periodStart: pub.periodStart },
          "[init-sky] publication ensured",
        );
      } catch (err) {
        logger.error({ err, cadence }, "[init-sky] failed to ensure publication");
        continue;
      }
      // CIEL-PUBLIC-V1-LLM : génère/persist le texte Kairos si manquant.
      // Idempotent et error-safe (catch interne).
      await fillSkyLLMIfNeeded(cadence, logger);
    }
  };

  // Run immédiatement au boot
  void run();

  // Puis toutes les heures
  const interval = setInterval(() => {
    void run();
  }, CHECK_INTERVAL_MS);

  // Empêche le timer de bloquer le shutdown SIGTERM/SIGINT
  interval.unref?.();
}

// CIEL-PUBLIC-V1-DATA-POSITIONS boot applied

// CIEL-PUBLIC-V1-LLM init-sky integration applied

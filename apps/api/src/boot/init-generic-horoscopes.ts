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

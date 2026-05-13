// ============================================================
// apps/api/src/boot/cleanup-paywall-v3.ts
// ------------------------------------------------------------
// PAYWALL-V3
// Helper de boot : supprime les rows orphelines de usage_counters
// dont feature_key='ai.natal_reading.monthly'. Pattern miroir du
// fichier .sql inscrit dans db/migrations/0010_paywall_v3_cleanup.sql.
//
// La PR #37 a remplacé ce quota par horoscope.daily.monthly. Le
// seedPlans prune automatiquement les rows orphelines de
// plan_entitlements via notInArray, mais la table usage_counters est
// indépendante du seeder et conserve donc des rows historiques qui
// ne sont plus jamais lues. On nettoie ici pour propreté.
//
// 100% idempotent : DELETE sans match = no-op. À appeler une fois
// au boot, après bootTiers (qui aura déjà prune plan_entitlements).
// Coût négligeable : un seul DELETE par démarrage, sur une table
// de taille modeste (un compteur par user × feature × période).
// ============================================================

import { pool } from "../db/index.js";

const RETIRED_FEATURE_KEY = "ai.natal_reading.monthly";

export async function cleanupPaywallV3(): Promise<void> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `DELETE FROM "usage_counters" WHERE "feature_key" = $1 RETURNING id`,
      [RETIRED_FEATURE_KEY],
    );
    if (res.rowCount && res.rowCount > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[cleanupPaywallV3] usage_counters orphelins supprimés (feature_key=${RETIRED_FEATURE_KEY}) : ${res.rowCount}`,
      );
    }
  } catch (err) {
    // Si la table usage_counters n'existe pas encore (premier boot
    // sur une DB vierge avant bootTiers), on ignore silencieusement —
    // bootTiers la créera et il n'y aura de toute façon rien à purger.
    // eslint-disable-next-line no-console
    console.warn(`[cleanupPaywallV3] cleanup ignoré : ${String(err)}`);
  } finally {
    client.release();
  }
}

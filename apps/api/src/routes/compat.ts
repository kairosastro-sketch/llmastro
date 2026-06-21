// ============================================================
// routes/compat.ts — Route de synastrie (compatibilité romantique)
// ------------------------------------------------------------
// POST /compat/analyze
//   Body : { partnerA: PartnerRef, partnerB: PartnerRef, locale? }
//   PartnerRef :
//     | { type: "saved", natalId }
//     | { type: "adhoc", label, birthDate, birthTime?, birthCity }
//
// Orchestration :
//   1. Résoudre les 2 partenaires (chart + meta)
//   2. Déterminer `degraded` = une des 2 a birthTimeKnown=false
//   3. Cache Redis (seulement si les deux sont "saved")
//   4. Calculer aspects synastriques + scores 6 dimensions
//   5. Prompt Kairos → JSON interprétation
//   6. Renvoyer tout (scores + aspects top 15 + ai + meta + persons)
// ============================================================

import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload } from "@astro-platform/types";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { natalService } from "../services/natal.service.js";
import {
  ephemerisService,
  CityNotFoundError,
  type EnrichedChart,
} from "@astro-platform/ephemeris";
import { xaiService } from "../services/ai.service.js";
import { buildSynastryPrompt, type PersonProfile } from "../services/ai-prompts.service.js";
import { getOrGenerateSynastryReading } from "../services/readings.helpers.js"; // PATCH-SYNASTRY-PERSISTENCE-V1
import { entitlementsService } from "../services/entitlements.service.js"; // ARCHIVE-4-GATES-V1
import {
  computeSynastryAspects,
  scoreSynastry,
} from "../services/synastry.service.js";

// ──────────────────────────────────────────────────────────
// Cache Redis gracieux (même pattern que ai.ts)
// ──────────────────────────────────────────────────────────

let _redis: any = null;
async function getRedis() {
  if (_redis !== null) return _redis;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: process.env["REDIS_URL"] ?? "redis://redis:6379", RESP: 2 }); // REDIS-V6: pin RESP2 wire format (v6 defaults to RESP3)
    client.on("error", () => { /* silent */ });
    await client.connect();
    _redis = client;
    return client;
  } catch {
    _redis = false;
    return null;
  }
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = await getRedis();
    if (!r) return null;
    const v = await r.get(key);
    return v ? JSON.parse(v) as T : null;
  } catch { return null; }
}

async function cacheSet(key: string, data: unknown, ttl: number): Promise<void> {
  try {
    const r = await getRedis();
    if (!r) return;
    await r.setEx(key, ttl, JSON.stringify(data));
  } catch { /* silent */ }
}

// ──────────────────────────────────────────────────────────
// Types payload
// ──────────────────────────────────────────────────────────

type PartnerRef =
  | { type: "saved"; natalId: string }
  | {
      type: "adhoc";
      label: string;
      birthDate: string;    // "YYYY-MM-DD"
      birthTime?: string;   // "HH:MM" — optional
      birthCity: string;
      // COMPAT-CITY-COORDS-V1 : si fourni, on utilise ces coords directement
      // (calculateNatalChart) au lieu de calculateFromCityName, qui pioche
      // dans la petite liste hardcodée du package ephemeris.
      birthCoords?: {
        latitude:  number;
        longitude: number;
        ianaTz:    string;
      };
    };

interface ResolvedPartner {
  chart: EnrichedChart;
  natal: {
    id: string | null;       // null si adhoc
    label: string;
    birthTimeKnown: boolean;
    // RELATIONSHIPS-V1 : tag relationnel du profil (null pour adhoc).
    relationshipCategory: string | null;
    relationshipType: string | null;
  };
  profile: PersonProfile;    // gender + relationshipStatus pour saved, juste name pour adhoc
}

// ──────────────────────────────────────────────────────────
// Résolution d'un partenaire → chart + meta
// ──────────────────────────────────────────────────────────

async function resolvePartner(
  ref: PartnerRef,
  userId: string,
): Promise<ResolvedPartner | null> {
  if (ref.type === "saved") {
    const natal = await natalService.findOne(ref.natalId, userId);
    if (!natal) return null;

    const birthTimeKnown = !(natal.birthTimeUnknown ?? false);
    const chart = await ephemerisService.calculateNatalChart({
      natalId:        natal.id,
      localBirthDate: natal.birthDate,
      localBirthTime: natal.birthTime ?? "12:00",
      ianaTz:         natal.timezone,
      latitude:       natal.latitude,
      longitude:      natal.longitude,
      birthTimeKnown,
    });

    return {
      chart,
      natal: {
        id:             natal.id,
        label:          natal.label,
        birthTimeKnown,
        relationshipCategory: (natal as any).relationshipCategory ?? null,
        relationshipType:     (natal as any).relationshipType ?? null,
      },
      /* PROFILE_SAVED_INJECTED */
      profile: {
        name:               natal.label,
        gender:             (natal as any).gender ?? null,
        relationshipStatus: (natal as any).relationshipStatus ?? null,
      },
    };
  }

  // adhoc : résoudre la ville + calculer
  const birthTime = ref.birthTime ?? "12:00";
  const birthTimeKnown = !!ref.birthTime;
  const adhocId = `adhoc-${Math.random().toString(36).slice(2, 10)}`;

  // COMPAT-CITY-COORDS-V1 : si birthCoords fourni (frontend moderne via
  // CityAutocomplete API qui pioche dans les 231k villes Postgres),
  // on utilise calculateNatalChart directement avec lat/lng/tz. Évite
  // le piège de calculateFromCityName qui n'a qu'une liste de ~50 villes
  // hardcodées et fait échouer Orléans, Lyon-aire, etc.
  let chart;
  if (ref.birthCoords) {
    chart = await ephemerisService.calculateNatalChart({
      natalId:        adhocId,
      localBirthDate: ref.birthDate,
      localBirthTime: birthTime,
      ianaTz:         ref.birthCoords.ianaTz,
      latitude:       ref.birthCoords.latitude,
      longitude:      ref.birthCoords.longitude,
      birthTimeKnown,
    });
  } else {
    // EPHEMERIS-DEEP-CONSOLIDATION-V1 : calculateFromCityName fait
    // maintenant le lookup Postgres en interne via le cityResolver
    // injecté au boot (apps/api/src/index.ts). Plus de hardcoded
    // list — le moteur ephemeris est 100% indépendant des données.
    chart = await ephemerisService.calculateFromCityName({
      natalId:        adhocId,
      localBirthDate: ref.birthDate,
      localBirthTime: birthTime,
      cityName:       ref.birthCity,
      birthTimeKnown,
    });
  }

  return {
    chart,
    natal: {
      id:             null,
      label:          ref.label,
      birthTimeKnown,
      relationshipCategory: null,
      relationshipType:     null,
    },
    /* PROFILE_ADHOC_INJECTED */
    profile: {
      name:               ref.label,
      gender:             null,
      relationshipStatus: null,
    },
  };
}

// ──────────────────────────────────────────────────────────
// Plugin
// ──────────────────────────────────────────────────────────

export const compatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authMiddleware);

  fastify.post<{
    Body: {
      partnerA: PartnerRef;
      partnerB: PartnerRef;
      locale?: string;
    };
  }>("/analyze", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;

    // ARCHIVE-4-GATES-V1 : consume bundle synastry
    const synResult = await entitlementsService.consumeBundle(userId, "synastry", 1);
    if (!synResult.allowed) {
      if (entitlementsService.isEnforcementActive()) {
        const code = synResult.reason === "quota_exceeded" ? "QUOTA_EXCEEDED" : "FEATURE_NOT_AVAILABLE";
        const status = synResult.reason === "quota_exceeded" ? 429 : 403;
        return reply.code(status).send({
          success: false,
          error: {
            code,
            message: synResult.reason === "quota_exceeded"
              ? "Tu as atteint ta limite de synastries pour ce mois."
              : "La synastrie demande un plan supérieur.",
            feature: "synastry",
            remaining: synResult.remaining,
          },
        });
      }
      req.log.warn({ userId, reason: synResult.reason }, "[entitlements] would block compat/analyze (enforcement off)");
    }

    const { partnerA, partnerB } = req.body;
    const locale = req.body.locale === "en" ? "en" : "fr";

    if (!partnerA || !partnerB) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "partnerA and partnerB required" },
      });
    }

    // 1. Résoudre les 2 partenaires
    let dataA: ResolvedPartner | null;
    let dataB: ResolvedPartner | null;
    try {
      dataA = await resolvePartner(partnerA, userId);
      dataB = await resolvePartner(partnerB, userId);
    } catch (err) {
      if (err instanceof CityNotFoundError) {
        return reply.code(400).send({
          success: false,
          error: {
            code:        "CITY_NOT_FOUND",
            message:     err.message,
            suggestions: (err as any).suggestions ?? [],
          },
        });
      }
      fastify.log.error({ err }, "Synastry partner resolve failed");
      return reply.code(500).send({
        success: false,
        error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Unknown" },
      });
    }

    if (!dataA || !dataB) {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "One or both natal profiles not found" },
      });
    }

    // 2. Dégradation si une heure inconnue
    const aKnown = dataA.natal.birthTimeKnown;
    const bKnown = dataB.natal.birthTimeKnown;
    const degraded = !aKnown || !bKnown;
    const reason: string | null =
      !aKnown && !bKnown ? "both_times_unknown"
      : !aKnown          ? "A_time_unknown"
      : !bKnown          ? "B_time_unknown"
      : null;

    // 3. Cache (uniquement pour saved+saved)
    const isCacheable = partnerA.type === "saved" && partnerB.type === "saved";
    // PATCH-SYNASTRY-PERSISTENCE-V1 : le cache+DB est délégué à
    // getOrGenerateSynastryReading dans le bloc IA ci-dessous (saved+saved uniquement).
    // Les cas adhoc continuent de passer en direct sans persistence.

    // 4. Aspects + scores
    const aspects = computeSynastryAspects(
      dataA.chart.planets as any,
      dataB.chart.planets as any,
      { excludeMoon: degraded },
    );
    const scores = scoreSynastry(aspects, { degraded });

    // 5. IA Kairos
    // PATCH-SYNASTRY-PERSISTENCE-V1 : approche hybride
    //  - saved+saved : persistence DB via helper (cache + auto-regen sur promptVersion)
    //  - adhoc       : xAI direct, fallback gracieux préservé
    let aiData: any = null;
    // RELATIONSHIPS-V1 : la catégorie de la synastrie est celle du profil
    // "partenaire" (non-self). On préfère B, puis A ; sinon non spécifié →
    // cadrage générique (ni amoureux ni autre).
    const realCat = (c: string | null) => (c && c !== "unspecified" && c !== "self" ? c : null);
    const relationshipCategory =
      realCat(dataB.natal.relationshipCategory) ?? realCat(dataA.natal.relationshipCategory) ?? "unspecified";
    const relationshipType =
      (realCat(dataB.natal.relationshipCategory) ? dataB.natal.relationshipType
        : realCat(dataA.natal.relationshipCategory) ? dataA.natal.relationshipType
        : null) ?? null;
    const { system, user } = buildSynastryPrompt({
      chartA:    dataA.chart,
      chartB:    dataB.chart,
      aspects:   aspects.slice(0, 15),
      scores,
      degraded,
      reason,
      locale,
      nameA:     dataA.natal.label,
      nameB:     dataB.natal.label,
      profileA:  dataA.profile,
      profileB:  dataB.profile,
      relationshipCategory,
      relationshipType,
    });
    if (isCacheable && dataA.natal.id && dataB.natal.id) {
      // saved+saved : persistence DB (cache cross-device garanti)
      try {
        const synReading = await getOrGenerateSynastryReading({
          userId,
          profileAId: dataA.natal.id,
          profileBId: dataB.natal.id,
          // RELATIONSHIPS-V1 : la catégorie fait partie de la clé → un couple
          // re-tagué régénère une lecture cadrée différemment.
          keySuffix: `${locale}:${relationshipCategory}`,
          messages: [
            { role: "system", content: system },
            { role: "user",   content: user   },
          ],
          options: { temperature: 0.85, maxTokens: 3500 },
        });
        aiData = synReading.content;
      } catch (err) {
        fastify.log.error({ err }, "AI synastry failed (helper, saved+saved)");
        aiData = null;
      }
    } else {
      // adhoc : xAI direct, sans persistence, fallback gracieux préservé
      try {
        aiData = await xaiService.chatJSON<any>(
          [
            { role: "system", content: system },
            { role: "user",   content: user   },
          ],
          { temperature: 0.85, maxTokens: 3500 },
        );
      } catch (err) {
        fastify.log.error({ err }, "AI synastry failed (direct, adhoc)");
        aiData = null;
      }
    }

    // 6. Normaliser la réponse IA (fallback si elle a échoué)
    const aiOut = {
      oracle:         aiData?.oracle         ?? (locale === "fr"
                        ? "Le ciel garde son silence sur ce couple."
                        : "The sky keeps its silence on this couple."),
      summary:        aiData?.summary        ?? "",
      dimensions:     aiData?.dimensions     ?? {},
      chemistry_keys: aiData?.chemistry_keys ?? [],
      watch_points:   aiData?.watch_points   ?? [],
      advice:         aiData?.advice         ?? "",
    };

    const sunA = (dataA.chart.planets as any)?.sun?.signIdx ?? 0;
    const sunB = (dataB.chart.planets as any)?.sun?.signIdx ?? 0;

    const responseData = {
      global:     scores.global,
      dimensions: scores.dimensions,
      aspects:    aspects.slice(0, 15),
      ai:         aiOut,
      // RELATIONSHIPS-V1 : la catégorie/sous-type permet au front de libeller
      // le score (« Entente professionnelle » vs « Compatibilité amoureuse »…).
      relationship: { category: relationshipCategory, type: relationshipType },
      meta: {
        degraded,
        reason,
        birthTimeKnownA: aKnown,
        birthTimeKnownB: bKnown,
        cached:          false,
      },
      persons: {
        A: { label: dataA.natal.label, sunSignIdx: sunA },
        B: { label: dataB.natal.label, sunSignIdx: sunB },
      },
    };
    // 7. PATCH-SYNASTRY-PERSISTENCE-V1 : le cache+DB est géré par le helper
    // (saved+saved). Aucune action ici. Les adhoc ne sont pas cachés (intentionnel).

    return reply.send({ success: true, data: responseData });
  });
};

// PATCH-SYNASTRY-PERSISTENCE-V1 applied
// COMPAT-CITY-COORDS-V1 applied

// EPHEMERIS-CITIES-CONSOLIDATION-V1 applied

// EPHEMERIS-DEEP-CONSOLIDATION-V1 applied

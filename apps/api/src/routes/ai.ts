// ============================================================
// apps/api/src/routes/ai.ts
// ------------------------------------------------------------
// ARCHIVE-2B-AI-TS-FIX-V1
// Correctif : 3 handlers (/tarot, /natal-profile, /chat) avaient
// des markers orphelins /* BUILDxxx_HANDLER_PROFILE */ et des
// références à `natal` hors scope qui empêchaient la compilation.
// Suite à cela, aucun rebuild api ne réussissait et l'ancien
// binaire (signature positionnelle de calculateNatalChart) tournait
// encore, provoquant "Birth date must be YYYY-MM-DD, got undefined"
// sur /dashboard/natal.
// ------------------------------------------------------------
// Version stabilisée :
//   • Utilise la nouvelle signature `calculateNatalChart({ localBirthDate,
//     localBirthTime, ianaTz, latitude, longitude, birthTimeKnown })`
//     — plus de `birthTimeUT` numérique avec convention implicite.
//   • Les clés de cache AI incluent maintenant un hash des inputs qui
//     changent effectivement le résultat (birthDate, birthTime, lat,
//     lng, ianaTz, birthTimeKnown). Modifier un profil invalide ses
//     caches d'horoscope.
//   • La route expose `meta` (birthTimeKnown, resolution) pour que
//     le front puisse afficher un badge "heure inconnue".
// ============================================================

import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload } from "@astro-platform/types";
import { createHash } from "node:crypto";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { natalService } from "../services/natal.service.js";
import {
  ephemerisService,
  CityNotFoundError,
  type EnrichedChart,
} from "@astro-platform/ephemeris";
import { xaiService } from "../services/ai.service.js";
import { entitlementsService } from "../services/entitlements.service.js"; // ARCHIVE-4-GATES-V1
import {
  kairosToneDirective,  // PATCH-KAIROS-TONE-ACCESSIBLE-V1
  buildHoroscopePrompt,
  buildTarotPrompt,
  buildNatalProfilePrompt,
  buildChatPlanetPrompt,
  formatNatalContext,
  formatTransitContext,
  type PersonProfile,
} from "../services/ai-prompts.service.js";
import {
  getOrGenerateHoroscopeReading,
  getOrGenerateNatalProfileReading,
  getOrGenerateTarotReading,
} from "../services/readings.helpers.js"; // PATCH-PERSISTENCE-V2-WIRING
import { randomUUID } from "node:crypto"; // PATCH-PERSISTENCE-V2-WIRING

// ──────────────────────────────────────────────────────────
// Cache Redis (gracieux)
// ──────────────────────────────────────────────────────────

let _redis: any = null;
async function getRedis() {
  if (_redis !== null) return _redis;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: process.env["REDIS_URL"] ?? "redis://redis:6379" });
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
// Dérive un "digest natal" stable à partir des données qui
// influencent le résultat. Si l'utilisateur corrige son heure
// de naissance, ce digest change → cache horoscope invalidé.
// ──────────────────────────────────────────────────────────

function natalDigest(natal: {
  birthDate: string;
  birthTime: string;
  ianaTz?: string | null;
  latitude: number;
  longitude: number;
  birthTimeKnown?: boolean | null;
}): string {
  const payload = JSON.stringify({
    d: natal.birthDate,
    t: natal.birthTime,
    z: natal.ianaTz ?? "UTC",
    la: Number(natal.latitude.toFixed(4)),
    lo: Number(natal.longitude.toFixed(4)),
    tk: natal.birthTimeKnown ?? true,
  });
  return createHash("sha1").update(payload).digest("hex").slice(0, 12);
}

// ──────────────────────────────────────────────────────────
// Chargement + calcul du thème natal (nouvelle API)
// ──────────────────────────────────────────────────────────

async function getNatalChart(natalId: string, userId: string): Promise<{
  chart: EnrichedChart;
  natal: any;
  digest: string;
} | null> {
  const natal = await natalService.findOne(natalId, userId);
  if (!natal) return null;

  // Le schéma Drizzle stocke déjà la tz IANA dans `timezone`
  // (ex. "Europe/Paris") et "heure inconnue" dans `birthTimeUnknown`.
  // Si un profil historique a une valeur vide / numérique, on loggue
  // un warning et on retombe sur UTC.
  const rawTz = natal.timezone ?? "";
  const looksLikeIana = typeof rawTz === "string" && rawTz.includes("/");
  const ianaTz: string = looksLikeIana ? rawTz : "UTC";

  if (!looksLikeIana) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ai] Natal ${natalId} timezone="${rawTz}" ne ressemble pas à une IANA ` +
      `(attendu: "Region/City"). Fallback sur UTC. À corriger manuellement.`,
    );
  }

  const birthTimeKnown = !(natal.birthTimeUnknown ?? false);

  const chart = await ephemerisService.calculateNatalChart({
    natalId: natal.id,
    localBirthDate: natal.birthDate,           // YYYY-MM-DD LOCAL
    localBirthTime: natal.birthTime ?? "12:00", // HH:MM LOCAL
    ianaTz,
    latitude: natal.latitude,
    longitude: natal.longitude,
    birthTimeKnown,
  });

  return {
    chart,
    natal,
    digest: natalDigest({
      birthDate: natal.birthDate,
      birthTime: natal.birthTime ?? "12:00",
      ianaTz,
      latitude: natal.latitude,
      longitude: natal.longitude,
      birthTimeKnown,
    }),
  };
}

async function getCurrentTransits(lat: number, lon: number): Promise<EnrichedChart> {
  // Transits = ciel du moment. On granularise à l'heure pour le cache.
  return await ephemerisService.getCurrentSky(lat, lon);
}

// ──────────────────────────────────────────────────────────
// Normalisation sortie IA (inchangée)
// ──────────────────────────────────────────────────────────

function normalizeHoroscope(raw: any, locale: string) {
  return {
    oracle:   raw?.oracle   ?? (locale === "en" ? "The sky whispers new beginnings." : "Le ciel murmure de nouveaux commencements."),
    summary:  raw?.summary  ?? "",
    text:     raw?.text     ?? "",
    keyDates: raw?.key_dates ?? raw?.keyDates ?? [],
    advice:   raw?.advice   ?? "",
    themes:   raw?.themes   ?? null,
  };
}

function normalizeTarot(raw: any) {
  return {
    overview:  raw?.overview  ?? "",
    cards:     raw?.cards     ?? [],
    synthesis: raw?.synthesis ?? "",
  };
}

function normalizeProfile(raw: any) {
  return {
    essence:       raw?.essence       ?? "",
    strengths:     raw?.strengths     ?? [],
    challenges:    raw?.challenges    ?? [],
    relationships: raw?.relationships ?? "",
    careerPath:    raw?.career_path   ?? raw?.careerPath ?? "",
    shadow:        raw?.shadow        ?? "",
    integration:   raw?.integration   ?? "",
  };
}

// ──────────────────────────────────────────────────────────
// Prompt horoscope enrichi — accepte maintenant un flag
// `birthTimeKnown` pour hedger les textes IA.
// ──────────────────────────────────────────────────────────

function buildHoroscopeWithThemesPrompt(args: {
  natalChart: EnrichedChart;
  transitChart?: EnrichedChart;
  period: "day" | "week" | "month" | "year";
  locale?: string;
  personName?: string;
  personProfile?: PersonProfile | null;
  // HOROSCOPE_THEMES_PROFILE_ARG
}) {
  const locale = args.locale === "en" ? "en" : "fr";
  const natal = formatNatalContext(args.natalChart, locale, args.personProfile);
  const transit = args.transitChart
    ? formatTransitContext(args.transitChart.planets, args.transitChart.moonPhase, locale)
    : "";

  const periodLabels: Record<string, string> = locale === "fr"
    ? { day: "pour la journée", week: "pour cette semaine", month: "pour ce mois", year: "pour cette année" }
    : { day: "for today", week: "for this week", month: "for this month", year: "for this year" };

  // ── Bloc confiance injecté si heure inconnue ────────────
  const timeKnown = args.natalChart.meta?.birthTimeKnown ?? true;
  const confidenceBlock = !timeKnown
    ? (locale === "fr"
        ? `\n\n⚠ HEURE DE NAISSANCE INCONNUE. L'Ascendant, le MC, les maisons et la position exacte de la Lune peuvent être imprécis. Adapte ton ton en conséquence : n'affirme PAS catégoriquement les interprétations qui dépendent des maisons ou de l'Ascendant. Utilise des formulations comme "tendance à", "si ton heure est proche de X", "nuance selon l'heure exacte". Centre-toi sur les positions planétaires (Soleil, Mercure, Vénus, Mars, Jupiter, Saturne) qui restent fiables.`
        : `\n\n⚠ BIRTH TIME UNKNOWN. The Ascendant, MC, houses and exact Moon position may be inaccurate. Adjust tone accordingly: do NOT categorically assert interpretations that depend on houses or the Ascendant. Use hedging language like "tendency to", "if your time is near X", "nuance depending on exact hour". Focus on planetary positions (Sun, Mercury, Venus, Mars, Jupiter, Saturn) which remain reliable.`)
    : "";

  const system = (locale === "fr"
    ? `Tu es Kairos, un·e astrologue expérimenté·e de tradition occidentale. Tu rédiges des horoscopes personnalisés en t'appuyant strictement sur les données du thème natal et des transits fournis. Tu nommes les planètes, signes et maisons concrètement. Ton ton est clair, poétique sans être nébuleux, toujours constructif. Tu évites le catastrophisme.

${kairosToneDirective("fr")}

Tu réponds UNIQUEMENT en JSON valide avec ce schéma STRICT :
{
  "oracle":  "citation courte et poétique (1 phrase, 10-20 mots)",
  "summary": "résumé accrocheur en 2-3 phrases",
  "themes": {
    "vital":   "analyse du thème Vitalité — 5 à 6 lignes (~80-100 mots), concret, ancré dans les transits",
    "mental":  "analyse du thème Mental — 5 à 6 lignes (~80-100 mots)",
    "harmony": "analyse du thème Harmonie émotionnelle — 5 à 6 lignes",
    "love":    "analyse du thème Amour — 5 à 6 lignes",
    "career":  "analyse du thème Carrière — 5 à 6 lignes",
    "luck":    "analyse du thème Chance / Opportunités — 5 à 6 lignes"
  },
  "text":      "synthèse longue de 3-4 paragraphes séparés par \\n\\n (optionnel)",
  "key_dates": ["2 à 4 dates ou moments clés"],
  "advice":    "un conseil concret final en une phrase"
}

IMPORTANT : chaque analyse de thème fait EXACTEMENT 5 à 6 lignes (environ 80 à 100 mots). Ancre-toi dans les positions réelles et les transits actuels.`
    : `You are Kairos, an experienced western-tradition astrologer. You write personalized horoscopes strictly based on the provided natal chart and current transits. You name planets, signs and houses concretely. Tone is clear, poetic without being vague, always constructive.

${kairosToneDirective("en")}

You respond ONLY in valid JSON with this STRICT schema:
{
  "oracle":  "short poetic quote (1 sentence, 10-20 words)",
  "summary": "2-3 punchy sentences",
  "themes": {
    "vital":   "Vitality — 5-6 lines (~80-100 words)",
    "mental":  "Mental — 5-6 lines",
    "harmony": "Emotional Harmony — 5-6 lines",
    "love":    "Love — 5-6 lines",
    "career":  "Career — 5-6 lines",
    "luck":    "Luck / Opportunities — 5-6 lines"
  },
  "text":      "longer 3-4 paragraph synthesis (optional)",
  "key_dates": ["2-4 key dates"],
  "advice":    "one concrete final advice"
}

IMPORTANT: each theme is EXACTLY 5-6 lines (~80-100 words). Ground in real positions and transits.`) + confidenceBlock;

  const personIntro = args.personName
    ? (locale === "fr" ? `Prénom : ${args.personName}\n\n` : `Name: ${args.personName}\n\n`)
    : "";

  const user = locale === "fr"
    ? `${personIntro}${natal}\n\n${transit}\n\nRédige l'horoscope ${periodLabels[args.period]} AVEC les 6 analyses de thème détaillées.`
    : `${personIntro}${natal}\n\n${transit}\n\nWrite the horoscope ${periodLabels[args.period]} WITH the 6 detailed theme analyses.`;

  return { system, user };
}

function getIsoWeek(d: Date): string {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ──────────────────────────────────────────────────────────
// Helper : extrait un PersonProfile depuis un natal DB row.
// Utilisé par tous les handlers pour injecter le contexte
// gender + relationshipStatus dans les prompts Kairos.
// ──────────────────────────────────────────────────────────
function natalToProfile(natal: any): PersonProfile {
  return {
    name:               (natal as any).label ?? natal.name ?? null,
    gender:             (natal as any).gender ?? null,
    relationshipStatus: (natal as any).relationshipStatus ?? null,
  };
}

// ══════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authMiddleware);

  // ── GET /ai/status ───────────────────────────────────
  fastify.get("/status", async (_req, reply) => {
    return reply.send({
      success: true,
      data: {
        configured: xaiService.isConfigured(),
        provider:   "kairos",
        engine:     "xai",
        model:      process.env["XAI_MODEL"] ?? "grok-4-1-fast-non-reasoning",
      },
    });
  });

  // ── POST /ai/horoscope ───────────────────────────────
  fastify.post<{
    Body: {
      natalId: string;
      period: "day" | "week" | "month" | "year";
      locale?: string;
      includeThemes?: boolean;
    };
  }>("/horoscope", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const { natalId, period, locale, includeThemes } = req.body;

    // ARCHIVE-4-GATES-V1 : gate selon la période
    const periodFeatureMap: Record<string, string> = {
      week:  "horoscope.weekly",
      month: "horoscope.monthly",
      year:  "horoscope.yearly",
    };
    const requiredFeature = periodFeatureMap[period];
    if (requiredFeature) {
      const allowed = await entitlementsService.check(userId, requiredFeature);
      if (!allowed && entitlementsService.isEnforcementActive()) {
        return reply.code(403).send({
          success: false,
          error: {
            code:    "FEATURE_NOT_AVAILABLE",
            message: "Cette période d'horoscope demande un plan supérieur.",
            feature: requiredFeature,
          },
        });
      }
      if (!allowed) {
        req.log.warn({ userId, requiredFeature }, "[entitlements] would deny horoscope period (enforcement off)");
      }
    }

    // PATCH-PLANS-REBRAND-V1 : variant "simple" pour les plans sans horoscope.daily.full.
    // On force includeThemes=false pour servir un horoscope court,
    // économe en tokens xAI, adapté aux comptes free.
    let effectiveIncludeThemes = includeThemes === true;
    if (period === "day") {
      const hasFullDaily = await entitlementsService.check(userId, "horoscope.daily.full");
      if (!hasFullDaily) {
        effectiveIncludeThemes = false;
      }
    }

    if (!natalId || !period) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "natalId and period required" },
      });
    }

    const loc = locale === "en" ? "en" : "fr";

    let result;
    try {
      result = await getNatalChart(natalId, userId);
    } catch (err) {
      if (err instanceof CityNotFoundError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: "CITY_NOT_FOUND",
            message: err.message,
            suggestions: err.suggestions,
          },
        });
      }
      fastify.log.error({ err }, "Natal chart load failed");
      return reply.code(500).send({
        success: false,
        error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Unknown" },
      });
    }

    if (!result) {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Natal profile not found" },
      });
    }

    const { chart, natal, digest } = result;

    // ── Cache keyé sur (natalId + digest + période + locale + variant)
    // Si birthTime / birthDate / lat / lng / ianaTz / birthTimeKnown
    // changent, le digest change, et le cache est auto-invalidé.
    // PATCH-PERSISTENCE-V2-WIRING : periodKey + persistence via helper
    const now = new Date();
    const variant = effectiveIncludeThemes ? "themes" : "plain";
    let periodKey = "";
    switch (period) {
      case "day":   periodKey = now.toISOString().slice(0, 10); break;
      case "week":  periodKey = getIsoWeek(now); break;
      case "month": periodKey = now.toISOString().slice(0, 7); break;
      case "year":  periodKey = String(now.getFullYear()); break;
    }
    // HOTFIX-WIRING-UUID : on sépare natalProfileId (UUID strict) et keySuffix (string libre)
    const horoKeySuffix = `${digest}:${variant}:${loc}`;
    try {
      const transitChart = (period === "day" || period === "week")
        ? await getCurrentTransits(natal.latitude, natal.longitude)
        : undefined;

      const personProfile = natalToProfile(natal);
      const { system, user } = effectiveIncludeThemes
        ? buildHoroscopeWithThemesPrompt({
            natalChart: chart, transitChart, period, locale: loc,
            personName: (natal as any).label ?? natal.name,
            personProfile,
          })
        : buildHoroscopePrompt({
            natalChart: chart, transitChart, period, locale: loc,
            personName: (natal as any).label ?? natal.name,
            personProfile,
          });

      // PATCH-PLANS-REBRAND-V1 : pour le variant simple sur period=day, on réduit encore les tokens
      // (horoscope free doit rester court + coûter peu en xAI).
      const maxTokens = effectiveIncludeThemes
        ? (period === "year" ? 3500 : period === "month" ? 3000 : 2500)
        : (period === "year" ? 1800 : period === "month" ? 1400 : period === "day" ? 650 : 1100);

      // PATCH-PERSISTENCE-V2-WIRING : helper persistence (cache + DB + auto-regen)
      const horoReading = await getOrGenerateHoroscopeReading({
        userId,
        natalProfileId: natalId,
        keySuffix: horoKeySuffix,
        period,
        periodKey,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        options: { temperature: 0.88, maxTokens },
        normalize: (raw) => normalizeHoroscope(raw, loc),
      });

      return reply.send({
        success: true,
        data: horoReading.content,
        cached: horoReading.regenCount === 0 && horoReading.regeneratedAt === null,
        meta: {
          birthTimeKnown: chart.meta?.birthTimeKnown ?? true,
          resolution: chart.meta?.resolution ?? "valid",
        },
      });
    } catch (err) {
      fastify.log.error({ err }, "AI horoscope failed");
      return reply.code(500).send({
        success: false,
        error: {
          code: "AI_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        },
      });
    }
  });

  // ── POST /ai/tarot ─────────────────────────────────
  fastify.post<{
    Body: {
      cards: Array<{ num: number; name: string; position: string }>;
      natalId?: string;
      question?: string;
      locale?: string;
    };
  }>("/tarot", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const { cards, natalId, question, locale } = req.body;

    // ARCHIVE-4-GATES-V1 : consume bundle tarot
    const tarotResult = await entitlementsService.consumeBundle(userId, "tarot", 1);
    if (!tarotResult.allowed) {
      if (entitlementsService.isEnforcementActive()) {
        const code = tarotResult.reason === "quota_exceeded" ? "QUOTA_EXCEEDED" : "FEATURE_NOT_AVAILABLE";
        const status = tarotResult.reason === "quota_exceeded" ? 429 : 403;
        return reply.code(status).send({
          success: false,
          error: {
            code,
            message: tarotResult.reason === "quota_exceeded"
              ? "Tu as atteint ta limite de tirages pour aujourd'hui."
              : "Les tirages de tarot ne sont pas disponibles dans ton plan.",
            feature: "tarot",
            remaining: tarotResult.remaining,
          },
        });
      }
      req.log.warn({ userId, reason: tarotResult.reason }, "[entitlements] would block ai/tarot (enforcement off)");
    }

    if (!cards || cards.length < 1) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "cards required" },
      });
    }

    const loc = locale === "en" ? "en" : "fr";

    try {
      let natalChart: EnrichedChart | undefined;
      let personProfile: PersonProfile | null = null;
      if (natalId) {
        const r = await getNatalChart(natalId, userId);
        if (r) {
          natalChart = r.chart;
          personProfile = natalToProfile(r.natal);
        }
      }

      const { system, user } = buildTarotPrompt({
        cards,
        natalChart,
        locale: loc,
        question,
        personProfile,
      });

      // PATCH-PERSISTENCE-V2-WIRING : sessionId par tirage (figé, pas d'auto-regen)
      const tarotSessionId = randomUUID();
      const tarotReading = await getOrGenerateTarotReading({
        userId,
        sessionId: tarotSessionId,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        options: { temperature: 0.9, maxTokens: 1200 },
        normalize: normalizeTarot,
      });

      return reply.send({
        success: true,
        data: tarotReading.content,
        sessionId: tarotSessionId,
        meta: { birthTimeKnown: natalChart?.meta?.birthTimeKnown ?? true },
      });
    } catch (err) {
      if (err instanceof CityNotFoundError) {
        return reply.code(400).send({
          success: false,
          error: { code: "CITY_NOT_FOUND", message: err.message, suggestions: err.suggestions },
        });
      }
      fastify.log.error({ err }, "AI tarot failed");
      return reply.code(500).send({
        success: false,
        error: { code: "AI_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      });
    }
  });

  // ── POST /ai/natal-profile ──────────────────────────
  fastify.post<{ Body: { natalId: string; locale?: string } }>("/natal-profile", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const { natalId, locale } = req.body;

    // HOTFIX-NATAL-PROFILE-V1 : vérifier d'abord l'accès feature (non-consommateur),
    // puis tenter le cache, puis seulement consume si cache miss.
    // Évite de brûler un quota ai.natal_reading sur un simple rechargement.
    const hasAccess = await entitlementsService.check(userId, "ai.natal_reading");
    if (!hasAccess && entitlementsService.isEnforcementActive()) {
      return reply.code(403).send({
        success: false,
        error: {
          code: "FEATURE_NOT_AVAILABLE",
          message: "La lecture complète de thème natal demande un plan supérieur.",
          feature: "ai.natal_reading",
        },
      });
    }

    if (!natalId) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "natalId required" },
      });
    }

    const loc = locale === "en" ? "en" : "fr";

    let result;
    try {
      result = await getNatalChart(natalId, userId);
    } catch (err) {
      if (err instanceof CityNotFoundError) {
        return reply.code(400).send({
          success: false,
          error: { code: "CITY_NOT_FOUND", message: err.message, suggestions: err.suggestions },
        });
      }
      throw err;
    }

    if (!result) {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Natal profile not found" },
      });
    }

    const { chart, natal, digest } = result;
    // HOTFIX-WIRING-UUID : on sépare natalProfileId (UUID strict) et keySuffix (string libre)
    const profileKeySuffix = `${digest}:${loc}`;

    // PATCH-PERSISTENCE-V2-WIRING : peek-then-consume préservé via flag profileDidGenerate
    // → cache hit (lecture déjà en DB) : pas de consume (gratuit pour le user)
    // → cache miss : consume APRÈS génération réussie
    let profileDidGenerate = false;
    let npResult: any = { allowed: true, reason: null, remaining: null };

    try {
      const { system, user } = buildNatalProfilePrompt({
        natalChart: chart,
        locale: loc,
        personName: (natal as any).label ?? natal.name,
        personProfile: natalToProfile(natal),
      });

      // PATCH-PERSISTENCE-V2-WIRING : helper persistence (peek-then-consume)
      const profileReading = await getOrGenerateNatalProfileReading({
        userId,
        natalProfileId: natalId,
        keySuffix: profileKeySuffix,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        options: { temperature: 0.85, maxTokens: 1600 },
        normalize: (raw) => {
          // Si on entre dans cette closure, on a vraiment appelé xAI → consume quota
          profileDidGenerate = true;
          return normalizeProfile(raw);
        },
      });

      // Si on a généré (cache miss), on consume le quota MAINTENANT (post-génération)
      // → respecte HOTFIX-NATAL-PROFILE-V1 : pas de consume sur cache hit
      if (profileDidGenerate) {
        npResult = await entitlementsService.consumeBundle(userId, "ai.natal_reading", 1);
        if (!npResult.allowed && entitlementsService.isEnforcementActive()) {
          // Quota tombé pendant la génération : on a la lecture, on la rend
          req.log.warn({ userId }, "[quota] consume failed after generation — not reversed");
        }
        if (!npResult.allowed) {
          req.log.warn({ userId, reason: npResult.reason }, "[entitlements] would block ai/natal-profile (enforcement off)");
        }
      }

      return reply.send({
        success: true, data: profileReading.content, cached: !profileDidGenerate,
        meta: { birthTimeKnown: chart.meta?.birthTimeKnown ?? true },
      });
    } catch (err) {
      fastify.log.error({ err }, "AI natal profile failed");
      return reply.code(500).send({
        success: false,
        error: { code: "AI_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      });
    }
  });

  // ── POST /ai/chat ──────────────────────────────────
  fastify.post<{
    Body: {
      natalId?: string;
      planet: string;
      messages: Array<{ role: "user" | "assistant"; content: string; planet?: string }>;
      locale?: string;
    };
  }>("/chat", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const { natalId, planet, messages, locale } = req.body;

    if (!planet || !messages || messages.length === 0) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "planet and messages required" },
      });
    }

    const loc = locale === "en" ? "en" : "fr";

    try {
      let natalChart: EnrichedChart | undefined;
      let personName: string | undefined;
      let personProfile: PersonProfile | null = null;
      if (natalId) {
        const r = await getNatalChart(natalId, userId);
        if (r) {
          natalChart = r.chart;
          personName = (r.natal as any).label ?? r.natal.name;
          personProfile = natalToProfile(r.natal);
        }
      }

      const { system } = buildChatPlanetPrompt({
        planetKey: planet.toLowerCase(),
        natalChart,
        locale: loc,
        personName,
        personProfile,
      });

      // HOTFIX-KAIROS-CHAT-CONTEXT-V1 : préfixer les messages assistant d'autres planètes
      // avec [NomDePlanète] pour que xAI les distingue dans l'historique.
      const activePlanet = planet.toLowerCase();
      const PLANET_LABELS: Record<string, { fr: string; en: string }> = {
        sun:     { fr: "Soleil",  en: "Sun" },
        moon:    { fr: "Lune",    en: "Moon" },
        mercury: { fr: "Mercure", en: "Mercury" },
        venus:   { fr: "Vénus",   en: "Venus" },
        mars:    { fr: "Mars",    en: "Mars" },
        jupiter: { fr: "Jupiter", en: "Jupiter" },
        saturn:  { fr: "Saturne", en: "Saturn" },
      };
      const planetLabel = (key: string): string => {
        const entry = PLANET_LABELS[key.toLowerCase()];
        if (!entry) return key;
        return loc === "fr" ? entry.fr : entry.en;
      };

      const trimmed = messages.slice(-10).map(m => {
        const content = String(m.content ?? "").slice(0, 2000);
        if (
          m.role === "assistant" &&
          m.planet &&
          m.planet.toLowerCase() !== activePlanet
        ) {
          return {
            role: "assistant" as const,
            content: `[${planetLabel(m.planet)}] ${content}`,
          };
        }
        return {
          role: m.role as "user" | "assistant",
          content,
        };
      });

      const reply_text = await xaiService.chat(
        [{ role: "system", content: system }, ...trimmed],
        { temperature: 0.92, maxTokens: 400 },
      );

      return reply.send({
        success: true,
        data: { reply: reply_text, planet },
        meta: { birthTimeKnown: natalChart?.meta?.birthTimeKnown ?? true },
      });
    } catch (err) {
      if (err instanceof CityNotFoundError) {
        return reply.code(400).send({
          success: false,
          error: { code: "CITY_NOT_FOUND", message: err.message, suggestions: err.suggestions },
        });
      }
      fastify.log.error({ err }, "AI chat failed");
      return reply.code(500).send({
        success: false,
        error: { code: "AI_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      });
    }
  });
};

// PATCH-PERSISTENCE-V2-WIRING applied

// HOTFIX-WIRING-UUID applied

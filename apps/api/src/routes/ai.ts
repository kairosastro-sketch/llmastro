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
  buildKairosHostPrompt,  // KAIROS-HOST-V1
  formatNatalContext,
  formatTransitContext,
  type PersonProfile,
} from "../services/ai-prompts.service.js";
// KAIROS-CHAT-TRANSITS-V2 : aspects transit→natal pour le contexte chat.
import { computeTransitAspects, planetDisplayName } from "../services/transits.service.js";
// RELATIONSHIPS-V1 : libellés de relation pour la ligne « relation du jour ».
import { relationshipCategoryLabel, relationshipSubtypeLabel } from "@astro-platform/types";
// KAIROS-FORECAST-V1 : prévision déterministe des positions/aspects futurs.
import { computeForecast, parseHorizon } from "../services/forecast.service.js";
import {
  getOrGenerateHoroscopeReading,
  getOrGenerateNatalProfileReading,
  getOrGenerateTarotReading,
} from "../services/readings.helpers.js"; // PATCH-PERSISTENCE-V2-WIRING
import { randomUUID } from "node:crypto"; // PATCH-PERSISTENCE-V2-WIRING
import { pool } from "../db/index.js"; // HOROSCOPE-PEEK-V1 : query directe sur ai_readings

// ──────────────────────────────────────────────────────────
// Cache Redis (gracieux)
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
    // Strip control chars before logging — rawTz is user-controlled (CWE-117).
    const safeTz = String(rawTz).replace(/[^A-Za-z0-9_\/+-]/g, "_").slice(0, 64);
    // eslint-disable-next-line no-console
    console.warn(
      `[ai] Natal ${natalId} timezone="${safeTz}" ne ressemble pas à une IANA ` +
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

// HOROSCOPE-KEY-MOMENTS-V1 : chaque moment clé devient un objet
// { when, trigger, stance }. On reste rétro-compatible avec le cache
// historique où key_dates était un simple string[] (legacy → trigger).
function normalizeKeyMoment(entry: any): { when: string; trigger: string; stance: string } | null {
  if (typeof entry === "string") {
    const t = entry.trim();
    return t ? { when: "", trigger: t, stance: "" } : null;
  }
  if (entry && typeof entry === "object") {
    const when    = String(entry.when ?? entry.date ?? "").trim();
    const trigger = String(entry.trigger ?? entry.event ?? entry.cause ?? "").trim();
    const stance  = String(entry.stance ?? entry.posture ?? entry.advice ?? "").trim();
    return (when || trigger || stance) ? { when, trigger, stance } : null;
  }
  return null;
}

// FR-GENDER-FIX : filet déterministe. Les astres FÉMININS (Lune, Vénus, Lilith
// + astéroïdes féminins) exigent « ta/ma/sa », jamais « ton/mon/son ». Grok se
// trompe régulièrement (accorde avec le genre de la personne). La règle de prompt
// réduit l'erreur ; ce filet la garantit sur la sortie horoscope. FR uniquement.
const FR_POSS_GENDER_RE = /\b([TtMmSs])on (Lune|Vénus|Lilith|Cérès|Pallas|Junon|Vesta)\b/g;
function fixFrAstreGender(v: any): any {
  if (typeof v === "string") return v.replace(FR_POSS_GENDER_RE, "$1a $2");
  if (Array.isArray(v)) return v.map(fixFrAstreGender);
  if (v && typeof v === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(v)) out[k] = fixFrAstreGender(v[k]);
    return out;
  }
  return v;
}

function normalizeHoroscope(raw: any, locale: string) {
  const rawMoments = raw?.key_dates ?? raw?.keyDates ?? [];
  const out = {
    oracle:   raw?.oracle   ?? (locale === "en" ? "The sky whispers new beginnings." : "Le ciel murmure de nouveaux commencements."),
    summary:  raw?.summary  ?? "",
    text:     raw?.text     ?? "",
    keyDates: (Array.isArray(rawMoments) ? rawMoments : []).map(normalizeKeyMoment).filter(Boolean),
    advice:   raw?.advice   ?? "",
    themes:   raw?.themes   ?? null,
    // RELATIONSHIPS-V1 : ligne « relation du jour » (null si non générée).
    relationships: raw?.relationships ?? null,
  };
  // FR-GENDER-FIX : corrige « ton Lune » → « ta Lune » etc. sur toute la sortie.
  return locale === "en" ? out : fixFrAstreGender(out);
}

// HOTFIX-GROK-RETRY-V1
// Le modèle Grok renvoie parfois un JSON valide mais
// incomplet (thème bâclé, `advice` vide) en s'arrêtant tout seul. On
// valide la forme du variant "themes" : si un thème est trop court ou
// si le conseil manque, on throw → chatJSON retente la génération.
const HOROSCOPE_THEME_KEYS = ["vital", "mental", "harmony", "love", "career", "luck"] as const;

function assertThemedHoroscopeComplete(raw: any): void {
  const themes = raw?.themes;
  if (!themes || typeof themes !== "object") {
    throw new Error("themes object missing");
  }
  for (const key of HOROSCOPE_THEME_KEYS) {
    const value = themes[key];
    // HOROSCOPE-CONSEIL-DETAILS-V1 : thèmes désormais des conseils courts
    // (2-3 phrases) → seuil abaissé de 200 à 100 caractères.
    if (typeof value !== "string" || value.trim().length < 100) {
      throw new Error(`theme "${key}" missing or too short`);
    }
  }
  if (typeof raw?.summary !== "string" || raw.summary.trim().length < 40) {
    throw new Error("summary missing or too short");
  }
  if (typeof raw?.advice !== "string" || raw.advice.trim().length < 15) {
    throw new Error("advice missing");
  }
  // HOROSCOPE-CONSEIL-DETAILS-V1 : "text" est maintenant la lecture détaillée
  // (couche « Plus de détails ») → requis et non trivial.
  if (typeof raw?.text !== "string" || raw.text.trim().length < 150) {
    throw new Error("detailed text missing or too short");
  }
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
// RELATIONSHIPS-V1 — relation la plus « activée » par les transits du jour.
// Pour chaque proche tagué (catégorie réelle), on calcule les transits du jour
// vs son thème natal et on retient celle dont l'aspect le plus serré est le plus
// fort. Renvoie de quoi écrire 1-2 lignes cadrées par la nature de la relation.
interface RelationshipActivation {
  partnerLabel:  string;
  categoryLabel: string | null;
  subtypeLabel:  string | null;
  category:      string;
  aspects:       string[];   // 1-2 aspects en clair (contexte modèle)
  tone:          "harmony" | "tension" | "mixed";
}

async function computeTopRelationship(
  userId: string,
  selfNatalId: string,
  transitPlanets: Record<string, any>,
  locale: "fr" | "en",
): Promise<RelationshipActivation | null> {
  const realCat = (c: any) => (c && c !== "unspecified" && c !== "self" ? String(c) : null);
  let profiles: any[];
  try { profiles = await natalService.findByUser(userId); } catch { return null; }
  const tagged = profiles
    .filter((p) => p.id !== selfNatalId && !p.isSelf && realCat(p.relationshipCategory))
    .slice(0, 8); // borne le coût (N calculs de thème par horoscope)
  if (!tagged.length) return null;

  let best: { p: any; tops: any[] } | null = null;
  let bestScore = -Infinity;
  for (const p of tagged) {
    let chart;
    try {
      chart = await ephemerisService.calculateNatalChart({
        natalId:        p.id,
        localBirthDate: p.birthDate,
        localBirthTime: p.birthTime ?? "12:00",
        ianaTz:         p.timezone,
        latitude:       p.latitude,
        longitude:      p.longitude,
        birthTimeKnown: !(p.birthTimeUnknown ?? false),
      });
    } catch { continue; }
    const aspects = computeTransitAspects(transitPlanets as any, chart.planets as any);
    const tight = aspects.filter((a) => a.orb < 3); // serrés = vraiment « actifs »
    if (!tight.length) continue;
    const peak = tight[0]!.priority; // déjà triés par priorité décroissante
    if (peak > bestScore) { bestScore = peak; best = { p, tops: tight.slice(0, 2) }; }
  }
  if (!best) return null;

  const tones = new Set(best.tops.map((a) => a.tone));
  const tone: RelationshipActivation["tone"] =
    tones.has("harmony") && tones.has("tension") ? "mixed"
    : tones.has("tension") ? "tension" : "harmony";

  const aspects = best.tops.map((a) => {
    const t = planetDisplayName(a.transitPlanet, locale);
    const n = planetDisplayName(a.natalPlanet, locale);
    const rel = locale === "fr" ? (a.typeFr ?? a.type).toLowerCase() : a.type;
    return locale === "fr"
      ? `${t} en transit ${rel} son ${n} natal`
      : `transiting ${t} ${rel} their natal ${n}`;
  });

  return {
    partnerLabel:  best.p.label,
    categoryLabel: relationshipCategoryLabel(best.p.relationshipCategory, locale),
    subtypeLabel:  relationshipSubtypeLabel(best.p.relationshipType, locale),
    category:      String(best.p.relationshipCategory),
    aspects,
    tone,
  };
}

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
  relationship?: RelationshipActivation | null;   // RELATIONSHIPS-V1
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

  // RELATIONSHIPS-V1 : bloc de contexte (message user) + instruction (system)
  // pour la « relation du jour ». Présents uniquement si une relation est activée.
  const rel = args.relationship ?? null;
  const relContext = rel
    ? (locale === "fr"
        ? `\n\n── RELATION ACTIVÉE AUJOURD'HUI ──\n${rel.partnerLabel}${rel.categoryLabel ? ` (relation ${rel.categoryLabel.toLowerCase()}${rel.subtypeLabel ? `, ${rel.subtypeLabel.toLowerCase()}` : ""})` : ""} : ${rel.aspects.join(" ; ")}. Tonalité : ${rel.tone === "harmony" ? "porteuse" : rel.tone === "tension" ? "à surveiller" : "mêlée"}.`
        : `\n\n── RELATIONSHIP ACTIVATED TODAY ──\n${rel.partnerLabel}${rel.categoryLabel ? ` (${rel.categoryLabel.toLowerCase()}${rel.subtypeLabel ? `, ${rel.subtypeLabel.toLowerCase()}` : ""})` : ""}: ${rel.aspects.join("; ")}. Tone: ${rel.tone}.`)
    : "";
  const relInstruction = rel
    ? (locale === "fr"
        ? `\n\nAjoute aussi au JSON un champ "relationships" : 1 à 2 phrases sur ce que la journée fait vivre à ta relation avec ${rel.partnerLabel}, dans son registre propre (${rel.categoryLabel ?? "lien"}${rel.subtypeLabel ? `, ${rel.subtypeLabel.toLowerCase()}` : ""}), en t'appuyant sur la « RELATION ACTIVÉE » fournie. Nomme ${rel.partnerLabel}, reste concret et sobre, et JAMAIS de registre amoureux si la relation ne l'est pas.`
        : `\n\nAlso add a "relationships" field to the JSON: 1-2 sentences on what the day brings to your relationship with ${rel.partnerLabel}, in its own register (${rel.categoryLabel ?? "bond"}${rel.subtypeLabel ? `, ${rel.subtypeLabel.toLowerCase()}` : ""}), grounded in the provided "RELATIONSHIP ACTIVATED". Name ${rel.partnerLabel}, stay concrete and sober, and NEVER use a romantic register unless the relationship is romantic.`)
    : "";

  const system = (locale === "fr"
    ? `Tu es Kairos, un·e astrologue expérimenté·e de tradition occidentale. Tu rédiges des horoscopes personnalisés en t'appuyant strictement sur les données du thème natal et des transits fournis. Tu nommes les planètes, signes et maisons concrètement. Ton ton est clair, poétique sans être nébuleux, toujours constructif. Tu évites le catastrophisme.

${kairosToneDirective("fr")}

Tu réponds UNIQUEMENT en JSON valide avec ce schéma STRICT :
{
  "oracle":  "citation courte et poétique (1 phrase, 10-20 mots)",
  "summary": "résumé accrocheur en 2-3 phrases",
  "themes": {
    "vital":   "CONSEIL Vitalité — 2 à 3 phrases (~40-60 mots) : ce que la journée invite à vivre ou à faire côté énergie/corps, incarné et actionnable. AUCUN terme technique ici (pas de nom de transit, d'aspect, de maison ni de degré)",
    "mental":  "CONSEIL Mental / esprit — 2 à 3 phrases (~40-60 mots), même registre, sans jargon",
    "harmony": "CONSEIL Harmonie émotionnelle — 2 à 3 phrases, sans jargon",
    "love":    "CONSEIL Amour / liens — 2 à 3 phrases, sans jargon",
    "career":  "CONSEIL Carrière / action — 2 à 3 phrases, sans jargon",
    "luck":    "CONSEIL Chance / opportunités — 2 à 3 phrases, sans jargon"
  },
  "text":      "LECTURE DÉTAILLÉE du ciel du jour, 2 à 3 paragraphes séparés par \\n\\n. PAR EXCEPTION à la règle anti-jargon ci-dessus, c'est le SEUL champ où tu peux — et dois — nommer explicitement les transits, aspects et maisons réels et expliquer la mécanique du jour, pour les lecteurs curieux. Reste lisible (explique, ne te contente pas de lister des degrés bruts)",
  "key_dates": [
    {
      "when":    "le moment concerné, formulé naturellement (ex : « autour du 5 juin », « du 9 au 11 », « cette semaine »)",
      "trigger": "le déclencheur astral PRÉCIS et nommé : le transit ou aspect en jeu et ce qu'il touche dans le thème (ex : « Lune en Balance activant ton Vénus natal en maison 7 », « Mars carré ton Mercure natal »)",
      "stance":  "la posture concrète à adopter face à ce moment, une phrase actionnable (ex : « privilégie une conversation sincère, n'impose pas de décision »)"
    }
  ],
  "advice":    "un conseil concret final en une phrase"
}

IMPORTANT : les 6 thèmes sont des CONSEILS courts et incarnés (2 à 3 phrases chacun, SANS aucun terme technique). Le champ "text" est la SEULE lecture détaillée où la mécanique astrale (transits, aspects, maisons nommés) est autorisée et attendue. Ancre TOUT dans les positions et transits réels fournis ; n'invente jamais un aspect. Pour key_dates : produis 2 à 4 moments ; chaque "trigger" DOIT nommer un transit ou aspect réel issu des données fournies (jamais inventé), et chaque "stance" doit être une posture concrète, pas une généralité.`
    : `You are Kairos, an experienced western-tradition astrologer. You write personalized horoscopes strictly based on the provided natal chart and current transits. You name planets, signs and houses concretely. Tone is clear, poetic without being vague, always constructive.

${kairosToneDirective("en")}

You respond ONLY in valid JSON with this STRICT schema:
{
  "oracle":  "short poetic quote (1 sentence, 10-20 words)",
  "summary": "2-3 punchy sentences",
  "themes": {
    "vital":   "Vitality ADVICE — 2-3 sentences (~40-60 words): what today invites you to live or do energy/body-wise, embodied and actionable. NO technical terms here (no transit, aspect, house or degree names)",
    "mental":  "Mental ADVICE — 2-3 sentences (~40-60 words), same register, no jargon",
    "harmony": "Emotional Harmony ADVICE — 2-3 sentences, no jargon",
    "love":    "Love ADVICE — 2-3 sentences, no jargon",
    "career":  "Career ADVICE — 2-3 sentences, no jargon",
    "luck":    "Luck / Opportunities ADVICE — 2-3 sentences, no jargon"
  },
  "text":      "DETAILED reading of today's sky, 2-3 paragraphs separated by \\n\\n. AS AN EXCEPTION to the no-jargon rule above, this is the ONLY field where you may — and should — explicitly name the real transits, aspects and houses and explain the day's mechanics, for curious readers. Stay readable (explain, don't just list raw degrees)",
  "key_dates": [
    {
      "when":    "the moment, phrased naturally (e.g. \"around June 5\", \"June 9-11\", \"this week\")",
      "trigger": "the PRECISE, named astral driver: the transit or aspect at play and what it touches in the chart (e.g. \"Moon in Libra activating your natal Venus in house 7\", \"Mars square your natal Mercury\")",
      "stance":  "the concrete stance to adopt, one actionable sentence (e.g. \"favor a sincere conversation, don't force a decision\")"
    }
  ],
  "advice":    "one concrete final advice"
}

IMPORTANT: the 6 themes are SHORT embodied ADVICE (2-3 sentences each, with NO technical terms). The "text" field is the ONLY detailed reading where astral mechanics (named transits, aspects, houses) are allowed and expected. Ground EVERYTHING in the real provided positions and transits; never invent an aspect. For key_dates: produce 2-4 moments; each "trigger" MUST name a real transit or aspect from the provided data (never invented), and each "stance" must be a concrete posture, not a generality.`) + confidenceBlock + relInstruction;

  const personIntro = args.personName
    ? (locale === "fr" ? `Prénom : ${args.personName}\n\n` : `Name: ${args.personName}\n\n`)
    : "";

  const user = locale === "fr"
    ? `${personIntro}${natal}\n\n${transit}${relContext}\n\nRédige l'horoscope ${periodLabels[args.period]} AVEC les 6 conseils de thème (courts, sans jargon) ET la lecture détaillée "text".`
    : `${personIntro}${natal}\n\n${transit}${relContext}\n\nWrite the horoscope ${periodLabels[args.period]} WITH the 6 short jargon-free theme advice entries AND the detailed "text" reading.`;

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
        model:      process.env["XAI_MODEL"] ?? "grok-4.3",
      },
    });
  });

  // ── GET /ai/horoscope/peek ───────────────────────────
  // HOROSCOPE-PEEK-V1 : lit le cache horoscope d'un natal+période
  // sans gate entitlements ni génération xAI. Utilisé par le front
  // pour afficher un teaser ('summary') quand le user est gated sur
  // /ai/horoscope (quota épuisé ou feature non disponible) : on lui
  // montre le résumé de la dernière génération + un message d'upgrade
  // inline au lieu d'un PaywallModal abrupt.
  //
  // Retourne 200 avec { summary: null, generatedAt: null } si aucune
  // ligne en cache pour cette (user, natal, période). Pas d'erreur,
  // juste pas de teaser — le front affiche alors uniquement le
  // message d'upgrade.
  fastify.get<{
    Querystring: {
      natalId: string;
      period: "day" | "week" | "month" | "year";
    };
  }>("/horoscope/peek", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const { natalId, period } = req.query;

    if (!natalId || !period) {
      return reply.code(400).send({
        success: false,
        error: { code: "INVALID_REQUEST", message: "natalId + period required" },
      });
    }

    // Calcul du periodKey courant (mirror exact de POST /ai/horoscope l.462-468).
    const now = new Date();
    let periodKey = "";
    switch (period) {
      case "day":   periodKey = now.toISOString().slice(0, 10); break;
      case "week":  periodKey = getIsoWeek(now); break;
      case "month": periodKey = now.toISOString().slice(0, 7); break;
      case "year":  periodKey = String(now.getFullYear()); break;
      default:
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_REQUEST", message: "period must be day|week|month|year" },
        });
    }

    // reading_key = "${natalId}:${digest}:${variant}:${locale}:${period}:${periodKey}"
    // On match tout digest/variant/locale, période fixée. On prend la row la plus
    // récente (regenerated_at en priorité, sinon generated_at).
    const result = await pool.query(
      `SELECT content, generated_at, regenerated_at
       FROM ai_readings
       WHERE user_id = $1
         AND kind = 'horoscope'
         AND natal_profile_id = $2
         AND reading_key LIKE $3
       ORDER BY COALESCE(regenerated_at, generated_at) DESC
       LIMIT 1`,
      [userId, natalId, `%:${period}:${periodKey}`],
    );

    if (result.rowCount === 0) {
      return reply.send({
        success: true,
        data: { summary: null, generatedAt: null },
      });
    }

    const row = result.rows[0];
    const content = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
    const generatedAt = new Date(row.regenerated_at ?? row.generated_at);
    return reply.send({
      success: true,
      data: {
        summary:     content?.summary ?? null,
        generatedAt: generatedAt.toISOString(),
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

    // PAYWALL-V3 : quota mensuel d'horoscopes du jour Kairos.
    // Free = 5/mois, paid = illimité. La notification push quotidienne
    // d'horoscope reste accessible gratuitement pour tous (hors scope ici).
    if (period === "day") {
      const dayResult = await entitlementsService.consumeBundle(userId, "horoscope.day", 1);
      if (!dayResult.allowed) {
        if (entitlementsService.isEnforcementActive()) {
          const code = dayResult.reason === "quota_exceeded" ? "QUOTA_EXCEEDED" : "FEATURE_NOT_AVAILABLE";
          const status = dayResult.reason === "quota_exceeded" ? 429 : 403;
          return reply.code(status).send({
            success: false,
            error: {
              code,
              message: dayResult.reason === "quota_exceeded"
                ? "Tu as consulté tous tes horoscopes du jour pour ce mois. Continue avec la notification quotidienne ou passe à un plan supérieur."
                : "L'horoscope du jour Kairos n'est pas disponible dans ton plan.",
              feature: "horoscope.day",
              remaining: dayResult.remaining,
            },
          });
        }
        req.log.warn({ userId, reason: dayResult.reason }, "[entitlements] would block ai/horoscope day (enforcement off)");
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
    // RELATIONSHIPS-V1 : suffixe ":rel1" → bust du cache pour régénérer avec la
    // ligne « relation du jour ».
    const horoKeySuffix = `${digest}:${variant}:${loc}:rel1`;
    try {
      const transitChart = (period === "day" || period === "week")
        ? await getCurrentTransits(natal.latitude, natal.longitude)
        : undefined;

      const personProfile = natalToProfile(natal);
      // RELATIONSHIPS-V1 : relation la plus activée aujourd'hui (variant themes
      // + transits disponibles). null si aucun proche tagué n'est touché.
      const relationship = (effectiveIncludeThemes && transitChart)
        ? await computeTopRelationship(userId, natalId, transitChart.planets as any, loc)
        : null;
      const { system, user } = effectiveIncludeThemes
        ? buildHoroscopeWithThemesPrompt({
            natalChart: chart, transitChart, period, locale: loc,
            personName: (natal as any).label ?? natal.name,
            personProfile,
            relationship,
          })
        : buildHoroscopePrompt({
            natalChart: chart, transitChart, period, locale: loc,
            personName: (natal as any).label ?? natal.name,
            personProfile,
          });

      // PATCH-PLANS-REBRAND-V1 : pour le variant simple sur period=day, on réduit encore les tokens
      // (horoscope free doit rester court + coûter peu en xAI).
      // HOTFIX-GROK-RETRY-V1 : le variant "themes" génère 6 analyses détaillées
      // (~80-100 mots chacune) + oracle + résumé + synthèse longue + dates +
      // conseil. L'ancien plafond (2500 pour day/week) coupait la réponse en
      // plein milieu (finish_reason=length) → JSON tronqué. On élargit le
      // budget pour laisser la génération aller à son terme.
      const maxTokens = effectiveIncludeThemes
        ? (period === "year" ? 5000 : period === "month" ? 4500 : 4000)
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
        // HOTFIX-GROK-RETRY-V1 : 0.88 était trop élevé — une température
        // plus basse améliore le respect du schéma et la complétude.
        options: { temperature: 0.7, maxTokens },
        normalize: (raw) => normalizeHoroscope(raw, loc),
        validate: effectiveIncludeThemes ? assertThemedHoroscopeComplete : undefined,
      });

      return reply.send({
        success: true,
        data: horoReading.content,
        cached: horoReading.regenCount === 0 && horoReading.regeneratedAt === null,
        // HOROSCOPE-GENERATED-AT-V1 : timestamp de génération (ou
        // régénération la plus récente). Affiché côté front en relatif
        // + heure + fuseau horaire de l'utilisateur.
        generatedAt: (horoReading.regeneratedAt ?? horoReading.generatedAt).toISOString(),
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

    // PAYWALL-FRONT-V2 : pas de consumeBundle("tarot") ici. Le quota tarot
    // est consommé en amont par POST /horoscope/tarot (porte d'entrée du
    // flux : on ne peut demander une interprétation IA qu'après avoir tiré
    // les cartes). Le rate-limit Fastify global suffit pour la protection
    // anti-abus si quelqu'un appelait directement /ai/tarot.

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
        options: { temperature: 0.9, maxTokens: 2400, timeoutMs: 90000 },
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

    // PAYWALL-V3 : la feature "Profil psychologique Kairos" est ouverte à
    // tous les plans. Le cache backend (cf. getOrGenerateNatalProfileReading)
    // garantit qu'une analyse n'est générée qu'une fois par (digest, locale)
    // — aucun risque de surconsommation xAI. Pas de gate quota ici.

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

    // PAYWALL-V3 : plus de consume quota ici (feature ouverte). Le flag
    // didGenerate sert seulement à renseigner `cached:` côté response pour
    // le debug front.
    let didGenerate = false;

    try {
      const { system, user } = buildNatalProfilePrompt({
        natalChart: chart,
        locale: loc,
        personName: (natal as any).label ?? natal.name,
        personProfile: natalToProfile(natal),
      });

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
          didGenerate = true;
          return normalizeProfile(raw);
        },
      });

      return reply.send({
        success: true, data: profileReading.content, cached: !didGenerate,
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
      // KAIROS-FORECAST-V1 : horizon de prévision demandé par Kairos au tour
      // précédent (via ::FORECAST::). Présent uniquement sur le 2e tour.
      forecast?: string;
    };
  }>("/chat", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const { natalId, planet, messages, locale, forecast } = req.body;

    // KAIROS-FORECAST-V1 : le 2e tour (forecast) est la continuation d'UNE
    // même question utilisateur — on ne reconsomme pas de quota ai.chat.
    const forecastHorizon = parseHorizon(forecast);
    const isForecastContinuation = forecastHorizon !== null;

    if (!planet || !messages || messages.length === 0) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "planet and messages required" },
      });
    }

    // ARCHIVE-4-GATES-V1 : consume bundle ai.chat (quota mensuel puis crédits)
    // KAIROS-FORECAST-V1 : skip sur la continuation forecast (déjà facturée au 1er tour).
    const chatResult = isForecastContinuation
      ? { allowed: true, reason: undefined as string | undefined, remaining: undefined as number | undefined }
      : await entitlementsService.consumeBundle(userId, "ai.chat", 1);
    if (!chatResult.allowed) {
      if (entitlementsService.isEnforcementActive()) {
        const code = chatResult.reason === "quota_exceeded" ? "QUOTA_EXCEEDED" : "FEATURE_NOT_AVAILABLE";
        const status = chatResult.reason === "quota_exceeded" ? 429 : 403;
        return reply.code(status).send({
          success: false,
          error: {
            code,
            message: chatResult.reason === "quota_exceeded"
              ? "Tu as atteint ta limite de messages avec Kairos pour ce mois."
              : "Le chat Kairos n'est pas disponible dans ton plan.",
            feature: "ai.chat",
            remaining: chatResult.remaining,
          },
        });
      }
      req.log.warn({ userId, reason: chatResult.reason }, "[entitlements] would block ai/chat (enforcement off)");
    }

    const loc = locale === "en" ? "en" : "fr";

    try {
      let natalChart: EnrichedChart | undefined;
      let transitChart: EnrichedChart | undefined;
      let transitAspects: Array<{
        transitPlanet: string;
        natalPlanet:   string;
        type:          string;
        typeFr:        string;
        orb:           number;
        exact:         boolean;
        tone:          "harmony" | "tension" | "neutral";
      }> = [];
      let personName: string | undefined;
      let personProfile: PersonProfile | null = null;
      if (natalId) {
        const r = await getNatalChart(natalId, userId);
        if (r) {
          natalChart = r.chart;
          personName = (r.natal as any).label ?? r.natal.name;
          personProfile = natalToProfile(r.natal);

          // KAIROS-CHAT-TRANSITS-V2 : charge le ciel du jour + aspects
          // transit→natal pour que Kairos s'appuie sur des configurations
          // VRAIES du moment plutôt que des généralités. Échec silencieux :
          // si les transits ne peuvent être calculés, on tombe en
          // fallback natal-only (comportement antérieur).
          try {
            transitChart = await getCurrentTransits(r.natal.latitude, r.natal.longitude);
            transitAspects = computeTransitAspects(
              transitChart.planets as any,
              natalChart.planets as any,
            ).slice(0, 8); // top 8 par priorité (déjà triés par computeTransitAspects)
          } catch (err) {
            req.log.warn({ err }, "[chat] transits load failed, fallback natal-only");
          }
        }
      }

      // KAIROS-HOST-V1 : "kairos" = l'hôte généraliste (agent par défaut),
      // les autres clés = ses agents-planètes spécialistes.
      const isKairos = planet.toLowerCase() === "kairos";

      // KAIROS-FORECAST-V1 : si Kairos a demandé une prévision (2e tour),
      // on calcule le ciel à venir côté serveur et on l'injecte dans le
      // prompt. Le LLM interprète des dates exactes, il ne devine rien.
      let forecastBlock: string | undefined;
      if (isKairos && forecastHorizon && natalChart?.planets) {
        try {
          const fc = computeForecast(natalChart.planets as any, forecastHorizon, loc);
          if (fc.text) forecastBlock = fc.text;
        } catch (err) {
          req.log.warn({ err, forecastHorizon }, "[chat] forecast compute failed");
        }
      }

      const { system } = isKairos
        ? buildKairosHostPrompt({
            natalChart,
            transitChart,
            transitAspects,
            locale: loc,
            personName,
            personProfile,
            forecastBlock,
          })
        : buildChatPlanetPrompt({
            planetKey: planet.toLowerCase(),
            natalChart,
            transitChart,
            transitAspects,
            locale: loc,
            personName,
            personProfile,
          });

      // HOTFIX-KAIROS-CHAT-CONTEXT-V1 : préfixer les messages assistant d'autres planètes
      // avec [NomDePlanète] pour que xAI les distingue dans l'historique.
      const activePlanet = planet.toLowerCase();
      const PLANET_LABELS: Record<string, { fr: string; en: string }> = {
        kairos:  { fr: "Kairos",  en: "Kairos" },  // KAIROS-HOST-V1
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

      // CHAT-PERSONA-FIX-V1 / KAIROS-HOST-V1 : on préfixe aussi le greeting
      // initial assistant sans `planet`. Convention frontend : le greeting au
      // mount est désormais celui de Kairos (l'hôte), donc si activePlanet
      // n'est pas "kairos" on préfixe [Kairos] pour éviter que la planète
      // active ne l'absorbe comme sa propre voix native.
      const trimmed = messages.slice(-10).map(m => {
        const content = String(m.content ?? "").slice(0, 2000);
        // Cas 1 : message assistant taggé d'une autre planète
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
        // Cas 2 (KAIROS-HOST-V1) : greeting initial sans `planet`, issu de
        // Kairos par convention frontend. Si activePlanet n'est pas "kairos",
        // on tague [Kairos] pour clarifier la voix au LLM.
        if (
          m.role === "assistant" &&
          !m.planet &&
          activePlanet !== "kairos"
        ) {
          return {
            role: "assistant" as const,
            content: `[${planetLabel("kairos")}] ${content}`,
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

// CHAT-PERSONA-FIX-V1 applied

// ============================================================
// FORECAST SERVICE — KAIROS-FORECAST-V1
// ------------------------------------------------------------
// Calcul DÉTERMINISTE des positions planétaires à venir et des
// aspects transit → natal qui se perfectionnent sur une fenêtre.
// Tout est calculé côté serveur (éphéméride, ~0 token) puis
// résumé en un bloc texte compact injecté dans le prompt Kairos :
// le LLM INTERPRÈTE des faits exacts, il ne devine jamais une
// position (cf. mémoire ephemeris-server-side-not-llm).
// ============================================================

import { allPositions, jd as toJulianDay } from "@astro-platform/ephemeris";
import {
  computeTransitAspects,
  planetDisplayName,
  type PlanetPosition,
} from "./transits.service.js";

export type ForecastHorizon = "week" | "month" | "quarter" | "year" | "years";

interface HorizonConfig {
  days:        number;   // longueur de la fenêtre
  stepDays:    number;   // pas d'échantillonnage
  exclude:     string[]; // planètes en transit à ignorer (trop rapides → bruit)
  minPriority: number;   // seuil de priorité d'aspect (lentes + serré = haut)
  maxEvents:   number;   // nb max d'événements remontés
  withYear:    boolean;  // afficher l'année dans les dates
}

// Fenêtres + stratégie par horizon. Plus l'horizon est long, plus on
// échantillonne grossièrement et plus on exclut les planètes rapides
// (Lune ~13°/j, Mercure/Vénus ~1°/j) qui repassent trop souvent pour être
// signifiantes sur plusieurs mois/années.
const HORIZON_CONFIG: Record<ForecastHorizon, HorizonConfig> = {
  week:    { days: 7,       stepDays: 1, exclude: [],                                     minPriority: 4,  maxEvents: 12, withYear: false },
  month:   { days: 31,      stepDays: 1, exclude: [],                                     minPriority: 6,  maxEvents: 12, withYear: false },
  quarter: { days: 92,      stepDays: 1, exclude: ["moon"],                               minPriority: 8,  maxEvents: 14, withYear: false },
  // Horizons longs : on exclut les planètes rapides (qui repassent sans cesse
  // et écraseraient la timeline sur les premières semaines) pour ne garder que
  // les transits LENTS et significatifs (Mars + Jupiter/Saturne/externes),
  // ceux qui définissent vraiment « quel mois / quelle année » est propice.
  year:    { days: 366,     stepDays: 3, exclude: ["moon", "sun", "mercury", "venus"],         minPriority: 9,  maxEvents: 16, withYear: true  },
  years:   { days: 366 * 3, stepDays: 7, exclude: ["moon", "sun", "mercury", "venus", "mars"], minPriority: 11, maxEvents: 18, withYear: true  },
};

// Seules ces planètes ont un nom d'affichage + un poids de transit (cf.
// transits.service). On ignore chiron / lilith / nœuds qui sortiraient en
// minuscule et hors du vocabulaire des personas.
const ALLOWED_TRANSIT_PLANETS = new Set([
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto",
]);

const HORIZON_LABEL_FR: Record<ForecastHorizon, string> = {
  week: "7 prochains jours", month: "mois à venir", quarter: "3 prochains mois",
  year: "12 prochains mois", years: "3 prochaines années",
};
const HORIZON_LABEL_EN: Record<ForecastHorizon, string> = {
  week: "next 7 days", month: "coming month", quarter: "next 3 months",
  year: "next 12 months", years: "next 3 years",
};

const TONE_FR = { harmony: "harmonie", tension: "tension", neutral: "neutre" } as const;
const TONE_EN = { harmony: "harmony", tension: "tension", neutral: "neutral" } as const;

export interface ForecastEvent {
  date:          Date;
  transitPlanet: string;
  natalPlanet:   string;
  type:          string;
  typeFr:        string;
  symbol:        string;
  tone:          "harmony" | "tension" | "neutral";
  orb:           number;
}

export interface Forecast {
  horizon: ForecastHorizon;
  events:  ForecastEvent[];
  text:    string;
}

/** Normalise un token d'horizon émis par Kairos (FR/EN, pluriels) → canonique. */
export function parseHorizon(raw: string | undefined | null): ForecastHorizon | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase();
  if (["week", "semaine", "7d"].includes(k)) return "week";
  if (["month", "mois", "30d"].includes(k)) return "month";
  if (["quarter", "trimestre", "90d", "3m"].includes(k)) return "quarter";
  if (["year", "an", "année", "annee", "12m"].includes(k)) return "year";
  if (["years", "ans", "années", "annees", "multi"].includes(k)) return "years";
  return null;
}

function dateToJD(d: Date): number {
  return toJulianDay(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours() + d.getUTCMinutes() / 60,
  );
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDate(d: Date, locale: string, withYear: boolean): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(d);
}

/**
 * Calcule la prévision pour un thème natal sur un horizon donné.
 *
 * Pour chaque date échantillonnée on calcule les positions du ciel
 * (allPositions) et les aspects transit→natal. On retient, par couple
 * (planète transit, planète natale, type d'aspect), la date où l'orbe est
 * le plus serré dans la fenêtre = la date de perfection (l'aspect devient
 * exact). On ne garde que les aspects qui se perfectionnent réellement
 * (orbe minimal < 1°) et au-dessus du seuil de priorité de l'horizon.
 *
 * @param natal  positions planétaires du thème natal (Record<key, PlanetPosition>)
 * @param now    date de départ (par défaut maintenant) — injectable pour les tests
 */
export function computeForecast(
  natal: Record<string, PlanetPosition>,
  horizon: ForecastHorizon,
  locale = "fr",
  now: Date = new Date(),
): Forecast {
  const cfg = HORIZON_CONFIG[horizon];
  const loc = locale === "en" ? "en" : "fr";

  // Garde-fou : sans natal, pas de prévision possible.
  if (!natal || Object.keys(natal).length === 0) {
    return { horizon, events: [], text: "" };
  }

  // key = `${tPlanet}-${nPlanet}-${type}` → meilleur (orbe le plus serré) vu.
  const best = new Map<string, { ev: ForecastEvent; orb: number; priority: number }>();

  for (let day = 0; day <= cfg.days; day += cfg.stepDays) {
    const date = addDays(now, day);
    const positions = allPositions(dateToJD(date));

    // Filtre : planètes nommées uniquement, moins les rapides exclues pour cet horizon.
    const transit: Record<string, PlanetPosition> = {};
    for (const [key, p] of Object.entries(positions)) {
      if (!ALLOWED_TRANSIT_PLANETS.has(key) || cfg.exclude.includes(key)) continue;
      if (p && typeof p.longitude === "number") transit[key] = p;
    }

    const aspects = computeTransitAspects(transit, natal);
    for (const a of aspects) {
      if (a.priority < cfg.minPriority) continue;
      const key = `${a.transitPlanet}-${a.natalPlanet}-${a.type}`;
      const prev = best.get(key);
      if (!prev || a.orb < prev.orb) {
        best.set(key, {
          orb: a.orb,
          priority: a.priority,
          ev: {
            date,
            transitPlanet: a.transitPlanet,
            natalPlanet:   a.natalPlanet,
            type:          a.type,
            typeFr:        a.typeFr,
            symbol:        a.symbol,
            tone:          a.tone,
            orb:           a.orb,
          },
        });
      }
    }
  }

  // On ne garde que les aspects qui se perfectionnent vraiment dans la fenêtre
  // (orbe mini < 1°). On sélectionne les PLUS SIGNIFIATIFS (priorité = poids des
  // planètes + serrage), puis on les présente dans l'ordre chronologique — sinon
  // les aspects précoces écraseraient la timeline sur un horizon long.
  const events = [...best.values()]
    .filter((b) => b.orb < 1)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, cfg.maxEvents)
    .map((b) => b.ev)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const text = formatForecast(events, horizon, loc, cfg.withYear);
  return { horizon, events, text };
}

function formatForecast(
  events: ForecastEvent[],
  horizon: ForecastHorizon,
  locale: string,
  withYear: boolean,
): string {
  const label = locale === "en" ? HORIZON_LABEL_EN[horizon] : HORIZON_LABEL_FR[horizon];
  const toneMap = locale === "en" ? TONE_EN : TONE_FR;

  if (events.length === 0) {
    return locale === "en"
      ? `SKY AHEAD (${label}): no major transit→natal aspect perfects in this window. The sky stays steady — no standout day stands above the rest.`
      : `CIEL À VENIR (${label}) : aucun aspect transit→natal majeur ne se perfectionne sur cette fenêtre. Le ciel reste stable — aucun jour ne se détache nettement.`;
  }

  const header = locale === "en"
    ? `SKY AHEAD (${label}) — exact transit→natal aspects (server-computed, reliable dates):`
    : `CIEL À VENIR (${label}) — aspects transit→natal exacts (calculés côté serveur, dates fiables) :`;

  const lines = events.map((e) => {
    const tP = planetDisplayName(e.transitPlanet, locale);
    const nP = planetDisplayName(e.natalPlanet, locale);
    const when = formatDate(e.date, locale, withYear);
    const tone = toneMap[e.tone];
    return locale === "en"
      ? `- ${when}: transiting ${tP} ${e.type} natal ${nP} — ${tone}`
      : `- ${when} : ${tP} en transit ${e.typeFr} ton ${nP} natal — ${tone}`;
  });

  return [header, ...lines].join("\n");
}

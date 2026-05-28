// ============================================================
// TRANSITS SERVICE
// Calcul des aspects, activations de maisons, alertes
// ============================================================

import { ASPECT_TYPES as CANONICAL_ASPECTS } from "@astro-platform/ephemeris";

export interface PlanetPosition {
  longitude: number;
  signIdx?:  number;
  degree?:   number;
  retrograde?: boolean;
  speed?:    number;
}

export interface NatalHouse {
  number?:   number;
  longitude: number;
}

export interface TransitAspect {
  transitPlanet: string;
  natalPlanet:   string;
  type:          string;
  typeFr:        string;
  symbol:        string;
  angle:         number;
  orb:           number;
  exact:         boolean;
  tight:         boolean;
  tone:          "harmony" | "tension" | "neutral";
  priority:      number;
}

// ──────────────────────────────────────────────────────────
// Règles d'aspects
// ------------------------------------------------------------
// C1-FIX : source unique des angles / symboles / tonalités = la table
// canonique ASPECT_TYPES du package ephemeris. Seuls les ORBES sont
// redéfinis ici : les transits utilisent des orbes volontairement plus
// SERRÉS que le natal — un transit est un événement daté, un orbe large
// l'étalerait sur des semaines et rendrait les lectures floues.
// ──────────────────────────────────────────────────────────
const TRANSIT_ORB: Record<string, number> = {
  conjunction: 8, opposition: 8, trine: 7, square: 7, sextile: 5, quincunx: 3,
};
const TONE_WORD = { h: "harmony", t: "tension", n: "neutral" } as const;

const ASPECT_TYPES = CANONICAL_ASPECTS.map((a) => ({
  name:   a.type,
  nameFr: a.nameFr,
  symbol: a.symbol,
  angle:  a.angle,
  orbMax: TRANSIT_ORB[a.type] ?? a.orb,
  tone:   TONE_WORD[a.tone],
}));

// Planètes pondérées (lentes = plus importantes en transit)
const PLANET_WEIGHT: Record<string, number> = {
  sun: 8, moon: 4, mercury: 3, venus: 3, mars: 5,
  jupiter: 8, saturn: 10, uranus: 9, neptune: 9, pluto: 10,
};

// ──────────────────────────────────────────────────────────
// Calcul des aspects transit → natal
// ──────────────────────────────────────────────────────────
export function computeTransitAspects(
  transits: Record<string, PlanetPosition>,
  natal:    Record<string, PlanetPosition>,
): TransitAspect[] {
  const aspects: TransitAspect[] = [];

  for (const [tKey, tP] of Object.entries(transits)) {
    if (!tP || typeof tP.longitude !== "number") continue;

    for (const [nKey, nP] of Object.entries(natal)) {
      if (!nP || typeof nP.longitude !== "number") continue;

      const diff  = Math.abs(tP.longitude - nP.longitude);
      const angle = Math.min(diff, 360 - diff);

      for (const type of ASPECT_TYPES) {
        const orb = Math.abs(angle - type.angle);
        if (orb <= type.orbMax) {
          const weight   = (PLANET_WEIGHT[tKey] ?? 2) + (PLANET_WEIGHT[nKey] ?? 2);
          const priority = weight - orb * 1.5; // orbe serré = prioritaire

          aspects.push({
            transitPlanet: tKey,
            natalPlanet:   nKey,
            type:          type.name,
            typeFr:        type.nameFr,
            symbol:        type.symbol,
            angle:         type.angle,
            orb:           Math.round(orb * 100) / 100,
            exact:         orb < 1,
            tight:         orb < 3,
            tone:          type.tone,
            priority:      Math.round(priority * 100) / 100,
          });
          break;
        }
      }
    }
  }

  return aspects.sort((a, b) => b.priority - a.priority);
}

// ──────────────────────────────────────────────────────────
// Dans quelle maison natale se trouve chaque planète en transit
// ──────────────────────────────────────────────────────────
export function computeHouseActivations(
  transits:    Record<string, PlanetPosition>,
  natalHouses: NatalHouse[] | undefined,
): Record<number, string[]> {
  const activations: Record<number, string[]> = {};

  if (!natalHouses || natalHouses.length < 12) return activations;

  for (const [pKey, p] of Object.entries(transits)) {
    if (!p || typeof p.longitude !== "number") continue;

    for (let i = 0; i < 12; i++) {
      const startLon = natalHouses[i]!.longitude;
      const endLon   = natalHouses[(i + 1) % 12]!.longitude;

      const inHouse = (startLon < endLon)
        ? (p.longitude >= startLon && p.longitude < endLon)
        : (p.longitude >= startLon || p.longitude < endLon);

      if (inHouse) {
        const houseNum = i + 1;
        if (!activations[houseNum]) activations[houseNum] = [];
        activations[houseNum].push(pKey);
        break;
      }
    }
  }

  return activations;
}

// ──────────────────────────────────────────────────────────
// Génération d'alertes
// ──────────────────────────────────────────────────────────
const PLANET_NAMES_FR: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturne",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
};

const PLANET_NAMES_EN: Record<string, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturn",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
};

// Explications courtes par type d'aspect, indexées sur le `type` anglais
// utilisé par TransitAspect (cf. ASPECT_TYPES canoniques). Phrases délibérément
// génériques (par type, pas par couple de planètes) — accessibles à un user
// non-initié sans coûter un appel LLM par alerte.
const ASPECT_EXPLAIN_FR: Record<string, string> = {
  conjunction: "fusion des deux énergies, intensité concentrée",
  opposition:  "deux pôles à équilibrer — l'autre vous renvoie au vôtre",
  trine:       "circulation fluide entre les deux planètes, sans effort",
  square:      "friction qui pousse à l'action, inconfort productif",
  sextile:     "possibilité d'harmonie, demande un petit geste pour s'activer",
  quincunx:    "ajustement subtil, deux registres qui peinent à se parler",
};
const ASPECT_EXPLAIN_EN: Record<string, string> = {
  conjunction: "two energies merging, concentrated intensity",
  opposition:  "two poles to balance — the other reflects your own",
  trine:       "smooth flow between the two planets, no effort needed",
  square:      "friction that prompts action, productive discomfort",
  sextile:     "potential harmony, takes a small move to activate",
  quincunx:    "subtle adjustment, two registers struggling to converse",
};

const RETRO_EXPLAIN_FR: Record<string, string> = {
  mercury: "période de relecture — revoyez échanges et décisions avant de signer",
  venus:   "réévaluation des liens et de ce que vous valorisez vraiment",
  mars:    "énergie tournée vers l'intérieur — revoir plutôt que lancer",
  jupiter: "expansion à recentrer, convictions à interroger en interne",
  saturn:  "introspection sur les structures, engagements et responsabilités",
};
const RETRO_EXPLAIN_EN: Record<string, string> = {
  mercury: "review phase — revisit exchanges and decisions before signing",
  venus:   "reassess your bonds and what you genuinely value",
  mars:    "energy turned inward — revise rather than launch",
  jupiter: "expansion to recenter, beliefs to question internally",
  saturn:  "introspection on structures, commitments, and responsibilities",
};

export interface Alert {
  text:         string;
  explanation:  string;
  tone?:        "harmony" | "tension" | "neutral";
}

export function generateAlerts(
  aspects:  TransitAspect[],
  transits: Record<string, PlanetPosition>,
  locale:   string = "fr",
): Alert[] {
  const alerts: Alert[] = [];
  const names = locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR;
  const aspectExplain = locale === "en" ? ASPECT_EXPLAIN_EN : ASPECT_EXPLAIN_FR;
  const retroExplain  = locale === "en" ? RETRO_EXPLAIN_EN  : RETRO_EXPLAIN_FR;

  // Aspects exacts (orbe < 1°), trié par priorité — top 3
  const exactAspects = aspects.filter(a => a.exact).slice(0, 3);
  for (const asp of exactAspects) {
    const icon = asp.tone === "harmony" ? "✧" : asp.tone === "tension" ? "⚡" : "◉";
    const tName = names[asp.transitPlanet] ?? asp.transitPlanet;
    const nName = names[asp.natalPlanet]   ?? asp.natalPlanet;

    const text = locale === "fr"
      ? `${icon} ${tName} ${asp.typeFr.toLowerCase()} ${nName} natal — exact aujourd'hui`
      : `${icon} Transit ${tName} ${asp.type} Natal ${nName} — exact today`;
    const explanation = aspectExplain[asp.type] ?? "";

    alerts.push({ text, explanation, tone: asp.tone });
  }

  // Rétrogrades marquants (planètes personnelles et sociales)
  const significantRetro = ["mercury", "venus", "mars", "jupiter", "saturn"];
  for (const key of significantRetro) {
    const p = transits[key];
    if (p?.retrograde) {
      const name = names[key] ?? key;
      const text = locale === "fr" ? `⟲ ${name} rétrograde` : `⟲ ${name} retrograde`;
      const explanation = retroExplain[key] ?? "";
      alerts.push({ text, explanation, tone: "neutral" });
    }
  }

  return alerts.slice(0, 6);
}

// ──────────────────────────────────────────────────────────
// Helpers publics
// ──────────────────────────────────────────────────────────
export const planetDisplayName = (key: string, locale: string = "fr") =>
  (locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR)[key.toLowerCase()] ?? key;

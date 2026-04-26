// ============================================================
// TRANSITS SERVICE
// Calcul des aspects, activations de maisons, alertes
// ============================================================

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
// ──────────────────────────────────────────────────────────
const ASPECT_TYPES = [
  { name: "conjunction", nameFr: "Conjonction", symbol: "☌", angle: 0,   orbMax: 8,  tone: "neutral" as const },
  { name: "opposition",  nameFr: "Opposition",  symbol: "☍", angle: 180, orbMax: 8,  tone: "tension" as const },
  { name: "trine",       nameFr: "Trigone",     symbol: "△", angle: 120, orbMax: 7,  tone: "harmony" as const },
  { name: "square",      nameFr: "Carré",       symbol: "□", angle: 90,  orbMax: 7,  tone: "tension" as const },
  { name: "sextile",     nameFr: "Sextile",     symbol: "⚹", angle: 60,  orbMax: 5,  tone: "harmony" as const },
];

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

export function generateAlerts(
  aspects:  TransitAspect[],
  transits: Record<string, PlanetPosition>,
  locale:   string = "fr",
): string[] {
  const alerts: string[] = [];
  const names = locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR;

  // Aspects exacts (orbe < 1°), trié par priorité — top 3
  const exactAspects = aspects.filter(a => a.exact).slice(0, 3);
  for (const asp of exactAspects) {
    const icon = asp.tone === "harmony" ? "✧" : asp.tone === "tension" ? "⚡" : "◉";
    const tName = names[asp.transitPlanet] ?? asp.transitPlanet;
    const nName = names[asp.natalPlanet]   ?? asp.natalPlanet;

    if (locale === "fr") {
      alerts.push(`${icon} ${tName} ${asp.typeFr.toLowerCase()} ${nName} natal — exact aujourd'hui`);
    } else {
      alerts.push(`${icon} Transit ${tName} ${asp.type} Natal ${nName} — exact today`);
    }
  }

  // Rétrogrades marquants (planètes personnelles et sociales)
  const significantRetro = ["mercury", "venus", "mars", "jupiter", "saturn"];
  for (const key of significantRetro) {
    const p = transits[key];
    if (p?.retrograde) {
      const name = names[key] ?? key;
      if (locale === "fr") alerts.push(`⟲ ${name} rétrograde`);
      else                 alerts.push(`⟲ ${name} retrograde`);
    }
  }

  return alerts.slice(0, 6);
}

// ──────────────────────────────────────────────────────────
// Helpers publics
// ──────────────────────────────────────────────────────────
export const planetDisplayName = (key: string, locale: string = "fr") =>
  (locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR)[key.toLowerCase()] ?? key;

// ============================================================
// cities.ts
// ------------------------------------------------------------
// Base de villes avec timezone IANA (plus d'offset "statique").
// Plus de fallback Paris : une ville inconnue → erreur explicite.
// ============================================================

export interface CityCoords {
  /** Latitude en degrés décimaux (nord positif). */
  lat: number;
  /** Longitude en degrés décimaux (est positif). */
  lng: number;
  /** Identifiant IANA (ex. "Europe/Paris"). Jamais un offset numérique. */
  ianaTz: string;
}

export class CityNotFoundError extends Error {
  constructor(public readonly query: string, public readonly suggestions: string[] = []) {
    super(
      suggestions.length > 0
        ? `City "${query}" not found. Did you mean: ${suggestions.join(", ")}?`
        : `City "${query}" not found.`,
    );
    this.name = "CityNotFoundError";
  }
}

// ──────────────────────────────────────────────────────────
// Tableau normalisé
// On normalise les noms (trim, lowercase, accents simplifiés)
// au moment du lookup pour tolérer les variantes utilisateur.
// ──────────────────────────────────────────────────────────

export const CITIES: Record<string, CityCoords> = {
  // France métropolitaine
  "Paris": { lat: 48.857, lng: 2.352, ianaTz: "Europe/Paris" },
  "Lyon": { lat: 45.764, lng: 4.836, ianaTz: "Europe/Paris" },
  "Marseille": { lat: 43.297, lng: 5.37, ianaTz: "Europe/Paris" },
  "Toulouse": { lat: 43.605, lng: 1.444, ianaTz: "Europe/Paris" },
  "Nice": { lat: 43.71, lng: 7.262, ianaTz: "Europe/Paris" },
  "Bordeaux": { lat: 44.838, lng: -0.579, ianaTz: "Europe/Paris" },
  "Lille": { lat: 50.633, lng: 3.058, ianaTz: "Europe/Paris" },
  "Strasbourg": { lat: 48.573, lng: 7.752, ianaTz: "Europe/Paris" },
  "Nantes": { lat: 47.218, lng: -1.554, ianaTz: "Europe/Paris" },
  "Rennes": { lat: 48.117, lng: -1.678, ianaTz: "Europe/Paris" },
  "Montpellier": { lat: 43.611, lng: 3.877, ianaTz: "Europe/Paris" },
  "Grenoble": { lat: 45.189, lng: 5.724, ianaTz: "Europe/Paris" },
  "Rouen": { lat: 49.443, lng: 1.1, ianaTz: "Europe/Paris" },
  "Toulon": { lat: 43.124, lng: 5.928, ianaTz: "Europe/Paris" },
  "Reims": { lat: 49.253, lng: 3.993, ianaTz: "Europe/Paris" },
  "Dijon": { lat: 47.322, lng: 5.041, ianaTz: "Europe/Paris" },
  "Angers": { lat: 47.473, lng: -0.556, ianaTz: "Europe/Paris" },
  "Brest": { lat: 48.39, lng: -4.486, ianaTz: "Europe/Paris" },
  "Metz": { lat: 49.12, lng: 6.176, ianaTz: "Europe/Paris" },
  "Tours": { lat: 47.394, lng: 0.685, ianaTz: "Europe/Paris" },
  "Le Havre": { lat: 49.494, lng: 0.108, ianaTz: "Europe/Paris" },
  "Clermont-Ferrand": { lat: 45.783, lng: 3.082, ianaTz: "Europe/Paris" },
  "Saint-Étienne": { lat: 45.434, lng: 4.39, ianaTz: "Europe/Paris" },
  "Nancy": { lat: 48.693, lng: 6.184, ianaTz: "Europe/Paris" },
  "Ajaccio": { lat: 41.927, lng: 8.737, ianaTz: "Europe/Paris" },
  "Bastia": { lat: 42.698, lng: 9.451, ianaTz: "Europe/Paris" },

  // DOM-TOM : fuseaux distincts, règles DST différentes
  "Cayenne": { lat: 4.933, lng: -52.327, ianaTz: "America/Cayenne" },
  "Fort-de-France": { lat: 14.616, lng: -61.058, ianaTz: "America/Martinique" },
  "Pointe-à-Pitre": { lat: 16.241, lng: -61.533, ianaTz: "America/Guadeloupe" },
  "Mamoudzou": { lat: -12.78, lng: 45.228, ianaTz: "Indian/Mayotte" },
  "Saint-Denis (974)": { lat: -20.882, lng: 55.451, ianaTz: "Indian/Reunion" },
  "Nouméa": { lat: -22.275, lng: 166.458, ianaTz: "Pacific/Noumea" },
  "Papeete": { lat: -17.551, lng: -149.558, ianaTz: "Pacific/Tahiti" },
  "Saint-Pierre (975)": { lat: 46.779, lng: -56.177, ianaTz: "America/Miquelon" },

  // Europe voisine
  "Bruxelles": { lat: 50.85, lng: 4.352, ianaTz: "Europe/Brussels" },
  "Genève": { lat: 46.204, lng: 6.143, ianaTz: "Europe/Zurich" },
  "Luxembourg": { lat: 49.612, lng: 6.13, ianaTz: "Europe/Luxembourg" },
  "Monaco": { lat: 43.731, lng: 7.42, ianaTz: "Europe/Monaco" },
  "Londres": { lat: 51.507, lng: -0.128, ianaTz: "Europe/London" },
  "London": { lat: 51.507, lng: -0.128, ianaTz: "Europe/London" },
  "Berlin": { lat: 52.52, lng: 13.405, ianaTz: "Europe/Berlin" },
  "Madrid": { lat: 40.417, lng: -3.704, ianaTz: "Europe/Madrid" },
  "Rome": { lat: 41.902, lng: 12.496, ianaTz: "Europe/Rome" },
  "Lisbonne": { lat: 38.722, lng: -9.139, ianaTz: "Europe/Lisbon" },
  "Amsterdam": { lat: 52.370, lng: 4.895, ianaTz: "Europe/Amsterdam" },
  "Vienne (AT)": { lat: 48.208, lng: 16.373, ianaTz: "Europe/Vienna" },
  "Athènes": { lat: 37.984, lng: 23.728, ianaTz: "Europe/Athens" },

  // Amériques
  "Montréal": { lat: 45.502, lng: -73.567, ianaTz: "America/Toronto" },
  "Québec": { lat: 46.813, lng: -71.208, ianaTz: "America/Toronto" },
  "New York": { lat: 40.713, lng: -74.006, ianaTz: "America/New_York" },
  "Los Angeles": { lat: 34.052, lng: -118.244, ianaTz: "America/Los_Angeles" },
  "São Paulo": { lat: -23.55, lng: -46.633, ianaTz: "America/Sao_Paulo" },
  "Mexico": { lat: 19.433, lng: -99.133, ianaTz: "America/Mexico_City" },

  // Afrique
  "Dakar": { lat: 14.692, lng: -17.446, ianaTz: "Africa/Dakar" },
  "Abidjan": { lat: 5.345, lng: -4.024, ianaTz: "Africa/Abidjan" },
  "Casablanca": { lat: 33.573, lng: -7.589, ianaTz: "Africa/Casablanca" },
  "Tunis": { lat: 36.8, lng: 10.18, ianaTz: "Africa/Tunis" },
  "Alger": { lat: 36.753, lng: 3.058, ianaTz: "Africa/Algiers" },

  // Asie / Océanie
  "Tokyo": { lat: 35.6895, lng: 139.6917, ianaTz: "Asia/Tokyo" },
  "Pékin": { lat: 39.9042, lng: 116.4074, ianaTz: "Asia/Shanghai" },
  "Beijing": { lat: 39.9042, lng: 116.4074, ianaTz: "Asia/Shanghai" },
  "Séoul": { lat: 37.5665, lng: 126.978, ianaTz: "Asia/Seoul" },
  "Singapour": { lat: 1.3521, lng: 103.8198, ianaTz: "Asia/Singapore" },
  "Bangkok": { lat: 13.7563, lng: 100.5018, ianaTz: "Asia/Bangkok" },
  "Dubaï": { lat: 25.2048, lng: 55.2708, ianaTz: "Asia/Dubai" },
  "Sydney": { lat: -33.8688, lng: 151.2093, ianaTz: "Australia/Sydney" },
  "Melbourne": { lat: -37.8136, lng: 144.9631, ianaTz: "Australia/Melbourne" },
};

// ──────────────────────────────────────────────────────────
// Normalisation pour tolérer les variantes utilisateur
// (majuscules, accents, espaces, caractères unicode exotiques)
// ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques
    .replace(/[\s-]+/g, " ");
}

const NORMALIZED_INDEX: Map<string, string> = new Map();
for (const key of Object.keys(CITIES)) {
  NORMALIZED_INDEX.set(normalize(key), key);
}

/**
 * Retourne les coordonnées + IANA tz pour une ville connue.
 *
 * **Ne fait plus de fallback Paris.** Lève `CityNotFoundError` si
 * le nom n'est pas dans la base. Les appelants doivent gérer
 * l'erreur (400 côté route API, message explicite côté UI).
 */
export function getCity(name: string): CityCoords {
  const coords = CITIES[name];
  if (coords) return coords;

  const norm = normalize(name);
  const hit = NORMALIZED_INDEX.get(norm);
  if (hit) return CITIES[hit]!;

  // Suggestions simples par distance de Levenshtein (top 3).
  const suggestions = suggestCities(name, 3);
  throw new CityNotFoundError(name, suggestions);
}

/**
 * Vérifie qu'une ville existe sans lever d'exception.
 * Utile pour les routes de validation (autocomplete).
 */
export function hasCity(name: string): boolean {
  try {
    getCity(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retourne les N noms de villes les plus proches (Levenshtein).
 * Bien pour l'autocomplete / les messages d'erreur.
 */
export function suggestCities(query: string, limit = 5): string[] {
  const q = normalize(query);
  if (!q) return [];

  const ranked = Object.keys(CITIES)
    .map((name) => ({ name, d: levenshtein(q, normalize(name)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((r) => r.name);

  return ranked;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur.push(Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost));
    }
    for (let k = 0; k < cur.length; k++) prev[k] = cur[k]!;
  }
  return prev[b.length]!;
}

/** Liste triée, utilisable pour un `<datalist>` ou un dropdown. */
export const CITY_NAMES: string[] = Object.keys(CITIES).sort((a, b) =>
  a.localeCompare(b, "fr", { sensitivity: "base" }),
);

// ============================================================
// types.ts
// ------------------------------------------------------------
// EPHEMERIS-DEEP-CONSOLIDATION-V1
// Types partagés du package @astro-platform/ephemeris.
//
// Avant cette archive, CityCoords + CityNotFoundError étaient
// définis dans cities.ts (supprimé). Pour ne pas casser les
// callers qui catchent CityNotFoundError ou typent CityCoords,
// on les déplace ici (re-exportés via index.ts).
// ============================================================

// ──────────────────────────────────────────────────────────
// Coordonnées + timezone d'une ville
// ──────────────────────────────────────────────────────────

export interface CityCoords {
  /** Latitude en degrés décimaux (nord positif). */
  lat: number;
  /** Longitude en degrés décimaux (est positif). */
  lng: number;
  /** Identifiant IANA (ex. "Europe/Paris"). Jamais un offset numérique. */
  ianaTz: string;
}

// ──────────────────────────────────────────────────────────
// Erreur explicite : ville inconnue
// ──────────────────────────────────────────────────────────

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
// Resolver injectable : fonction de lookup ville → coords
// ──────────────────────────────────────────────────────────
//
// Le service ephemeris ne connaît plus de villes hardcodées.
// L'application qui l'utilise lui injecte un resolver au boot
// via ephemerisService.setCityResolver().
//
// Le resolver peut être sync ou async. Doit retourner null si
// la ville n'est pas trouvée (le service throw CityNotFoundError
// pour le caller).

export type CityResolver =
  | ((name: string) => Promise<CityCoords | null>)
  | ((name: string) => CityCoords | null);

// EPHEMERIS-DEEP-CONSOLIDATION-V1 applied

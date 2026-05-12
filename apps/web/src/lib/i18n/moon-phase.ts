// ============================================================
// apps/web/src/lib/i18n/moon-phase.ts
// ------------------------------------------------------------
// Localisation des phases lunaires côté client.
//
// L'API ephemeris retourne `moonPhase: { key, phase, description, ... }`
// où `key` est locale-agnostic (ex: "moon_wanc") et `phase`/`description`
// sont en FR (les engines astro-engine.ts et swiss-engine.ts portent
// les strings FR pour ne pas multiplier les paramètres locale dans la
// chaîne de calcul).
//
// Ce helper mappe `key` → `{ phase, description }` dans la langue
// demandée. À utiliser comme :
//
//   const m = getLocalizedMoonPhase(moon.key, lang);
//   <span>{m?.phase ?? moon.phase}</span>
//
// Le fallback `?? moon.phase` couvre les cas où le backend retourne
// une clé inattendue (forward-compat sur de nouvelles clés à venir).
// ============================================================

export type MoonPhaseKey =
  | "moon_new"
  | "moon_waxc"
  | "moon_firstq"
  | "moon_waxg"
  | "moon_full"
  | "moon_wang"
  | "moon_lastq"
  | "moon_wanc";

interface MoonPhaseLabel {
  phase:       string;
  description: string;
}

const FR: Record<MoonPhaseKey, MoonPhaseLabel> = {
  moon_new:    { phase: "Nouvelle Lune",         description: "Temps des semences et des intentions nouvelles" },
  moon_waxc:   { phase: "Premier croissant",     description: "Croissance, construction, prise d'élan" },
  moon_firstq: { phase: "Premier quartier",      description: "Décisions, action, dépassement des obstacles" },
  moon_waxg:   { phase: "Gibbeuse croissante",   description: "Perfectionnement, ajustements, persévérance" },
  moon_full:   { phase: "Pleine Lune",           description: "Culmination, révélation, intensité émotionnelle" },
  moon_wang:   { phase: "Gibbeuse décroissante", description: "Gratitude, partage, diffusion" },
  moon_lastq:  { phase: "Dernier quartier",      description: "Lâcher-prise, révisions, ajustements" },
  moon_wanc:   { phase: "Dernier croissant",     description: "Repos, introspection, purification" },
};

const EN: Record<MoonPhaseKey, MoonPhaseLabel> = {
  moon_new:    { phase: "New Moon",         description: "A time for sowing seeds and new intentions" },
  moon_waxc:   { phase: "Waxing Crescent",  description: "Growth, building, gaining momentum" },
  moon_firstq: { phase: "First Quarter",    description: "Decisions, action, overcoming obstacles" },
  moon_waxg:   { phase: "Waxing Gibbous",   description: "Refinement, adjustments, perseverance" },
  moon_full:   { phase: "Full Moon",        description: "Culmination, revelation, emotional intensity" },
  moon_wang:   { phase: "Waning Gibbous",   description: "Gratitude, sharing, diffusion" },
  moon_lastq:  { phase: "Last Quarter",     description: "Letting go, revisions, adjustments" },
  moon_wanc:   { phase: "Waning Crescent",  description: "Rest, introspection, purification" },
};

/**
 * Retourne le label localisé d'une phase lunaire, ou `null` si la clé
 * n'est pas reconnue (forward-compat). Les consumers doivent fallback
 * sur les champs `phase` / `description` bruts du payload API dans ce cas.
 */
export function getLocalizedMoonPhase(
  key:  string | null | undefined,
  lang: "fr" | "en",
): MoonPhaseLabel | null {
  if (!key) return null;
  const table = lang === "en" ? EN : FR;
  return table[key as MoonPhaseKey] ?? null;
}

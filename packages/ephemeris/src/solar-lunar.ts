// ============================================================
// solar-lunar.ts — Soleil (Meeus ch.25) et Lune (série de Brown)
// ------------------------------------------------------------
// ASTRO-ENGINE-SPLIT-V1 : extrait de astro-engine.ts (déplacement
// pur, zéro changement de logique). Longitudes géocentriques du
// Soleil et de la Lune, nœud lunaire moyen, latitude lunaire et
// phase lunaire.
// ============================================================

import { R, n360, nutLon } from "./engine-core.js";

// ──────────────────────────────────────────────────────────
// Longitudes géocentriques Soleil + Lune
// ──────────────────────────────────────────────────────────
export interface SunGeo { lon: number; r: number; }

/** Soleil : Meeus ch.25 avec excentricité variable + nutation. */
export function sunGeo(T: number): SunGeo {
  const L0 = n360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M  = n360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mr = M * R;
  const e  = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
           + (0.019993 - 0.000101 * T)                  * Math.sin(2 * Mr)
           +  0.000289                                    * Math.sin(3 * Mr);
  const lon = n360(L0 + C + nutLon(T) - 0.005694);       // aberration
  const r   = 1.000001018 * (1 - e * e) / (1 + e * Math.cos(Mr + C * R));
  return { lon, r };
}

/** Lune : série principale de Brown (précision ~0.3°). */
export function moonGeo(T: number): number {
  const Lp = n360(218.3165 + 481267.8813 * T + nutLon(T));
  const D  = (297.8502 + 445267.1115 * T) * R;
  const M  = (357.5291 +  35999.0503 * T) * R;
  const Mp = (134.9634 + 477198.8676 * T) * R;
  const F  = ( 93.272  + 483202.0175 * T) * R;
  return n360(
      Lp
    + 6.289 * Math.sin(Mp)
    + 1.274 * Math.sin(2 * D - Mp)
    + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mp)
    - 0.186 * Math.sin(M)
    - 0.114 * Math.sin(2 * F)
    + 0.059 * Math.sin(2 * D - 2 * Mp)
    + 0.057 * Math.sin(2 * D - M - Mp)
    + 0.053 * Math.sin(2 * D + Mp)
    + 0.046 * Math.sin(2 * D - M)
    - 0.041 * Math.sin(M - Mp)
    - 0.035 * Math.sin(D)
    - 0.030 * Math.sin(M + Mp)
    + 0.015 * Math.sin(2 * D - 2 * F)
  );
}

/** Nœud lunaire moyen. */
export function lunarNode(T: number): number {
  return n360(125.0446 - 1934.1363 * T + 0.0021 * T * T);
}

/**
 * ASTROCARTOGRAPHY-V1 — Latitude écliptique géocentrique de la Lune (degrés).
 * Termes principaux de la série de Meeus (ch.47). Précision ~0.01–0.05°,
 * largement suffisante pour l'astrocartographie (la latitude lunaire
 * atteint ±5,1° et décale sensiblement sa déclinaison — on ne peut pas
 * la prendre à 0 comme pour le Soleil).
 */
export function moonLat(T: number): number {
  const F  = (93.2721  + 483202.0175 * T) * R; // argument de latitude
  const Mp = (134.9634 + 477198.8676 * T) * R; // anomalie moyenne Lune
  const D  = (297.8502 + 445267.1115 * T) * R; // élongation
  const M  = (357.5291 +  35999.0503 * T) * R; // anomalie moyenne Soleil
  return (
      5.128189 * Math.sin(F)
    + 0.280606 * Math.sin(Mp + F)
    + 0.277693 * Math.sin(Mp - F)
    + 0.173238 * Math.sin(2 * D - F)
    + 0.055413 * Math.sin(2 * D + F - Mp)
    + 0.046272 * Math.sin(2 * D - F - Mp)
    + 0.032573 * Math.sin(2 * D + F)
    + 0.017198 * Math.sin(2 * Mp + F)
    + 0.009267 * Math.sin(2 * D + Mp - F)
    + 0.008823 * Math.sin(2 * Mp - F)
    + 0.008247 * Math.sin(2 * D - M - F)
  );
}

// ──────────────────────────────────────────────────────────
// Phase lunaire
// ──────────────────────────────────────────────────────────
export interface MoonPhase {
  phase:       string;
  emoji:       string;
  illumination: number;
  description: string;
  key: string;
}

const MOON_PHASES_FR: Record<string, { phase: string; description: string }> = {
  moon_new:     { phase: "Nouvelle Lune",      description: "Temps des semences et des intentions nouvelles" },
  moon_waxc:    { phase: "Premier croissant",  description: "Croissance, construction, prise d'élan" },
  moon_firstq:  { phase: "Premier quartier",   description: "Décisions, action, dépassement des obstacles" },
  moon_waxg:    { phase: "Gibbeuse croissante", description: "Perfectionnement, ajustements, persévérance" },
  moon_full:    { phase: "Pleine Lune",        description: "Culmination, révélation, intensité émotionnelle" },
  moon_wang:    { phase: "Gibbeuse décroissante", description: "Gratitude, partage, diffusion" },
  moon_lastq:   { phase: "Dernier quartier",   description: "Lâcher-prise, révisions, ajustements" },
  moon_wanc:    { phase: "Dernier croissant",  description: "Repos, introspection, purification" },
};

export function moonPhase(JD: number): MoonPhase {
  const T  = (JD - 2451545) / 36525;
  const sl = sunGeo(T).lon;
  const ml = moonGeo(T);
  const el = n360(ml - sl);

  let k: string, emoji: string;
  if      (el <  11.25) { k = "moon_new";    emoji = "🌑"; }
  else if (el <  78.75) { k = "moon_waxc";   emoji = "🌒"; }
  else if (el < 101.25) { k = "moon_firstq"; emoji = "🌓"; }
  else if (el < 168.75) { k = "moon_waxg";   emoji = "🌔"; }
  else if (el < 191.25) { k = "moon_full";   emoji = "🌕"; }
  else if (el < 258.75) { k = "moon_wang";   emoji = "🌖"; }
  else if (el < 281.25) { k = "moon_lastq";  emoji = "🌗"; }
  else if (el < 348.75) { k = "moon_wanc";   emoji = "🌘"; }
  else                  { k = "moon_new";    emoji = "🌑"; }

  const info = MOON_PHASES_FR[k]!;
  // illumination approximative : (1 - cos(el)) / 2
  const illumination = (1 - Math.cos(el * R)) / 2;

  return {
    key: k,
    phase: info.phase,
    emoji,
    illumination: Math.round(illumination * 100) / 100,
    description: info.description,
  };
}

// ASTRO-ENGINE-SPLIT-V1 applied

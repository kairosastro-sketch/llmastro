// ============================================================
// horizons-benchmark.test.ts — HORIZONS-BENCHMARK-V1
// ------------------------------------------------------------
// Benchmark de précision : moteur Swiss (mode Moshier, chemin de
// prod `allPositionsSwiss`) vs JPL Horizons, sur 4 dates couvrant
// 1900 → 2025. Documente et verrouille la revendication :
//
//      ÉCART < 1″ EN LONGITUDE GÉOCENTRIQUE APPARENTE
//
// Écarts MESURÉS à la création du benchmark (swisseph 0.5.17,
// mode SEFLG_MOSEPH, conteneur API de prod, 2026-06-10) — max
// |Δlon| par corps sur les 4 dates :
//
//   sun 0.24″ · moon 0.42″ · mercury 0.26″ · venus 0.28″
//   mars 0.24″ · jupiter 0.38″ · saturn 0.25″ · uranus 0.18″
//   neptune 0.38″ · pluto 0.40″
//
// → pire cas 0.42″ (Lune, 2025) : la tolérance de 1.0″ laisse une
// marge ×2.4. Les latitudes mesurées sont ≤ 0.57″ mais ne sont pas
// assertées ici : le chemin de prod (PlanetPosition) n'expose pas
// la latitude écliptique.
//
// Provenance des références (NE PAS recopier à la main — régénérer
// via `node scripts/fetch-horizons-fixtures.mjs`) :
//
//   API     : https://ssd.jpl.nasa.gov/api/horizons.api
//   Réglages: EPHEM_TYPE=OBSERVER, CENTER='500@399' (géocentre),
//             QUANTITIES='31' (ObsEcLon/ObsEcLat), TLIST en JD UT
//   Récupéré: 2026-06-10
//
// La quantité 31 d'Horizons est « Observer-centered IAU76/80
// ecliptic-of-date longitude … of the target centers' APPARENT
// position, with light-time, gravitational deflection of light,
// and stellar aberrations » — soit exactement les conventions de
// swe_calc_ut par défaut (position apparente géocentrique,
// écliptique/équinoxe vraies de la date, heures UT). Corps
// Mars→Pluton : barycentres Horizons ('4'…'9'), comme les
// éphémérides DE qui sous-tendent swisseph (écart angulaire
// centre↔barycentre ≤ 0.1″ vu de la Terre).
//
// Sources d'écart résiduel attendues (toutes ≪ 1″) : qualité du
// fit analytique Moshier vs intégration DE441, ΔT (UTC vs UT1,
// sensible surtout pour la Lune : 0.55″/s), nutation IAU1980 vs
// modèles plus récents, biais de repère FK5/ICRS.
//
// Ces tests s'exécutent partout où swisseph est chargeable ; en CI
// c'est GARANTI par EXPECT-SWISSEPH-V1 (le skip silencieux du
// moteur principal fait échouer le job Tests).
// ============================================================

import { describe, test, expect } from "vitest";
import { ensureSwissephLoaded, allPositionsSwiss } from "../src/swiss-engine.js";

// EXPECT-SWISSEPH-V1 : chargement au niveau module — test.runIf()
// est évalué à la collecte, avant tout hook.
const swissephAvailable = ensureSwissephLoaded();

/** Tolérance assertée (la revendication documentée). */
const TOL_ARCSEC = 1.0;

interface HorizonsCase {
  jd: number;                    // JD UT
  label: string;
  lon: Record<string, number>;   // longitudes écliptiques apparentes Horizons (degrés)
}

const HORIZONS_CASES: HorizonsCase[] = [
  {
    jd: 2415020.5,
    label: "1900-01-01 00:00 UT",
    lon: {
      sun     : 280.1532941,
      moon    : 272.4162663,
      mercury : 258.9977026,
      venus   : 306.3743725,
      mars    : 283.8676754,
      jupiter : 241.1358781,
      saturn  : 267.7167412,
      uranus  : 250.1392472,
      neptune : 85.2186473,
      pluto   : 75.2513856,
    },
  },
  {
    jd: 2440587.5,
    label: "1970-01-01 00:00 UT",
    lon: {
      sun     : 280.1562711,
      moon    : 190.6990372,
      mercury : 299.0214552,
      venus   : 274.4532541,
      mars    : 342.2362370,
      jupiter : 212.3250073,
      saturn  : 32.0622976,
      uranus  : 188.7206176,
      neptune : 239.8858523,
      pluto   : 177.3921581,
    },
  },
  {
    jd: 2451545.0,
    label: "2000-01-01 12:00 UT (J2000)",
    lon: {
      sun     : 280.3689092,
      moon    : 223.3237860,
      mercury : 271.8892699,
      venus   : 241.5657794,
      mars    : 327.9632921,
      jupiter : 25.2530736,
      saturn  : 40.3956492,
      uranus  : 314.8091744,
      neptune : 303.1929999,
      pluto   : 251.4547643,
    },
  },
  {
    jd: 2460676.5,
    label: "2025-01-01 00:00 UT",
    lon: {
      sun     : 280.8136000,
      moon    : 293.9135958,
      mercury : 259.8699677,
      venus   : 327.7120986,
      mars    : 121.9179094,
      jupiter : 73.2154473,
      saturn  : 344.5240576,
      uranus  : 53.6358146,
      neptune : 357.2978093,
      pluto   : 301.0647982,
    },
  },
];

/** Plus petit écart angulaire entre deux longitudes 0–360, en secondes d'arc. */
function deltaArcsec(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return (d > 180 ? 360 - d : d) * 3600;
}

describe("HORIZONS-BENCHMARK-V1 — Swiss/Moshier vs JPL Horizons (< 1″)", () => {
  for (const c of HORIZONS_CASES) {
    describe(c.label, () => {
      for (const [body, refLon] of Object.entries(c.lon)) {
        test.runIf(swissephAvailable)(
          `${body} à < ${TOL_ARCSEC}″ d'Horizons (${refLon.toFixed(4)}°)`,
          () => {
            const positions = allPositionsSwiss(c.jd);
            const p = positions[body];
            expect(p).toBeDefined();
            const delta = deltaArcsec(p!.longitude, refLon);
            expect(
              delta,
              `${body} @ ${c.label} : Swiss=${p!.longitude.toFixed(7)}° vs Horizons=${refLon}° → Δ=${delta.toFixed(3)}″`,
            ).toBeLessThan(TOL_ARCSEC);
          },
        );
      }
    });
  }
});

// HORIZONS-BENCHMARK-V1 applied

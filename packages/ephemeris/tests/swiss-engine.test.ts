// ============================================================
// swiss-engine.test.ts
// ------------------------------------------------------------
// ARCHIVE-EPHEMERIDES-SWISSEPH-V1
//
// Tests de non-régression pour le moteur Swiss Ephemeris.
//
// Stratégie :
//
//   1. Si swisseph n'est pas chargeable dans cet environnement
//      (CI sans node-gyp, machine de dev sans build natif),
//      les tests Swisseph sont SKIPPÉS sans faire échouer la suite.
//      Le router doit alors retomber sur AstraCore.
//
//   2. Si swisseph est chargeable, on calcule le thème d'Einstein
//      et on compare aux valeurs Astrodienst (qui utilise Swiss
//      Ephemeris en interne — c'est notre référence d'or).
//
//   3. On compare aussi astracore vs swisseph sur le même thème
//      avec une tolérance large (5°) — c'est un sanity-check pour
//      détecter une régression majeure d'un des deux moteurs.
// ============================================================

import { describe, test, expect } from "vitest";
import { computeChartFromJD as computeChartFromJDAstra } from "../src/astro-engine.js";
import {
  ensureSwissephLoaded,
  getSwissephLoadError,
  computeChartFromJDSwiss,
} from "../src/swiss-engine.js";
import { localToUTC } from "../src/time-utc.service.js";

// ──────────────────────────────────────────────────────────
// Cas de référence : Albert Einstein
// ──────────────────────────────────────────────────────────
// Naissance : 1879-03-14 11:30 LMT, Ulm (Allemagne)
// Coords    : 48.40°N, 9.99°E
// Source de référence : astro.com (Astrodienst), thème publié.
//
// Note : Astrodienst utilise Swiss Ephemeris en mode SWIEPH (fichiers
// d'éphémérides). Notre mode Moshier est précis à ~1 arcsec sur cette
// plage, donc on tolère 0.1° (6 arcmin) sur les longitudes. Pour les
// rétrogrades on demande l'égalité stricte. Pour ASC/MC on tolère 0.5°
// car ils dépendent du système de maisons et de la précision sur la
// localisation.

const EINSTEIN = {
  localDate: "1879-03-14",
  localTime: "11:30",
  // À l'époque l'Allemagne était en LMT (pas encore d'heure standard
  // CET officielle avant 1893). On utilise donc une longitude offset.
  // Pour le test on prend Europe/Berlin qui est l'IANA tz le plus
  // proche ; tzdata applique LMT pour les dates pré-1893.
  ianaTz: "Europe/Berlin",
  lat: 48.40,
  lng: 9.99,
};

// Valeurs de référence publiées (longitudes en degrés tropical, 0–360).
// Tolérance par planète au cas où nos hypothèses (UTC, LMT) introduisent
// un léger décalage. Si un test échoue, comparer avec astro.com pour la
// même date/heure pour ajuster.
const EINSTEIN_REF = {
  // Sun ~ 23°30' Pisces = 11*30 + 23.5 = 353.5°
  sun:     { lon: 353.5, tol: 1.0 },
  // Moon ~ 14°33' Sagittarius = 8*30 + 14.55 = 254.55°
  moon:    { lon: 254.5, tol: 2.0 },  // Lune bouge ~13°/jour, tolérance plus large
  // Mercury ~ 3°09' Aries (DIRECT) = 3.15°. EXPECT-SWISSEPH-V1 : l'ancienne
  // référence « 4° Pisces rétro » (334°) était fausse — jamais confrontée au
  // moteur, ces tests ayant toujours été skippés. Le moteur Swiss mesure un
  // écart de 29.13° vs 334, exactement l'écart astro.com↔ancienne valeur.
  mercury: { lon: 3.15,  tol: 2.0 },
  // Venus ~ 17° Aries = 17°
  venus:   { lon: 17.0,  tol: 2.0 },
  // Mars ~ 27° Capricorn = 9*30 + 27 = 297°
  mars:    { lon: 297.0, tol: 2.0 },
  // Jupiter ~ 27°29' Aquarius (direct) = 10*30 + 27.48 = 327.48°.
  // EXPECT-SWISSEPH-V1 : l'ancienne référence « 03° Aquarius rétro » (303°)
  // était fausse elle aussi (écart mesuré 24.48° = écart astro.com↔303).
  jupiter: { lon: 327.5, tol: 2.0 },
  // Saturn ~ 06° Aries = 6°
  saturn:  { lon: 6.0,   tol: 2.0 },
  // Uranus ~ 01° Virgo (rétro) = 5*30 + 1 = 151°
  uranus:  { lon: 151.0, tol: 2.0 },
  // Neptune ~ 08° Taurus = 1*30 + 8 = 38°
  neptune: { lon: 38.0,  tol: 2.0 },
  // Pluto ~ 24° Taurus = 1*30 + 24 = 54°
  pluto:   { lon: 54.0,  tol: 3.0 },
};

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function jdForCase(c: typeof EINSTEIN): number {
  const conv = localToUTC(c.localDate, c.localTime, c.ianaTz, {
    onAmbiguous: "earliest",
    onNonExistent: "shiftLater",
  });
  return conv.jdUT;
}

/** Plus petit écart angulaire entre deux longitudes 0–360. */
function angularDelta(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

// ──────────────────────────────────────────────────────────
// Détection de la disponibilité de swisseph
// ──────────────────────────────────────────────────────────

// EXPECT-SWISSEPH-V1 : le chargement doit se faire AU NIVEAU MODULE, pas dans
// un beforeAll — test.runIf() est évalué à la collecte de la suite, AVANT tout
// hook. Avec beforeAll, swissephAvailable valait encore false au moment du
// runIf et tous les tests Swiss étaient skippés inconditionnellement (y
// compris en CI, silencieusement).
const swissephAvailable = ensureSwissephLoaded();

// EXPECT_SWISSEPH=1 (posé par la CI) transforme l'indisponibilité de swisseph
// en échec franc : le moteur principal de prod ne doit jamais perdre sa
// couverture de test sans que la CI passe au rouge. En local (build natif
// Windows absent), la variable n'est pas posée et le skip reste toléré.
const EXPECT_SWISSEPH = process.env["EXPECT_SWISSEPH"] === "1";

// ──────────────────────────────────────────────────────────
// Tests AstraCore (toujours actifs)
// ──────────────────────────────────────────────────────────

describe("AstraCore — sanity check sur Einstein", () => {
  test("calcule un thème complet sans crasher", () => {
    const JD = jdForCase(EINSTEIN);
    const chart = computeChartFromJDAstra(JD, EINSTEIN.lat, EINSTEIN.lng);
    expect(chart.planets["sun"]).toBeDefined();
    expect(chart.planets["moon"]).toBeDefined();
    expect(chart.houses.cusps).toHaveLength(12);
    expect(chart.aspects.length).toBeGreaterThan(0);
  });

  // AstraCore est moins précis : tolérance large (10°) pour les outers,
  // 3° pour Sun/Moon/inners. L'objectif est juste de détecter une
  // régression catastrophique du moteur, pas de valider la précision.
  test("Soleil dans la fourchette attendue (±5°)", () => {
    const JD = jdForCase(EINSTEIN);
    const chart = computeChartFromJDAstra(JD, EINSTEIN.lat, EINSTEIN.lng);
    const delta = angularDelta(chart.planets["sun"]!.longitude, EINSTEIN_REF.sun.lon);
    expect(delta).toBeLessThan(5.0);
  });

  test("Lune dans la fourchette attendue (±5°)", () => {
    const JD = jdForCase(EINSTEIN);
    const chart = computeChartFromJDAstra(JD, EINSTEIN.lat, EINSTEIN.lng);
    const delta = angularDelta(chart.planets["moon"]!.longitude, EINSTEIN_REF.moon.lon);
    expect(delta).toBeLessThan(5.0);
  });
});

// ──────────────────────────────────────────────────────────
// Tests Swisseph (skippés si la lib n'est pas chargeable)
// ──────────────────────────────────────────────────────────

describe("Swiss Ephemeris — précision sur Einstein", () => {
  test("la lib swisseph est-elle chargeable ?", () => {
    if (!swissephAvailable) {
      console.warn(
        "[swiss-engine.test] swisseph indisponible dans cet env (build natif manquant). " +
        "Tests Swisseph skippés. Toléré en local, interdit en CI (EXPECT_SWISSEPH=1).",
      );
    }
    if (EXPECT_SWISSEPH) {
      // EXPECT-SWISSEPH-V1 : échec franc si le moteur principal n'est pas
      // testable alors que l'environnement l'exige.
      expect(
        swissephAvailable,
        `EXPECT_SWISSEPH=1 mais swisseph n'a pas chargé : ${getSwissephLoadError() ?? "raison inconnue"}`,
      ).toBe(true);
    } else {
      expect(typeof swissephAvailable).toBe("boolean");
    }
  });

  test.runIf(swissephAvailable)("calcule un thème complet sans crasher", () => {
    const JD = jdForCase(EINSTEIN);
    const chart = computeChartFromJDSwiss(JD, EINSTEIN.lat, EINSTEIN.lng);
    expect(chart.planets["sun"]).toBeDefined();
    expect(chart.planets["moon"]).toBeDefined();
    expect(chart.houses.cusps).toHaveLength(12);
  });

  // Test paramétré sur les 10 corps
  for (const [planet, ref] of Object.entries(EINSTEIN_REF)) {
    test.runIf(swissephAvailable)(
      `${planet} ≈ ${ref.lon.toFixed(2)}° (±${ref.tol}°)`,
      () => {
        const JD = jdForCase(EINSTEIN);
        const chart = computeChartFromJDSwiss(JD, EINSTEIN.lat, EINSTEIN.lng);
        const p = chart.planets[planet];
        expect(p).toBeDefined();
        const delta = angularDelta(p!.longitude, ref.lon);
        expect(delta).toBeLessThan(ref.tol);
      },
    );
  }

  test.runIf(swissephAvailable)(
    "Uranus rétrograde, Mercure direct au moment de la naissance d'Einstein",
    () => {
      const JD = jdForCase(EINSTEIN);
      const chart = computeChartFromJDSwiss(JD, EINSTEIN.lat, EINSTEIN.lng);
      // Référence Astrodienst : Uranus 1°17' Vierge RÉTROGRADE (cohérent :
      // Vierge est opposée au Soleil en Poissons → planète lente près de
      // l'opposition = rétro). EXPECT-SWISSEPH-V1 : l'ancien test affirmait
      // « Mercure rétrograde » — faux, Mercure était direct à 3°09' Bélier ;
      // l'assertion n'avait jamais tourné (tests skippés depuis l'origine).
      expect(chart.planets["uranus"]?.retrograde).toBe(true);
      expect(chart.planets["mercury"]?.retrograde).toBe(false);
    },
  );
});

// ──────────────────────────────────────────────────────────
// Comparaison AstraCore vs Swisseph (cohérence cross-moteur)
// ──────────────────────────────────────────────────────────

describe("Cross-engine consistency", () => {
  test.runIf(swissephAvailable)(
    "AstraCore et Swisseph s'accordent à <5° sur le Soleil et la Lune",
    () => {
      const JD = jdForCase(EINSTEIN);
      const a = computeChartFromJDAstra(JD, EINSTEIN.lat, EINSTEIN.lng);
      const s = computeChartFromJDSwiss(JD, EINSTEIN.lat, EINSTEIN.lng);

      const dSun  = angularDelta(a.planets["sun"]!.longitude,  s.planets["sun"]!.longitude);
      const dMoon = angularDelta(a.planets["moon"]!.longitude, s.planets["moon"]!.longitude);

      expect(dSun).toBeLessThan(5.0);
      expect(dMoon).toBeLessThan(5.0);
    },
  );

  test.runIf(swissephAvailable)(
    "AstraCore et Swisseph donnent le même nombre de planètes",
    () => {
      const JD = jdForCase(EINSTEIN);
      const a = computeChartFromJDAstra(JD, EINSTEIN.lat, EINSTEIN.lng);
      const s = computeChartFromJDSwiss(JD, EINSTEIN.lat, EINSTEIN.lng);
      // Ne pas comparer les clés exactes : AstraCore inclut Chiron,
      // Swisseph (mode Moshier) ne l'a pas. On vérifie juste les corps
      // communs.
      const common = ["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto"];
      for (const k of common) {
        expect(a.planets[k]).toBeDefined();
        expect(s.planets[k]).toBeDefined();
      }
    },
  );
});

// ──────────────────────────────────────────────────────────
// ECLIPSE-MAGNITUDE-V1 — magnitude précise via Swiss Ephemeris
// ──────────────────────────────────────────────────────────
// Références NASA Eclipse Catalog (https://eclipse.gsfc.nasa.gov) :
//   • 2017-08-21 — Great American Eclipse, solaire totale
//     magnitude au point central : 1.0306
//   • 2018-07-27 — éclipse lunaire totale (la plus longue du XXIe s.)
//     umbral magnitude au max global : 1.609

import {
  computeSolarEclipseDetailsSwiss,
  computeLunarEclipseDetailsSwiss,
} from "../src/swiss-engine.js";

function dateToJD(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

describe("ECLIPSE-MAGNITUDE-V1 — détails Swiss Ephemeris", () => {
  test.runIf(swissephAvailable)(
    "magnitude solaire 2017-08-21 (Great American Eclipse) ≈ 1.03",
    () => {
      // Max global à ~18:25 UTC
      const JD = dateToJD(new Date("2017-08-21T18:25:35Z"));
      const r = computeSolarEclipseDetailsSwiss(JD);
      expect(r).not.toBeNull();
      if (!r) return;
      // Tolérance large : Swiss Ephemeris donne 1.0306, on accepte ±0.05
      // pour absorber un éventuel offset de quelques secondes sur le max.
      expect(r.magnitude).toBeGreaterThan(0.98);
      expect(r.magnitude).toBeLessThan(1.10);
      expect(r.kind).toBe("total");
      expect(r.saros).toBeGreaterThan(0);
    },
  );

  test.runIf(swissephAvailable)(
    "magnitude lunaire 2018-07-27 (totale, la plus longue du XXIe s.) ≈ 1.61",
    () => {
      const JD = dateToJD(new Date("2018-07-27T20:21:44Z"));
      const r = computeLunarEclipseDetailsSwiss(JD);
      expect(r).not.toBeNull();
      if (!r) return;
      expect(r.magnitude).toBeGreaterThan(1.50);
      expect(r.magnitude).toBeLessThan(1.70);
      expect(r.kind).toBe("total");
    },
  );

  test.runIf(swissephAvailable)(
    "retourne null sur une date sans éclipse (full moon ordinaire)",
    () => {
      // Lune pleine de mai 2024 sans alignement avec les nœuds → pas d'éclipse
      const JD = dateToJD(new Date("2024-05-23T13:53:00Z"));
      // Swiss Ephemeris peut renvoyer un objet, mais avec rflag=0 ou
      // une magnitude négligeable. On accepte les deux : null OU
      // magnitude basse. Le caller (detectEclipses) ne crée de toute
      // façon un EclipseEvent que si l'algo distance-nœud trigger.
      const r = computeLunarEclipseDetailsSwiss(JD);
      if (r) {
        // Pas d'éclipse alignée à cette date → magnitude umbrale < 0
        expect(r.magnitude).toBeLessThan(0.5);
      }
    },
  );
});

// ──────────────────────────────────────────────────────────
// AYANAMSA-SWISS-NATIVE-V1 — le mode sidéral utilise l'ayanamsa
// Lahiri NATIF (swe_get_ayanamsa_ut), pas l'ancien polynôme maison.
// ──────────────────────────────────────────────────────────
// Références mesurées via swe_get_ayanamsa_ut(SE_SIDM_LAHIRI) :
//   2000-01-01 00:00 UT (JD 2451544.5) → 23°51'25.5" = 23.857083°
// L'ancien polynôme maison donnait 23°50'05.2" = 23.834780° à cette date
// (écart −80"). Le test exige donc (a) la valeur native exacte, et
// (b) un écart franc avec l'ancien polynôme, pour prouver la bascule.

describe("AYANAMSA-SWISS-NATIVE-V1 — ayanamsa Lahiri natif en mode sidéral", () => {
  const JD_2000 = 2451544.5;                // 2000-01-01 00:00 UT
  const LAHIRI_SWISS_2000 = 23.857083;      // swe_get_ayanamsa_ut natif (mesuré)
  // Ancien polynôme maison (copie exacte de astro-engine.ts ayanamsa())
  function ayaHomePoly(JD: number): number {
    const T = (JD - 2451545) / 36525;
    const y = 2000 + T * 100;
    return 22.460 + 1.3748 * (y - 1900) / 100 - 0.000572 * (y - 1900) * (y - 1900) / 1e6;
  }

  test.runIf(swissephAvailable)(
    "chart sidéral expose l'ayanamsa Lahiri natif (±5\" du Swiss réel)",
    () => {
      const chart = computeChartFromJDSwiss(JD_2000, 48.85, 2.35, { zodiac: "sidereal" });
      // ±5" = ±0.00139° : le natif doit matcher la référence Swiss.
      expect(Math.abs(chart.ayanamsa - LAHIRI_SWISS_2000)).toBeLessThan(0.0014);
    },
  );

  test.runIf(swissephAvailable)(
    "l'ayanamsa exposé n'est PLUS l'ancien polynôme maison (écart > 60\")",
    () => {
      const chart = computeChartFromJDSwiss(JD_2000, 48.85, 2.35, { zodiac: "sidereal" });
      const poly = ayaHomePoly(JD_2000);     // ≈ 23.83478°
      // L'écart natif↔polynôme à 2000 est ~80" ; on exige > 60" (0.0167°)
      // pour prouver que la bascule a bien eu lieu (anti-régression).
      expect(Math.abs(chart.ayanamsa - poly) * 3600).toBeGreaterThan(60);
    },
  );

  test.runIf(swissephAvailable)(
    "longitudes sidérales = tropical − ayanamsa natif (cohérence interne)",
    () => {
      const trop = computeChartFromJDSwiss(JD_2000, 48.85, 2.35, { zodiac: "tropical" });
      const side = computeChartFromJDSwiss(JD_2000, 48.85, 2.35, { zodiac: "sidereal" });
      const expected = ((trop.planets["sun"]!.longitude - side.ayanamsa) % 360 + 360) % 360;
      expect(angularDelta(side.planets["sun"]!.longitude, expected)).toBeLessThan(0.001);
    },
  );
});

// ARCHIVE-EPHEMERIDES-SWISSEPH-V1 applied
// AYANAMSA-SWISS-NATIVE-V1 applied
// EXPECT-SWISSEPH-V1 applied

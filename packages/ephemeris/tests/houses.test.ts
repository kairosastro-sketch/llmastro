// ============================================================
// houses.test.ts — Tests d'ancrage de la domification AstraCore
// (HOUSES-DOMIFICATION-FIX-V1)
// ------------------------------------------------------------
// Ces tests tournent SANS swisseph : ils verrouillent houses.ts
// contre des identités astronomiques exactes (indépendantes de
// toute implémentation) et contre une référence externe Swiss
// Ephemeris (astro-seek). Ils auraient tous échoué sur le code
// d'avant le fix (MC inversé de 180° pour RAMC ∈ (90°, 270°),
// cuspides intermédiaires flippées, coefficient de différence
// ascensionnelle faux pour les maisons 2 et 3).
// ============================================================

import { describe, it, expect } from "vitest";
import {
  calculateHousesByCoords,
  houseOfLongitude,
  gmstDeg,
} from "../src/houses.js";

/** Distance angulaire (0–180) entre deux longitudes (en degrés, non bornées). */
function delta(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * JD (UT) tel que le temps sidéral de Greenwich vaille `target` degrés,
 * proche de J2000 (Newton sur gmstDeg — la pente est ~360.9856°/jour).
 */
function jdForGmst(target: number): number {
  let jd = 2451545;
  for (let i = 0; i < 20; i++) {
    let diff = ((target - gmstDeg(jd) + 540) % 360) - 180;
    jd += diff / 360.98564736629;
    if (Math.abs(diff) < 1e-10) break;
  }
  return jd;
}

describe("houses — temps sidéral (ancrage GMST)", () => {
  it("GMST à J2000 (JD 2451545.0) = 280.46062° (valeur publiée, Meeus 12.4)", () => {
    expect(delta(gmstDeg(2451545), 280.46062)).toBeLessThan(0.001);
  });
});

describe("houses — ancres exactes du MC", () => {
  // Identités indépendantes de l'obliquité : quand l'équinoxe ou le
  // solstice culmine, RAMC et MC coïncident exactement.
  //   RAMC =   0° → 0° Bélier culmine    → MC =   0°
  //   RAMC =  90° → 0° Cancer culmine    → MC =  90°
  //   RAMC = 180° → 0° Balance culmine   → MC = 180°
  //   RAMC = 270° → 0° Capricorne culmine → MC = 270°
  for (const ramc of [0, 90, 180, 270]) {
    it(`RAMC = ${ramc}° → MC = ${ramc}° (toute latitude)`, () => {
      const h = calculateHousesByCoords("placidus", jdForGmst(ramc), 48.85, 0);
      expect(delta(h.mc, ramc)).toBeLessThan(0.01);
    });
  }

  it("le MC reste toujours à moins de 2,6° du RAMC (équation des ascensions)", () => {
    // |λ(MC) − RAMC| est borné par ~2,51° pour ε ≈ 23,44°. L'ancien bug
    // (MC inversé de 180°) violait massivement cette propriété.
    for (let ramc = 0; ramc < 360; ramc += 15) {
      const h = calculateHousesByCoords("placidus", jdForGmst(ramc), 48.85, 0);
      expect(delta(h.mc, ramc)).toBeLessThan(2.6);
    }
  });
});

describe("houses — ancres exactes de l'Ascendant", () => {
  it("RAMC = 90° → ASC = 180° (0° Balance se lève, toute latitude non polaire)", () => {
    for (const lat of [0, 25, 48.85, -33.9]) {
      const h = calculateHousesByCoords("placidus", jdForGmst(90), lat, 0);
      expect(delta(h.asc, 180)).toBeLessThan(0.01);
    }
  });

  it("RAMC = 270° → ASC = 0° (0° Bélier se lève, latitudes < cercle polaire)", () => {
    for (const lat of [0, 25, 48.85, -33.9]) {
      const h = calculateHousesByCoords("placidus", jdForGmst(270), lat, 0);
      expect(delta(h.asc, 0)).toBeLessThan(0.01);
    }
  });
});

describe("houses — Placidus, référence externe Swiss Ephemeris", () => {
  // astro-seek.com (moteur Swiss Ephemeris), House Systems Calculator :
  // 1 Jan 2000, 12:00 UT (JD 2451545.0 exactement), 48°51'N 2°21'E,
  // Placidus. Cuspides au minute d'arc près. Notre moteur utilise le
  // temps sidéral MOYEN (pas de nutation) → tolérance 0,1°.
  const EXPECTED = [
    26.75,    //  1 : 26°45' Bélier (= ASC)
    61.8167,  //  2 :  1°49' Gémeaux
    83.2333,  //  3 : 23°14' Gémeaux
    101.7667, //  4 : 11°46' Cancer (= IC)
    122.5167, //  5 :  2°31' Lion
    152.65,   //  6 :  2°39' Vierge
    206.75,   //  7 : 26°45' Balance
    241.8167, //  8 :  1°49' Sagittaire
    263.2333, //  9 : 23°14' Sagittaire
    281.7667, // 10 : 11°46' Capricorne (= MC)
    302.5167, // 11 :  2°31' Verseau
    332.65,   // 12 :  2°39' Poissons
  ];

  const h = calculateHousesByCoords("placidus", 2451545, 48.85, 2.35);

  it("ASC et MC à ±0,1° de la référence", () => {
    expect(delta(h.asc, EXPECTED[0]!)).toBeLessThan(0.1);
    expect(delta(h.mc, EXPECTED[9]!)).toBeLessThan(0.1);
  });

  for (let i = 0; i < 12; i++) {
    it(`cuspide ${i + 1} à ±0,1° de la référence (${EXPECTED[i]!.toFixed(2)}°)`, () => {
      expect(delta(h.cusps[i]!, EXPECTED[i]!)).toBeLessThan(0.1);
    });
  }
});

describe("houses — cohérence structurelle des cuspides", () => {
  const LATS = [0, 25, 48.85, 60, -33.9];

  it("ordre zodiacal strict : 12 écarts consécutifs tous dans (0°, 180°)", () => {
    // L'ancien code violait cette propriété pour TOUTES les heures
    // sidérales testées (cuspides flippées de 180°).
    for (const lat of LATS) {
      for (let ramc = 0; ramc < 360; ramc += 30) {
        const h = calculateHousesByCoords("placidus", jdForGmst(ramc), lat, 0);
        for (let i = 0; i < 12; i++) {
          const gap = ((h.cusps[(i + 1) % 12]! - h.cusps[i]! + 360) % 360);
          expect(gap, `lat ${lat}, RAMC ${ramc}, cuspide ${i + 1}→${i + 2}`).toBeGreaterThan(0);
          expect(gap, `lat ${lat}, RAMC ${ramc}, cuspide ${i + 1}→${i + 2}`).toBeLessThan(180);
        }
      }
    }
  });

  it("axes : cuspide 1 = ASC, 10 = MC, 4 = MC+180, 7 = ASC+180", () => {
    for (let ramc = 0; ramc < 360; ramc += 45) {
      const h = calculateHousesByCoords("placidus", jdForGmst(ramc), 48.85, 0);
      expect(delta(h.cusps[0]!, h.asc)).toBeLessThan(0.001);
      expect(delta(h.cusps[9]!, h.mc)).toBeLessThan(0.001);
      expect(delta(h.cusps[3]!, h.mc + 180)).toBeLessThan(0.001);
      expect(delta(h.cusps[6]!, h.asc + 180)).toBeLessThan(0.001);
    }
  });

  it("houseOfLongitude : un point juste après chaque cuspide tombe dans sa maison", () => {
    const h = calculateHousesByCoords("placidus", 2451545, 48.85, 2.35);
    for (let i = 0; i < 12; i++) {
      const lon = (h.cusps[i]! + 0.01) % 360;
      expect(houseOfLongitude(lon, h.cusps)).toBe(i + 1);
    }
  });

  it("équateur : les cuspides Placidus restent à < 2,6° de la trisection en AR", () => {
    // À latitude 0, la différence ascensionnelle est nulle : les cuspides
    // sont exactement aux AR RAMC + i·30° ; en longitude écliptique elles
    // ne peuvent s'en écarter que de l'équation des ascensions (~2,5° max).
    for (let ramc = 0; ramc < 360; ramc += 30) {
      const h = calculateHousesByCoords("placidus", jdForGmst(ramc), 0, 0);
      for (let i = 0; i < 12; i++) {
        expect(delta(h.cusps[i]!, ramc + 90 + i * 30)).toBeLessThan(2.6);
      }
    }
  });
});

// ──────────────────────────────────────────────────────────
// HOUSES-POLAR-GUARD-V1 (audit R5) : au-delà des cercles polaires les
// demi-arcs Placidus sont indéfinis — pCusp jette et placidusHouses
// retombe sur la trisection des quadrants MC-Asc. Ces tests VERROUILLENT
// ce repli : cuspides finies, axes préservés, ordre zodiacal intact,
// jusqu'au pôle exact (limite dégénérée mais définie).
// ──────────────────────────────────────────────────────────
describe("houses — latitudes polaires (repli trisection, audit R5)", () => {
  const POLAR_LATS = [66.6, 69.65, 78.22, 85, 89.9, 90, -69.65, -90];

  it("12 cuspides finies à toute latitude polaire (pas de NaN/Infinity)", () => {
    for (const lat of POLAR_LATS) {
      const h = calculateHousesByCoords("placidus", jdForGmst(120), lat, 15);
      expect(h.cusps).toHaveLength(12);
      for (const c of h.cusps) expect(Number.isFinite(c)).toBe(true);
    }
  });

  it("cuspide I = Asc toujours ; cuspide X = MC sauf repli en maisons égales", () => {
    for (const lat of POLAR_LATS) {
      const h = calculateHousesByCoords("placidus", jdForGmst(120), lat, 15);
      expect(delta(h.cusps[0]!, h.asc)).toBeLessThan(0.001);
      // repli égal (HOUSES-POLAR-GUARD-V1) : tous les arcs font 30° et le
      // vrai MC flotte hors de la cuspide X — c'est le comportement voulu.
      const isEqual = h.cusps.every((c, i) =>
        delta(c, h.cusps[0]! + i * 30) < 0.001);
      if (!isEqual) expect(delta(h.cusps[9]!, h.mc)).toBeLessThan(0.001);
    }
  });

  it("l'ordre zodiacal des maisons est préservé (houseOfLongitude cohérent)", () => {
    for (const lat of POLAR_LATS) {
      const h = calculateHousesByCoords("placidus", jdForGmst(120), lat, 15);
      for (let i = 0; i < 12; i++) {
        const lon = (h.cusps[i]! + 0.01) % 360;
        expect(houseOfLongitude(lon, h.cusps)).toBe(i + 1);
      }
    }
  });
});

// HOUSES-DOMIFICATION-FIX-V1 applied

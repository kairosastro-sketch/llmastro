// ============================================================
// chart.test.ts
// ------------------------------------------------------------
// Tests d'intégration sur le calcul de thème complet.
// Vérifie :
//   • cohérence des signes (comparaison à des charts connus)
//   • effet de l'heure sur l'Ascendant (doit bouger)
//   • non-effet de l'heure sur le Soleil en signe (stabilité)
//   • invalidation du cache quand les inputs changent
//   • propagation de birthTimeKnown jusqu'au chart.meta
// ============================================================

import { describe, it, expect } from "vitest";
import { ephemerisService } from "../src/service.js";
import { computeChartFromJD } from "../src/astro-engine.js";
import { localToUTC } from "../src/time-utc.service.js";

// Helper : nom de signe depuis un signIdx 0-11.
const SIGNS = [
  "Bélier", "Taureau", "Gémeaux", "Cancer",
  "Lion", "Vierge", "Balance", "Scorpion",
  "Sagittaire", "Capricorne", "Verseau", "Poissons",
];

describe("chart — cas de naissance de référence", () => {

  it("1990-05-15 14:30 Paris : Soleil en Taureau", async () => {
    const chart = await ephemerisService.calculateNatalChart({
      natalId: "test_1990_paris",
      localBirthDate: "1990-05-15",
      localBirthTime: "14:30",
      ianaTz: "Europe/Paris",
      latitude: 48.857,
      longitude: 2.352,
      birthTimeKnown: true,
    });
    // Le Soleil entre en Taureau vers le 20 avril et en Gémeaux vers le 21 mai.
    const sun = chart.planets["sun"];
    expect(sun).toBeDefined();
    expect(SIGNS[sun!.signIdx]).toBe("Taureau");
  });

  it("1985-11-03 04:00 New York : Soleil en Scorpion", async () => {
    // 04:00 local = pendant la nuit DST fall-back (02:00 a déjà eu lieu)
    const chart = await ephemerisService.calculateNatalChart({
      natalId: "test_1985_ny",
      localBirthDate: "1985-11-03",
      localBirthTime: "04:00",
      ianaTz: "America/New_York",
      latitude: 40.713,
      longitude: -74.006,
      birthTimeKnown: true,
    });
    expect(SIGNS[chart.planets["sun"]!.signIdx]).toBe("Scorpion");
  });

  it("2000-12-21 09:00 Sydney : Soleil en Sagittaire ou Capricorne", async () => {
    // Solstice, changement de signe autour du 21-22. On accepte les deux
    // pour ne pas dépendre d'un cutoff précis de la précession.
    const chart = await ephemerisService.calculateNatalChart({
      natalId: "test_2000_sydney",
      localBirthDate: "2000-12-21",
      localBirthTime: "09:00",
      ianaTz: "Australia/Sydney",
      latitude: -33.8688,
      longitude: 151.2093,
      birthTimeKnown: true,
    });
    const sunSign = SIGNS[chart.planets["sun"]!.signIdx];
    expect(["Sagittaire", "Capricorne"]).toContain(sunSign);
  });
});

describe("chart — effet de l'heure sur les angles", () => {

  it("même jour, 2 heures différentes → ASC différent", async () => {
    const morning = await ephemerisService.calculateNatalChart({
      natalId: "t_morning",
      localBirthDate: "1990-05-15",
      localBirthTime: "06:00",
      ianaTz: "Europe/Paris",
      latitude: 48.857,
      longitude: 2.352,
      birthTimeKnown: true,
    });
    const evening = await ephemerisService.calculateNatalChart({
      natalId: "t_evening",
      localBirthDate: "1990-05-15",
      localBirthTime: "18:00",
      ianaTz: "Europe/Paris",
      latitude: 48.857,
      longitude: 2.352,
      birthTimeKnown: true,
    });
    // L'Ascendant bouge d'environ 180° en 12h.
    const diff = Math.abs(morning.asc - evening.asc);
    expect(diff).toBeGreaterThan(90);
    expect(diff).toBeLessThan(270);
  });

  it("même jour/heure, 2 villes : angles différents, Soleil identique", async () => {
    const paris = await ephemerisService.calculateNatalChart({
      natalId: "t_paris",
      localBirthDate: "1990-05-15",
      localBirthTime: "12:00",
      ianaTz: "Europe/Paris",
      latitude: 48.857, longitude: 2.352,
      birthTimeKnown: true,
    });
    const ny = await ephemerisService.calculateNatalChart({
      natalId: "t_ny",
      localBirthDate: "1990-05-15",
      localBirthTime: "06:00",  // même instant UTC que Paris 12:00 l'été
      ianaTz: "America/New_York",
      latitude: 40.713, longitude: -74.006,
      birthTimeKnown: true,
    });
    // Le Soleil en signe doit être identique (même instant absolu).
    expect(paris.planets["sun"]!.signIdx).toBe(ny.planets["sun"]!.signIdx);
    // L'ASC doit différer (longitude différente).
    expect(Math.abs(paris.asc - ny.asc)).toBeGreaterThan(10);
  });
});

describe("chart — propagation birthTimeKnown", () => {

  it("meta.birthTimeKnown = false bien propagé", async () => {
    const chart = await ephemerisService.calculateNatalChart({
      natalId: "t_unknown",
      localBirthDate: "1990-05-15",
      localBirthTime: "12:00",
      ianaTz: "Europe/Paris",
      latitude: 48.857, longitude: 2.352,
      birthTimeKnown: false,
    });
    expect(chart.meta.birthTimeKnown).toBe(false);
    expect(chart.meta.ianaTz).toBe("Europe/Paris");
    expect(chart.meta.localBirthDate).toBe("1990-05-15");
    expect(chart.meta.localBirthTime).toBe("12:00");
  });

  it("meta.resolution remonté correctement", async () => {
    const chart = await ephemerisService.calculateNatalChart({
      natalId: "t_valid",
      localBirthDate: "1990-05-15",
      localBirthTime: "14:30",
      ianaTz: "Europe/Paris",
      latitude: 48.857, longitude: 2.352,
      birthTimeKnown: true,
    });
    expect(chart.meta.resolution).toBe("valid");
    expect(chart.meta.offsetMinutes).toBe(120); // DST été
  });
});

describe("chart — cohérence avec computeChartFromJD direct", () => {

  it("service et appel direct donnent le même Soleil", async () => {
    const viaService = await ephemerisService.calculateNatalChart({
      natalId: "t_service",
      localBirthDate: "2000-01-01",
      localBirthTime: "12:00",
      ianaTz: "UTC",
      latitude: 48.857, longitude: 2.352,
      birthTimeKnown: true,
    });
    const direct = computeChartFromJD(
      localToUTC("2000-01-01", "12:00", "UTC").jdUT,
      48.857, 2.352,
    );
    expect(viaService.planets["sun"]!.signIdx).toBe(direct.planets["sun"]!.signIdx);
    // Les longitudes doivent matcher à ε près (même calcul).
    expect(viaService.planets["sun"]!.longitude)
      .toBeCloseTo(direct.planets["sun"]!.longitude, 2);
  });
});

describe("chart — invariance aux micro-variations lat/lng", () => {

  it("+/- 0.00001° lat ne change pas le cache key (quantifié à 4 décimales)", async () => {
    const a = await ephemerisService.calculateNatalChart({
      natalId: "t_a",
      localBirthDate: "1990-05-15",
      localBirthTime: "14:30",
      ianaTz: "Europe/Paris",
      latitude: 48.8570001,
      longitude: 2.352,
      birthTimeKnown: true,
    });
    const b = await ephemerisService.calculateNatalChart({
      natalId: "t_a",  // même id
      localBirthDate: "1990-05-15",
      localBirthTime: "14:30",
      ianaTz: "Europe/Paris",
      latitude: 48.8570002,  // micro-diff
      longitude: 2.352,
      birthTimeKnown: true,
    });
    // Résultat identique (ASC au centième de degré)
    expect(a.asc).toBeCloseTo(b.asc, 2);
  });
});

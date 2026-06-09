// ============================================================
// astrocartography.test.ts
// ------------------------------------------------------------
// Tests du module PUR d'astrocartographie (ASTROCARTOGRAPHY-V1).
// Aucune dépendance moteur : tout part de coordonnées équatoriales
// fournies en dur. On vérifie :
//   • la conversion écliptique → équatorial sur points connus
//   • la position de la ligne MC (méridien de culmination)
//   • la géométrie AC/DC à l'équateur (angle horaire = 90°)
//   • la détection de circumpolarité (pas de lever/coucher)
//   • la production de parans (croisements) entre deux corps
// ============================================================

import { describe, it, expect } from "vitest";
import {
  eclipticToEquatorial,
  bodyLines,
  computeAcgLines,
  findParans,
  wrap180,
  type EquatorialBody,
} from "../src/astrocartography.js";

const EPS = 23.4367; // obliquité ~ J2000

describe("eclipticToEquatorial", () => {
  it("point vernal λ=0, β=0 → α=0, δ=0", () => {
    const { ra, dec } = eclipticToEquatorial(0, 0, EPS);
    expect(ra).toBeCloseTo(0, 4);
    expect(dec).toBeCloseTo(0, 4);
  });

  it("solstice λ=90, β=0 → α=90, δ=+ε", () => {
    const { ra, dec } = eclipticToEquatorial(90, 0, EPS);
    expect(ra).toBeCloseTo(90, 3);
    expect(dec).toBeCloseTo(EPS, 3);
  });

  it("λ=270, β=0 → δ=−ε (solstice d'hiver)", () => {
    const { dec } = eclipticToEquatorial(270, 0, EPS);
    expect(dec).toBeCloseTo(-EPS, 3);
  });

  it("la latitude écliptique β décale la déclinaison (Lune)", () => {
    const noBeta = eclipticToEquatorial(0, 0, EPS);
    const withBeta = eclipticToEquatorial(0, 5, EPS); // β=+5° (~Lune)
    // à λ=0, ajouter β positif augmente δ d'environ β·cosε
    expect(withBeta.dec).toBeGreaterThan(noBeta.dec + 4);
  });
});

describe("wrap180", () => {
  it("ramène dans (−180, 180]", () => {
    expect(wrap180(190)).toBeCloseTo(-170, 6);
    expect(wrap180(-190)).toBeCloseTo(170, 6);
    expect(wrap180(0)).toBe(0);
    expect(wrap180(360)).toBe(0);
  });
});

describe("bodyLines — géométrie des lignes", () => {
  it("MC tombe à wrap(α − GST)", () => {
    const body: EquatorialBody = { key: "sun", ra: 120, dec: 0 };
    const l = bodyLines(body, 30);
    expect(l.mcLng).toBeCloseTo(90, 6); // 120 − 30
    expect(l.icLng).toBeCloseTo(-90, 6);
  });

  it("à l'équateur, δ=0 → angle horaire 90° : AC à α−90−GST, DC à α+90−GST", () => {
    const body: EquatorialBody = { key: "x", ra: 120, dec: 0 };
    const l = bodyLines(body, 30, { latMin: -10, latMax: 10, latStep: 5 });
    const ascEq = l.asc.find((p) => Math.abs(p.lat) < 1e-6)!;
    const dscEq = l.dsc.find((p) => Math.abs(p.lat) < 1e-6)!;
    expect(ascEq.lng).toBeCloseTo(wrap180(120 - 90 - 30), 6); // = 0
    expect(dscEq.lng).toBeCloseTo(wrap180(120 + 90 - 30), 6); // = ±180
  });

  it("un corps très déclinant est circumpolaire aux hautes latitudes (pas de point)", () => {
    // δ=70° : à φ=80°, |tanφ·tanδ| = tan80·tan70 ≫ 1 → ni lever ni coucher
    const body: EquatorialBody = { key: "x", ra: 0, dec: 70 };
    const l = bodyLines(body, 0, { latMin: 75, latMax: 85, latStep: 5 });
    expect(l.asc.length).toBe(0);
    expect(l.dsc.length).toBe(0);
  });

  it("la ligne MC d'un corps est verticale (longitude constante)", () => {
    const body: EquatorialBody = { key: "x", ra: 200, dec: 12 };
    const l = bodyLines(body, 47);
    // mcLng ne dépend pas de la latitude (méridien) — vérifié par construction
    expect(l.mcLng).toBeCloseTo(wrap180(200 - 47), 6);
  });
});

describe("findParans — croisements entre corps", () => {
  it("deux corps produisent au moins un croisement, bien typé", () => {
    // Croisement garanti : à l'équateur, l'AC de Vénus tombe à
    // wrap(40−90−0) = −50, exactement là où le méridien MC de Saturne
    // wrap(310−0) = −50 est tracé → la courbe AC traverse la verticale.
    const gst = 0;
    const bodies: EquatorialBody[] = [
      { key: "venus", ra: 40, dec: 15 },
      { key: "saturn", ra: 310, dec: 5 },
    ];
    const lines = computeAcgLines(bodies, gst);
    const parans = findParans(lines);
    expect(parans.length).toBeGreaterThan(0);
    for (const p of parans) {
      expect(p.aKey).not.toBe(p.bKey);
      expect(["MC", "IC", "AC", "DC"]).toContain(p.aAngle);
      expect(["MC", "IC", "AC", "DC"]).toContain(p.bAngle);
      expect(Number.isFinite(p.lat)).toBe(true);
      expect(Number.isFinite(p.lng)).toBe(true);
      expect(p.lat).toBeGreaterThanOrEqual(-67);
      expect(p.lat).toBeLessThanOrEqual(67);
    }
  });

  it("blindage NaN : un corps à coordonnées non finies ne fait pas exploser findParans", () => {
    // Régression du hang prod : avec SEFLG_EQUATORIAL le mauvais champ donnait
    // ra/dec = NaN ; les NaN défaisaient les gardes de segIntersect → des
    // millions de faux parans → dédup O(n²). Garde : lignes vides + 0 paran.
    const bodies: EquatorialBody[] = [
      { key: "broken", ra: NaN, dec: NaN },
      { key: "venus", ra: 40, dec: 15 },
    ];
    const lines = computeAcgLines(bodies, 0);
    const broken = lines.find((l) => l.key === "broken")!;
    expect(broken.asc).toHaveLength(0);
    expect(broken.dsc).toHaveLength(0);
    const parans = findParans(lines);
    // aucun croisement impliquant le corps cassé (NaN ne croise rien)
    expect(parans.every((p) => p.aKey !== "broken" && p.bKey !== "broken")).toBe(true);
  });

  it("ne croise jamais un corps avec lui-même", () => {
    const bodies: EquatorialBody[] = [
      { key: "sun", ra: 10, dec: 0 },
      { key: "moon", ra: 100, dec: 5 },
      { key: "mars", ra: 250, dec: -20 },
    ];
    const parans = findParans(computeAcgLines(bodies, 15));
    expect(parans.every((p) => p.aKey !== p.bKey)).toBe(true);
  });
});

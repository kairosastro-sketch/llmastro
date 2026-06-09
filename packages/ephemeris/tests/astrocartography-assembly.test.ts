// ============================================================
// astrocartography-assembly.test.ts
// ------------------------------------------------------------
// Test de la fonction d'ASSEMBLAGE computeAstrocartography (routée via
// le moteur actif). Vérifie la forme du payload servi par la carte
// générale (home) et la cohérence des chiffres réels.
// ============================================================

import { describe, it, expect } from "vitest";
import { jd } from "../src/astro-engine.js";
import { computeAstrocartography, ACG_BODY_KEYS } from "../src/index.js";

describe("computeAstrocartography — payload assemblé", () => {
  it("renvoie les 10 corps, leurs lignes, et des parans", () => {
    const JD = jd(2026, 6, 9, 12); // 2026-06-09 12:00 UT
    const acg = computeAstrocartography(JD);

    expect(acg.jd).toBe(JD);
    expect(acg.gst).toBeGreaterThanOrEqual(0);
    expect(acg.gst).toBeLessThan(360);

    // 10 corps classiques
    expect(acg.bodies).toHaveLength(ACG_BODY_KEYS.length);
    expect(acg.lines).toHaveLength(ACG_BODY_KEYS.length);
    for (const key of ACG_BODY_KEYS) {
      expect(acg.bodies.some((b) => b.key === key)).toBe(true);
      expect(acg.lines.some((l) => l.key === key)).toBe(true);
    }

    // chaque corps a une ligne MC (longitude valide) + des courbes AC/DC
    for (const l of acg.lines) {
      expect(l.mcLng).toBeGreaterThan(-180.0001);
      expect(l.mcLng).toBeLessThanOrEqual(180.0001);
      expect(l.asc.length).toBeGreaterThan(0);
      expect(l.dsc.length).toBeGreaterThan(0);
    }

    // des croisements existent (10 corps → beaucoup de parans)
    expect(acg.parans.length).toBeGreaterThan(0);
    expect(acg.parans.every((p) => p.aKey !== p.bKey)).toBe(true);
  });
});

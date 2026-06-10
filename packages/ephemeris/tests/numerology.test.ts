// ============================================================
// numerology.test.ts — NUMEROLOGY-MODULE-V1
// ------------------------------------------------------------
// Chemin de vie pythagoricien : réduction SÉPARÉE jour/mois/année,
// puis somme, puis réduction finale préservant 11/22/33 (dans le
// résultat final uniquement — pas dans les composantes).
//
// Plusieurs cas ci-dessous divergent volontairement de l'ancienne
// variante dépréciée (somme de tous les chiffres d'un coup),
// supprimée de astro-engine.ts::computeChart() par ce patch — ils
// verrouillent la méthode canonique.
// ============================================================

import { describe, it, expect } from "vitest";
import { computeLifePath } from "../src/numerology.js";

describe("computeLifePath — méthode pythagoricienne (réduction séparée)", () => {

  it("cas simple : 1990-03-21 → 7 (21→3, 3, 1990→1 ; 3+3+1=7)", () => {
    expect(computeLifePath("1990-03-21")).toBe(7);
  });

  it("Einstein 1879-03-14 → 6 (14→5, 3, 1879→7 ; 5+3+7=15→6)", () => {
    // L'ancienne variante (somme de tous les chiffres : 33) donnait un
    // « maître » 33 fantôme pour cette date — la méthode séparée donne 6.
    expect(computeLifePath("1879-03-14")).toBe(6);
  });

  it("nombre maître 11 préservé : 1900-01-09 → 11 (9+1+1)", () => {
    // Ancienne variante : 1+9+0+0+0+1+0+9 = 20 → 2. Méthode canonique : 11.
    expect(computeLifePath("1900-01-09")).toBe(11);
  });

  it("nombre maître 22 préservé : 1998-04-09 → 22 (9+4+9)", () => {
    expect(computeLifePath("1998-04-09")).toBe(22);
  });

  it("les maîtres ne sont PAS préservés dans les composantes : jour 29 → 2", () => {
    // 29 → 11 → 2 (réduction complète du jour), mois 1, année 1900 → 1.
    // Total 2+1+1 = 4 (et non 11+1+1=13→4 — même résultat ici, mais la
    // composante jour est bien réduite à un chiffre).
    expect(computeLifePath("1900-01-29")).toBe(4);
  });

  it("date malformée → 0 (jamais throw)", () => {
    expect(computeLifePath("21/03/1990")).toBe(0);
    expect(computeLifePath("1990-3-21")).toBe(0);
    expect(computeLifePath("")).toBe(0);
  });
});

// NUMEROLOGY-MODULE-V1 applied

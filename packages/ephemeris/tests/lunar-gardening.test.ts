// ============================================================
// lunar-gardening.test.ts — LUNAR-GARDENING-V1
// ------------------------------------------------------------
// Verrouille le mapping élément du signe → type de jour, la
// localisation fr/en, la normalisation de l'index de signe et la
// robustesse (jamais de throw, sortie toujours bien formée).
// ============================================================

import { describe, it, expect } from "vitest";
import { jd } from "../src/engine-core.js";
import { lunarGardening } from "../src/lunar-gardening.js";

const JD = jd(2026, 6, 30, 12); // instant fixe → résultat déterministe

describe("lunarGardening — type de jour selon l'élément du signe", () => {
  // 0 Bélier … 11 Poissons : Feu→fruit, Terre→root, Air→flower, Eau→leaf.
  const expected = [
    "fruit", "root", "flower", "leaf",  // Bélier, Taureau, Gémeaux, Cancer
    "fruit", "root", "flower", "leaf",  // Lion, Vierge, Balance, Scorpion
    "fruit", "root", "flower", "leaf",  // Sagittaire, Capricorne, Verseau, Poissons
  ] as const;

  expected.forEach((dayType, signIdx) => {
    it(`signe ${signIdx} → ${dayType}`, () => {
      const tip = lunarGardening({ moonSignIdx: signIdx, moonPhaseKey: "moon_new", JD });
      expect(tip.dayType).toBe(dayType);
    });
  });
});

describe("lunarGardening — robustesse & forme de sortie", () => {
  it("retourne une carte complète et non vide (fr par défaut)", () => {
    const tip = lunarGardening({ moonSignIdx: 1, moonPhaseKey: "moon_firstq", JD });
    expect(tip.title).toBe("Au jardin aujourd'hui");
    expect(tip.dayTypeLabel).toBe("Jour racines");
    expect(tip.advice.length).toBeGreaterThan(10);
    expect(typeof tip.ascending).toBe("boolean");
    expect(typeof tip.waxing).toBe("boolean");
    expect(typeof tip.rest).toBe("boolean");
    expect(tip.emoji).toBeTruthy();
    // detail = uniquement la sève (la phase n'y est plus, pour éviter la
    // confusion avec montante/descendante).
    expect(tip.detail).toMatch(/^Sève (montante|descendante)$/);
  });

  it("locale en → libellés anglais", () => {
    const tip = lunarGardening({ moonSignIdx: 3, moonPhaseKey: "moon_full", JD, locale: "en" });
    expect(tip.title).toBe("In the garden today");
    expect(tip.dayTypeLabel).toBe("Leaf day");
    expect(tip.detail).toMatch(/^(Rising|Falling) sap$/);
  });

  it("phase croissante vs décroissante via la clé de phase", () => {
    expect(lunarGardening({ moonSignIdx: 0, moonPhaseKey: "moon_waxc", JD }).waxing).toBe(true);
    expect(lunarGardening({ moonSignIdx: 0, moonPhaseKey: "moon_wang", JD }).waxing).toBe(false);
  });

  it("index de signe hors bornes normalisé (12 → 0, -1 → 11)", () => {
    expect(lunarGardening({ moonSignIdx: 12, moonPhaseKey: "moon_new", JD }).dayType).toBe("fruit");
    expect(lunarGardening({ moonSignIdx: -1, moonPhaseKey: "moon_new", JD }).dayType).toBe("leaf");
  });

  it("jour de nœud → conseil de repos (texte dédié)", () => {
    // On ne peut pas garantir que JD tombe un jour de nœud ; on vérifie que
    // quand rest=true, l'advice est bien le message de repos.
    const tip = lunarGardening({ moonSignIdx: 5, moonPhaseKey: "moon_new", JD });
    if (tip.rest) {
      expect(tip.advice).toContain("repos");
    } else {
      expect(tip.advice).not.toContain("laisser le jardin au repos");
    }
  });
});

// LUNAR-GARDENING-V1 applied

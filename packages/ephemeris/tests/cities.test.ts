// ============================================================
// cities.test.ts
// ------------------------------------------------------------
// Tests sur le lookup de villes et la cohérence des IANA tz.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  CITIES, CITY_NAMES, getCity, hasCity,
  suggestCities, CityNotFoundError,
} from "../src/cities.js";
import { DateTime } from "luxon";

describe("cities — lookup exact", () => {

  it("Paris existe et retourne Europe/Paris", () => {
    const c = getCity("Paris");
    expect(c.ianaTz).toBe("Europe/Paris");
    expect(c.lat).toBeCloseTo(48.857, 2);
  });

  it("New York existe et retourne America/New_York", () => {
    const c = getCity("New York");
    expect(c.ianaTz).toBe("America/New_York");
  });

  it("Tokyo existe et retourne Asia/Tokyo", () => {
    const c = getCity("Tokyo");
    expect(c.ianaTz).toBe("Asia/Tokyo");
  });

  it("Saint-Denis (974) existe et retourne Indian/Reunion", () => {
    const c = getCity("Saint-Denis (974)");
    expect(c.ianaTz).toBe("Indian/Reunion");
  });
});

describe("cities — lookup tolérant", () => {

  it("accents ignorés : 'genève' trouve Genève", () => {
    expect(getCity("geneve").ianaTz).toBe("Europe/Zurich");
    expect(getCity("Geneve").ianaTz).toBe("Europe/Zurich");
  });

  it("casse ignorée : 'PARIS' trouve Paris", () => {
    expect(getCity("PARIS").ianaTz).toBe("Europe/Paris");
    expect(getCity("paris").ianaTz).toBe("Europe/Paris");
  });

  it("espaces autour ignorés", () => {
    expect(getCity("  Lyon  ").ianaTz).toBe("Europe/Paris");
  });
});

describe("cities — pas de fallback Paris", () => {

  it("ville inconnue lève CityNotFoundError", () => {
    expect(() => getCity("Xanadu")).toThrow(CityNotFoundError);
  });

  it("l'erreur contient la query et des suggestions", () => {
    try {
      getCity("Pari");  // proche de Paris
    } catch (e) {
      expect(e).toBeInstanceOf(CityNotFoundError);
      const err = e as CityNotFoundError;
      expect(err.query).toBe("Pari");
      expect(err.suggestions.length).toBeGreaterThan(0);
      expect(err.suggestions).toContain("Paris");
    }
  });

  it("hasCity retourne false sans exception", () => {
    expect(hasCity("Xanadu")).toBe(false);
    expect(hasCity("Paris")).toBe(true);
  });
});

describe("cities — suggestions", () => {

  it("suggère les villes proches", () => {
    const s = suggestCities("Lion", 3);
    expect(s).toContain("Lyon");
  });

  it("respecte la limite", () => {
    expect(suggestCities("Paris", 2).length).toBeLessThanOrEqual(2);
  });

  it("chaîne vide ne crash pas", () => {
    expect(suggestCities("", 5)).toEqual([]);
  });
});

describe("cities — cohérence IANA tz", () => {

  it("toutes les ianaTz sont des zones IANA valides", () => {
    const invalid: string[] = [];
    for (const [name, city] of Object.entries(CITIES)) {
      if (!DateTime.local().setZone(city.ianaTz).isValid) {
        invalid.push(`${name} → ${city.ianaTz}`);
      }
    }
    expect(invalid).toEqual([]);
  });

  it("toutes les lat/lng sont dans les bornes physiques", () => {
    const bad: string[] = [];
    for (const [name, city] of Object.entries(CITIES)) {
      if (Math.abs(city.lat) > 90) bad.push(`${name} lat=${city.lat}`);
      if (Math.abs(city.lng) > 180) bad.push(`${name} lng=${city.lng}`);
    }
    expect(bad).toEqual([]);
  });

  it("CITY_NAMES est triée en locale FR", () => {
    const sorted = [...CITY_NAMES];
    const resorted = [...CITY_NAMES].sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" }),
    );
    expect(sorted).toEqual(resorted);
  });

  it("pas de doublon dans CITY_NAMES", () => {
    const set = new Set(CITY_NAMES);
    expect(set.size).toBe(CITY_NAMES.length);
  });
});

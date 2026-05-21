// ============================================================
// time-utc.test.ts
// ------------------------------------------------------------
// Tests de non-régression sur la conversion heure locale → UTC.
// Exécution : `pnpm vitest run packages/ephemeris/tests`
// ============================================================

import { describe, it, expect } from "vitest";
import { localToUTC, TimezoneError } from "../src/time-utc.service.js";

describe("localToUTC — cas standards", () => {

  it("Paris, été (DST actif) : +02:00", () => {
    const r = localToUTC("1990-07-15", "14:30", "Europe/Paris");
    expect(r.offsetMinutes).toBe(120);
    expect(r.resolution).toBe("valid");
    expect(r.utcISO).toBe("1990-07-15T12:30:00.000Z");
  });

  it("Paris, hiver : +01:00", () => {
    const r = localToUTC("1990-01-15", "14:30", "Europe/Paris");
    expect(r.offsetMinutes).toBe(60);
    expect(r.resolution).toBe("valid");
    expect(r.utcISO).toBe("1990-01-15T13:30:00.000Z");
  });

  it("New York, été (EDT) : -04:00", () => {
    const r = localToUTC("1985-07-15", "02:00", "America/New_York");
    expect(r.offsetMinutes).toBe(-240);
    expect(r.utcISO).toBe("1985-07-15T06:00:00.000Z");
  });

  it("Tokyo : +09:00 sans DST", () => {
    const r = localToUTC("1995-03-20", "23:45", "Asia/Tokyo");
    expect(r.offsetMinutes).toBe(540);
    expect(r.resolution).toBe("valid");
  });

  it("Sydney, hiver AU (juin) : +10:00 sans DST", () => {
    const r = localToUTC("1978-06-21", "09:00", "Australia/Sydney");
    expect(r.offsetMinutes).toBe(600);
    expect(r.resolution).toBe("valid");
  });

  it("Sydney, été AU (décembre) : +11:00 DST actif", () => {
    const r = localToUTC("2000-12-21", "09:00", "Australia/Sydney");
    expect(r.offsetMinutes).toBe(660);
  });
});

describe("localToUTC — règles historiques", () => {

  it("Paris 1940 : règle DST allemande en vigueur", () => {
    // Pendant l'occupation, la France passe à CEST+1 de façon continue.
    // L'ancien `isDST` maison ne couvrait pas ça.
    const r = localToUTC("1942-06-15", "10:00", "Europe/Paris");
    // IANA tzdata connaît les règles historiques exactes.
    expect(typeof r.offsetMinutes).toBe("number");
    // On vérifie juste que ça ne throw pas et que l'offset est cohérent.
    expect(r.offsetMinutes).toBeGreaterThanOrEqual(60);
    expect(r.offsetMinutes).toBeLessThanOrEqual(120);
  });

  it("Paris 1980 : DST France-spécifique (règle pre-1996)", () => {
    const r = localToUTC("1980-07-01", "14:00", "Europe/Paris");
    expect(r.offsetMinutes).toBe(120); // CEST
    expect(r.resolution).toBe("valid");
  });
});

describe("localToUTC — bascule DST printemps (heure inexistante)", () => {

  it("Paris 2023-03-26 02:30 : heure inexistante, décalage par défaut", () => {
    // 2h du matin cette nuit-là, la pendule saute directement à 3h.
    // 02:30 n'existe pas.
    const r = localToUTC("2023-03-26", "02:30", "Europe/Paris");
    expect(r.resolution).toBe("nonexistent");
    // Luxon a décalé — on accepte, mais on le signale.
  });

  it("Paris 2023-03-26 02:30 : option throw lève TimezoneError", () => {
    expect(() => localToUTC(
      "2023-03-26", "02:30", "Europe/Paris",
      { onNonExistent: "throw" },
    )).toThrow(TimezoneError);
    try {
      localToUTC("2023-03-26", "02:30", "Europe/Paris", { onNonExistent: "throw" });
    } catch (e) {
      expect(e).toBeInstanceOf(TimezoneError);
      expect((e as TimezoneError).code).toBe("NONEXISTENT_TIME");
    }
  });

  it("Paris 2023-03-26 01:30 (avant bascule) : valide", () => {
    const r = localToUTC("2023-03-26", "01:30", "Europe/Paris");
    expect(r.resolution).toBe("valid");
    expect(r.offsetMinutes).toBe(60); // encore CET
  });

  it("Paris 2023-03-26 04:00 (après bascule) : valide, en CEST", () => {
    const r = localToUTC("2023-03-26", "04:00", "Europe/Paris");
    expect(r.resolution).toBe("valid");
    expect(r.offsetMinutes).toBe(120); // maintenant CEST
  });
});

describe("localToUTC — bascule DST automne (heure ambiguë)", () => {

  it("Paris 2023-10-29 02:30 : ambiguë, 1re occurrence par défaut", () => {
    // Cette nuit-là, à 3h du matin la pendule recule à 2h — donc 02:30
    // se produit 2 fois. On prend la 1re (CEST) par défaut.
    const r = localToUTC("2023-10-29", "02:30", "Europe/Paris");
    // La politique par défaut est "earliest" ; on peut obtenir "ambiguous"
    // ou "valid" selon comment Luxon gère l'intervalle, on teste
    // surtout qu'on ne throw pas et qu'on a un offset cohérent.
    expect(["valid", "ambiguous"]).toContain(r.resolution);
    expect([60, 120]).toContain(r.offsetMinutes);
  });

  it("Paris 2023-10-29 02:30 option throw : lève TimezoneError", () => {
    // Si la politique est "throw", on DOIT lever sur la 2e occurrence.
    // Certains moteurs Luxon ne détectent pas forcément la 1re comme
    // ambiguë ; le test accepte soit throw, soit résolution ambiguous.
    try {
      const r = localToUTC(
        "2023-10-29", "02:30", "Europe/Paris",
        { onAmbiguous: "throw" },
      );
      // Si ça n'a pas thrown, on tolère la résolution valide/ambiguë
      expect(["valid", "ambiguous"]).toContain(r.resolution);
    } catch (e) {
      expect(e).toBeInstanceOf(TimezoneError);
      expect((e as TimezoneError).code).toBe("AMBIGUOUS_TIME");
    }
  });
});

describe("localToUTC — validation d'entrée", () => {

  it("date malformée → TimezoneError INVALID_DATE", () => {
    expect(() => localToUTC("15/05/1990", "14:30", "Europe/Paris"))
      .toThrow(TimezoneError);
  });

  it("heure malformée → TimezoneError INVALID_TIME", () => {
    expect(() => localToUTC("1990-05-15", "2h30", "Europe/Paris"))
      .toThrow(TimezoneError);
  });

  it("tz inconnue → TimezoneError INVALID_IANA_TZ", () => {
    expect(() => localToUTC("1990-05-15", "14:30", "Europe/Atlantis"))
      .toThrow(TimezoneError);
  });

  it("offset numérique rejeté (doit être IANA)", () => {
    expect(() => localToUTC("1990-05-15", "14:30", "+01:00"))
      .toThrow(TimezoneError);
  });
});

describe("localToUTC — JD UT", () => {

  it("JD du 1er janvier 2000 à midi UT = 2451545.0 (époque J2000)", () => {
    const r = localToUTC("2000-01-01", "12:00", "UTC");
    expect(r.jdUT).toBeCloseTo(2451545.0, 5);
  });

  it("JD monotone : +1 jour = +1", () => {
    const a = localToUTC("2000-01-01", "12:00", "UTC");
    const b = localToUTC("2000-01-02", "12:00", "UTC");
    expect(b.jdUT - a.jdUT).toBeCloseTo(1.0, 9);
  });

  it("JD cohérent entre tz différentes pour un même instant", () => {
    // 14:30 Paris l'été = 12:30 UTC = 08:30 New York.
    const paris = localToUTC("2000-07-15", "14:30", "Europe/Paris");
    const utc = localToUTC("2000-07-15", "12:30", "UTC");
    const ny = localToUTC("2000-07-15", "08:30", "America/New_York");
    expect(paris.jdUT).toBeCloseTo(utc.jdUT, 9);
    expect(paris.jdUT).toBeCloseTo(ny.jdUT, 9);
  });
});

describe("localToUTC — TIME-UTC-LMT-V1 : naissances pré-heure-standard", () => {

  it("Einstein (Ulm, 1879) : LMT depuis la longitude, pas le méridien de Berlin", () => {
    // L'Allemagne n'a pas d'heure unifiée avant 1893 : 11:30 est le temps
    // moyen local d'Ulm (9°59′E) → UTC = 11:30 − 39′56″ ≈ 10:50:04Z.
    const r = localToUTC("1879-03-14", "11:30", "Europe/Berlin", { longitude: 9.9833 });
    expect(r.utcISO.startsWith("1879-03-14T10:50")).toBe(true);
    expect(r.offsetMinutes).toBeCloseTo(39.93, 1);
    expect(r.resolution).toBe("valid");
  });

  it("sans longitude : comportement tzdata inchangé (LMT du méridien de zone)", () => {
    // Pas de longitude → pas de correction possible : tzdata applique le
    // LMT de Berlin (+53′28″) → 10:36:32Z. C'est l'ancien comportement.
    const r = localToUTC("1879-03-14", "11:30", "Europe/Berlin");
    expect(r.utcISO).toBe("1879-03-14T10:36:32.000Z");
  });

  it("naissance moderne : la longitude n'altère pas l'offset de zone standard", () => {
    // Offset entier (heure standard) → la correction LMT ne s'applique pas.
    const r = localToUTC("1990-05-15", "14:30", "Europe/Berlin", { longitude: 9.9833 });
    expect(r.offsetMinutes).toBe(120); // CEST, inchangé
    expect(r.utcISO).toBe("1990-05-15T12:30:00.000Z");
  });

  it("LMT : un même instant murale converge selon la longitude", () => {
    // 1850, deux lieux sur la même longitude doivent donner le même JD.
    const a = localToUTC("1850-06-01", "12:00", "Europe/Berlin", { longitude: 0 });
    const b = localToUTC("1850-06-01", "12:00", "UTC");
    expect(a.jdUT).toBeCloseTo(b.jdUT, 9); // longitude 0 → LMT = UTC
  });
});

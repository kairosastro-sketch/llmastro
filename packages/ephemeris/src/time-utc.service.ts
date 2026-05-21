// ============================================================
// time-utc.service.ts
// ------------------------------------------------------------
// Source unique de vérité pour la conversion heure locale → UTC.
//
// Remplace l'ancienne paire { isDST, jdFromLocal } qui faisait
// du "dernier dimanche de mars/octobre" maison. Cette logique :
//   • ne couvrait que l'Europe occidentale post-1996
//   • cassait pour toute date avant 1996 (règles différentes)
//   • ignorait les règles historiques (France 1940-45, US, AU…)
//   • ne gérait pas les heures ambiguës (bascule automne)
//     ou inexistantes (bascule printemps)
//
// On s'appuie désormais sur la base IANA tzdata via Luxon.
// ============================================================

import { DateTime } from "luxon";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export type TimeResolution =
  | "valid"        // heure unique, sans ambiguïté
  | "ambiguous"    // heure se produit 2 fois (bascule automne) — on a pris la 1re
  | "nonexistent"; // heure n'existe pas (bascule printemps) — on a pris celle d'avant

export interface UtcConversionResult {
  /** Jour julien UT (décimal, depuis l'époque 4713 BC). */
  jdUT: number;
  /** Offset UTC appliqué, en minutes (positif = à l'est). */
  offsetMinutes: number;
  /** Instant UTC absolu, pour logs / cache keys. */
  utcISO: string;
  /** Comment l'heure locale a été résolue. */
  resolution: TimeResolution;
}

export class TimezoneError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_DATE"
      | "INVALID_TIME"
      | "INVALID_IANA_TZ"
      | "NONEXISTENT_TIME"
      | "AMBIGUOUS_TIME",
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TimezoneError";
  }
}

// ──────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

function assertValidDate(date: string): void {
  if (!DATE_RE.test(date)) {
    throw new TimezoneError(
      `Birth date must be YYYY-MM-DD, got "${date}"`,
      "INVALID_DATE",
      { date },
    );
  }
}

function assertValidTime(time: string): void {
  if (!TIME_RE.test(time)) {
    throw new TimezoneError(
      `Birth time must be HH:MM or HH:MM:SS, got "${time}"`,
      "INVALID_TIME",
      { time },
    );
  }
}

function assertValidIanaTz(ianaTz: string): void {
  // TIME-UTC-OFFSET-REJECT-V1 : Luxon accepte les offsets fixes
  // (`+01:00`, `UTC-5`, etc.) comme zones valides, mais on les
  // refuse explicitement ici. Raison : un offset fixe ne porte pas
  // les règles DST historiques (ex: France 1940-45 = UTC+2, Russie
  // qui a supprimé le DST en 2011…). Le reste du moteur (natal,
  // transits) suppose qu'on a un IANA region/city avec tzdata
  // complète. Acceptant un offset on perd silencieusement la
  // précision historique. Mieux vaut throw tôt.
  if (NUMERIC_OFFSET_RE.test(ianaTz)) {
    throw new TimezoneError(
      `Numeric offset "${ianaTz}" not accepted — use an IANA timezone like "Europe/Paris" instead. Fixed offsets lose DST history.`,
      "INVALID_IANA_TZ",
      { ianaTz },
    );
  }
  // Luxon expose une méthode officielle à partir de la v3.
  if (!DateTime.local().setZone(ianaTz).isValid) {
    throw new TimezoneError(
      `Unknown IANA timezone "${ianaTz}". Expected e.g. "Europe/Paris".`,
      "INVALID_IANA_TZ",
      { ianaTz },
    );
  }
}

// Catch les écritures d'offset fixe :
//   • `+01:00`, `-05:30`, `+0100`, `-0530`
//   • `+1`, `-5`, `+12`, `-12`
//   • `UTC+1`, `GMT-5`, `UT+10` (insensible à la casse)
// Ne catch pas `UTC` ou `GMT` seuls (zones IANA valides).
const NUMERIC_OFFSET_RE = /^(UTC|GMT|UT)?[+-]\d{1,2}(:?\d{2})?$/i;

// ──────────────────────────────────────────────────────────
// Conversion
// ──────────────────────────────────────────────────────────

/**
 * Convertit une date/heure locale + timezone IANA en instant UTC + JD.
 *
 * @param localDate      "YYYY-MM-DD" — date calendaire locale (murale).
 * @param localTime      "HH:MM" ou "HH:MM:SS" — heure murale.
 * @param ianaTz         "Europe/Paris", "America/New_York"… jamais un offset.
 * @param opts.onAmbiguous  "earliest" (par défaut) | "latest" | "throw"
 * @param opts.onNonExistent  "shiftLater" (par défaut) | "throw"
 * @param opts.longitude  Longitude de naissance (est positif). Si fournie,
 *        active la correction LMT pour les naissances antérieures à
 *        l'adoption de l'heure standard (cf. TIME-UTC-LMT-V1 ci-dessous).
 *
 * @throws TimezoneError si la date/heure/tz est invalide, ou si on a
 *         demandé "throw" sur une heure ambiguë / inexistante.
 */
export function localToUTC(
  localDate: string,
  localTime: string,
  ianaTz: string,
  opts: {
    onAmbiguous?: "earliest" | "latest" | "throw";
    onNonExistent?: "shiftLater" | "throw";
    longitude?: number;
  } = {},
): UtcConversionResult {
  assertValidDate(localDate);
  assertValidTime(localTime);
  assertValidIanaTz(ianaTz);

  const onAmbiguous = opts.onAmbiguous ?? "earliest";
  const onNonExistent = opts.onNonExistent ?? "shiftLater";

  // Luxon DateTime construit à partir d'une heure murale + zone.
  // Si l'heure est inexistante (spring forward), Luxon la normalise
  // dans l'heure d'été. Si elle est ambiguë (fall back), Luxon pose
  // la 1re occurrence. On détecte l'ambiguïté en comparant avec un
  // instant légèrement décalé.
  const [hStr, mStr, sStr] = localTime.split(":");
  const hour = Number(hStr);
  const minute = Number(mStr);
  const second = sStr ? Number(sStr) : 0;
  const [yStr, moStr, dStr] = localDate.split("-");
  const year = Number(yStr);
  const month = Number(moStr);
  const day = Number(dStr);

  const dt = DateTime.fromObject(
    { year, month, day, hour, minute, second },
    { zone: ianaTz },
  );

  if (!dt.isValid) {
    throw new TimezoneError(
      `Luxon rejected ${localDate} ${localTime} @ ${ianaTz}: ${dt.invalidReason} — ${dt.invalidExplanation}`,
      "INVALID_DATE",
      { localDate, localTime, ianaTz },
    );
  }

  // ──────────────────────────────────────────────────────────
  // TIME-UTC-LMT-V1 : naissances antérieures à l'heure standard.
  //
  // Avant que le pays n'adopte une heure de zone (Allemagne 1893,
  // France 1911…), tzdata modélise la zone par le LMT (temps moyen
  // local) de son méridien de référence — Berlin pour Europe/Berlin.
  // Une naissance à Ulm calée sur "Europe/Berlin" hérite donc du
  // méridien de Berlin : ~13 min d'erreur, soit ~3° d'Ascendant.
  //
  // Détection : sur cette période l'offset tzdata est le LMT exact du
  // méridien — une valeur en minutes NON ENTIÈRE (Berlin 1879 =
  // +53′28″ = 53,46 min). Une heure de zone standard est toujours un
  // nombre entier de minutes. Offset non entier ⇒ ère LMT.
  //
  // Correction : on recalcule l'offset depuis la longitude réelle de
  // naissance (LMT = longitude × 4 min/°), seule donnée géographique
  // fiable pour cette période.
  //
  // Limite connue : les « heures moyennes nationales » non entières
  // (France PMT 1891-1911, Pays-Bas 1909-1937) sont aussi traitées
  // comme du LMT — on prend alors le LMT du lieu de naissance plutôt
  // que celui de la capitale. L'écart reste de quelques minutes et la
  // convention est défendable en astrologie.
  if (typeof opts.longitude === "number" && !Number.isInteger(dt.offset)) {
    const lmtOffsetMinutes = opts.longitude * 4; // 1° de longitude = 4 min
    const utc = DateTime
      .fromObject({ year, month, day, hour, minute, second }, { zone: "utc" })
      .minus({ milliseconds: Math.round(lmtOffsetMinutes * 60000) });
    const utcMs = utc.toMillis();
    return {
      jdUT: utcMs / 86400000 + 2440587.5,
      offsetMinutes: lmtOffsetMinutes,
      utcISO: utc.toUTC().toISO() ?? "",
      resolution: "valid", // aucune bascule DST possible en ère LMT
    };
  }

  // Détection heure inexistante :
  // si on a donné 02:30 un jour de spring-forward à Paris et que
  // Luxon produit 03:30 UTC+2, c'est qu'il a décalé. On compare
  // l'heure effective à celle demandée.
  let resolution: TimeResolution = "valid";
  if (dt.hour !== hour || dt.minute !== minute) {
    if (onNonExistent === "throw") {
      throw new TimezoneError(
        `Time ${localTime} on ${localDate} does not exist in ${ianaTz} (DST spring-forward).`,
        "NONEXISTENT_TIME",
        { localDate, localTime, ianaTz, shiftedTo: dt.toISO() },
      );
    }
    resolution = "nonexistent";
  }

  // Détection heure ambiguë :
  // un instant 1h avant et 1h après doit avoir le même offset que dt.
  // Sinon on est sur une bascule. On utilise 30 min d'écart pour
  // tomber dans la fenêtre.
  if (resolution === "valid") {
    const before = dt.minus({ minutes: 30 });
    const after = dt.plus({ minutes: 30 });
    if (before.offset !== dt.offset || after.offset !== dt.offset) {
      // On regarde si une construction "late" (avec le même wall-clock
      // mais 2h plus tard en UTC) donnerait aussi un DateTime valide
      // avec le même wall-clock. C'est le critère d'ambiguïté.
      const alt = dt.plus({ hours: 1 });
      const altAsWall = DateTime.fromObject(
        { year: alt.year, month: alt.month, day: alt.day, hour: alt.hour, minute: alt.minute, second: alt.second },
        { zone: ianaTz },
      );
      if (altAsWall.toMillis() !== alt.toMillis()) {
        // L'heure se répète.
        if (onAmbiguous === "throw") {
          throw new TimezoneError(
            `Time ${localTime} on ${localDate} is ambiguous in ${ianaTz} (DST fall-back). Ask the user which occurrence.`,
            "AMBIGUOUS_TIME",
            { localDate, localTime, ianaTz },
          );
        }
        if (onAmbiguous === "latest") {
          // On rejoue avec l'offset de la 2e occurrence
          const late = dt.plus({ hours: 1 }).setZone(ianaTz, { keepLocalTime: false });
          return buildResult(late, "ambiguous");
        }
        resolution = "ambiguous";
      }
    }
  }

  return buildResult(dt, resolution);
}

function buildResult(dt: DateTime, resolution: TimeResolution): UtcConversionResult {
  const utcMs = dt.toUTC().toMillis();
  // JD Unix epoch = 2440587.5 ; 1 jour = 86400000 ms
  const jdUT = utcMs / 86400000 + 2440587.5;
  return {
    jdUT,
    offsetMinutes: dt.offset,
    utcISO: dt.toUTC().toISO() ?? "",
    resolution,
  };
}

// ──────────────────────────────────────────────────────────
// Helpers convivaux pour le reste du code
// ──────────────────────────────────────────────────────────

/**
 * Convertit un résultat UTC en (dateUTC, heureDecimaleUT) pour les
 * consommateurs qui ont encore l'ancienne signature.
 *
 * @deprecated Les nouveaux appelants devraient préférer `jdUT` direct.
 */
export function toLegacyPair(r: UtcConversionResult): { dateUTC: string; hourUT: number } {
  const [datePart, timePart] = r.utcISO.split("T");
  const [hh, mm, ss] = (timePart ?? "00:00:00").replace("Z", "").split(":").map(Number);
  return {
    dateUTC: datePart ?? "",
    hourUT: (hh ?? 0) + (mm ?? 0) / 60 + (ss ?? 0) / 3600,
  };
}

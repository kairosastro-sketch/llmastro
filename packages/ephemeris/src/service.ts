// ============================================================
// service.ts
// ------------------------------------------------------------
// Adapter qui expose au reste de l'app une interface stable
// et sans ambiguïté pour calculer un thème natal ou des transits.
//
// Changements par rapport à la version précédente :
//
//   1. La conversion local → UTC est faite ici, une seule fois,
//      via `localToUTC` (Luxon + IANA tzdata).
//
//   2. Plus de `birthTimeUT` numérique qui se baladait avec une
//      convention implicite. La nouvelle signature :
//          { localBirthDate, localBirthTime, ianaTz, latitude, longitude }
//      nomme chaque input de façon sans ambiguïté.
//
//   3. Le cache Redis est keyé sur un hash des données qui
//      influencent effectivement le résultat (birthDate, birthTime,
//      lat, lng, ianaTz, zodiac, houseSystem, birthTimeKnown),
//      pas sur `natalId` seul.
//
//   4. `birthTimeKnown: false` est propagé dans le chart DTO pour
//      que la couche IA puisse hedger ses textes.
//
//   5. L'ancienne signature `calculateNatalChart(natalId, date, hourUT, lat, lng)`
//      est conservée en `@deprecated` pour compat, mais délègue
//      à la nouvelle — et trace un warning.
// ============================================================

import { createHash } from "node:crypto";
import {
  computeChartFromJD,
  computeCurrentSky,
  type ChartResult,
  type ZodiacSystem,
  type HouseSystem,
} from "./engine-router.js";
import { localToUTC, type UtcConversionResult } from "./time-utc.service.js";
import { CityNotFoundError, type CityResolver } from "./types.js";

// ──────────────────────────────────────────────────────────
// Redis (optionnel — cache gracieux)
// ──────────────────────────────────────────────────────────

let _redis: any = null;
async function getRedis() {
  if (_redis !== null) return _redis;
  try {
    const { createClient } = await import("redis");
    // CI-CONVERGENCE-V1: timeout court pour éviter le blocage 5s+ en CI
    // (où Redis n'existe pas). En prod Redis répond en <50ms, identique.
    const client = createClient({
      url: process.env["REDIS_URL"] ?? "redis://redis:6379",
      socket: { connectTimeout: 500, reconnectStrategy: false },
    });
    client.on("error", () => { /* silent */ });
    await client.connect();
    _redis = client;
    return client;
  } catch {
    _redis = false;
    return null;
  }
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = await getRedis();
    if (!r) return null;
    const v = await r.get(key);
    return v ? JSON.parse(v) as T : null;
  } catch { return null; }
}

async function cacheSet(key: string, data: unknown, ttl = 86400): Promise<void> {
  try {
    const r = await getRedis();
    if (!r) return;
    await r.setEx(key, ttl, JSON.stringify(data));
  } catch { /* silent */ }
}

/** Supprime une ou plusieurs clés (utilisé à l'update d'un profil natal). */
export async function cacheDelPrefix(prefix: string): Promise<number> {
  try {
    const r = await getRedis();
    if (!r) return 0;
    // Scan par petits lots pour ne pas bloquer Redis en prod.
    let cursor = "0";
    let deleted = 0;
    do {
      const res = await r.scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 });
      cursor = res.cursor ?? res[0] ?? "0";
      const keys: string[] = res.keys ?? res[1] ?? [];
      if (keys.length > 0) {
        await r.del(keys);
        deleted += keys.length;
      }
    } while (cursor !== "0");
    return deleted;
  } catch { return 0; }
}

// ──────────────────────────────────────────────────────────
// Types de sortie (compat avec l'existant)
// ──────────────────────────────────────────────────────────

export interface EnrichedPlanet {
  key: string;
  longitude: number;
  signIdx: number;
  degree: number;
  house?: number;
  retrograde?: boolean;
}

export interface EnrichedAspect {
  planet1: string; planet2: string;
  p1: string; p2: string;
  type: string; typeFr: string;
  orb: number; angle: number;
  exact: boolean; symbol: string;
  tone: "h" | "t" | "n";
}

export interface EnrichedHouse {
  number: number;
  longitude: number;
  signIdx: number;
}

export interface ChartMeta {
  /** Date de naissance locale (YYYY-MM-DD). */
  localBirthDate: string;
  /** Heure de naissance locale (HH:MM). */
  localBirthTime: string;
  /** Identifiant IANA (ex. "Europe/Paris"). */
  ianaTz: string;
  /** Offset appliqué, minutes. Utile pour affichage + debug. */
  offsetMinutes: number;
  /** Résolution de l'heure locale (valid/ambiguous/nonexistent). */
  resolution: UtcConversionResult["resolution"];
  /**
   * L'utilisateur connaît-il son heure de naissance ?
   * Si `false`, l'IA doit hedger sur Ascendant, MC, Maisons, Lune.
   */
  birthTimeKnown: boolean;
  /** Instant UTC absolu, pour traçabilité. */
  utcISO: string;
}

export interface EnrichedChart {
  planets: Record<string, EnrichedPlanet>;
  houses: EnrichedHouse[];
  asc: number;
  mc: number;
  /** VERTEX-V1 : Vertex écliptique (deg 0–360). `null` si le thème a été
   *  calculé par le moteur de secours astracore (Vertex non calculé). */
  vertex: number | null;
  aspects: EnrichedAspect[];
  retrogrades: string[];
  moonPhase: {
    phase: string; emoji: string;
    illumination: number; description: string;
    key: string;
  };
  numerology: number;
  source: string;
  zodiac: ZodiacSystem;
  houseSystem: HouseSystem;
  JD: number;
  meta: ChartMeta;
}


// STAB-PRE-5-V1 : calcul du chemin de vie (numérologie pythagoricienne)
// Convention : on réduit jour/mois/année séparément, puis somme finale,
// en préservant 11/22/33 dans le résultat final uniquement.
function computeLifePath(localBirthDate: string): number {
  function reduceToDigit(n: number): number {
    while (n > 9) {
      n = String(n).split("").reduce((s, c) => s + Number(c), 0);
    }
    return n;
  }
  function reducePreserveMasters(n: number): number {
    while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
      n = String(n).split("").reduce((s, c) => s + Number(c), 0);
    }
    return n;
  }
  try {
    const m = (localBirthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return 0;
    const year  = Number(m[1]);
    const month = Number(m[2]);
    const day   = Number(m[3]);
    return reducePreserveMasters(reduceToDigit(day) + reduceToDigit(month) + reduceToDigit(year));
  } catch { return 0; }
}

function enrich(result: ChartResult, meta: ChartMeta): EnrichedChart {
  const houses: EnrichedHouse[] = result.houses.cusps.map((lon, i) => ({
    number: i + 1,
    longitude: lon,
    signIdx: Math.floor(lon / 30),
  }));

  const aspects: EnrichedAspect[] = result.aspects.map(a => ({
    planet1: a.p1, planet2: a.p2, p1: a.p1, p2: a.p2,
    type: a.type, typeFr: a.typeFr,
    orb: a.orb, angle: a.angle, exact: a.exact,
    symbol: a.symbol, tone: a.tone,
  }));

  return {
    planets: result.planets as Record<string, EnrichedPlanet>,
    houses,
    asc: result.houses.asc,
    mc: result.houses.mc,
    vertex: result.houses.vertex,   // VERTEX-V1
    aspects,
    retrogrades: result.retrogrades,
    moonPhase: result.moonPhase,
    numerology: meta.localBirthDate ? computeLifePath(meta.localBirthDate) : result.numerology, // STAB-PRE-5-V1
    source: result.source,
    zodiac: result.zodiac,
    houseSystem: result.houseSystem,
    JD: result.JD,
    meta,
  };
}

// ──────────────────────────────────────────────────────────
// Cache key : SEUL les champs qui changent le résultat entrent
// dans le hash. natalId ne suffit pas.
// ──────────────────────────────────────────────────────────

function chartCacheKey(args: {
  natalId: string;
  localBirthDate: string;
  localBirthTime: string;
  ianaTz: string;
  latitude: number;
  longitude: number;
  zodiac: ZodiacSystem;
  houseSystem: HouseSystem;
  birthTimeKnown: boolean;
}): string {
  const payload = JSON.stringify({
    d: args.localBirthDate,
    t: args.localBirthTime,
    z: args.ianaTz,
    // On quantifie lat/lng à 4 décimales (~10 m) pour absorber
    // les micro-variations de saisie sans invalider tout le temps.
    la: Number(args.latitude.toFixed(4)),
    lo: Number(args.longitude.toFixed(4)),
    zo: args.zodiac,
    hs: args.houseSystem,
    tk: args.birthTimeKnown,
  });
  const hash = createHash("sha1").update(payload).digest("hex").slice(0, 16);
  return `chart:v4:${args.natalId}:${hash}`;
}

/**
 * Préfixe à purger quand un profil natal est modifié.
 * À appeler depuis le handler `PATCH /natal/:id`.
 */
export function chartCacheKeyPrefix(natalId: string): string {
  return `chart:v4:${natalId}:`;
}

// ──────────────────────────────────────────────────────────
// Input normalisé — c'est LA signature à utiliser partout
// ──────────────────────────────────────────────────────────

export interface NatalChartInput {
  /** Id du profil natal (utilisé pour cache et logs). */
  natalId: string;
  /** Date de naissance LOCALE (YYYY-MM-DD). */
  localBirthDate: string;
  /** Heure de naissance LOCALE (HH:MM ou HH:MM:SS). */
  localBirthTime: string;
  /** Identifiant IANA (ex. "Europe/Paris"). Jamais un offset. */
  ianaTz: string;
  /** Latitude (nord positif). */
  latitude: number;
  /** Longitude (est positif). */
  longitude: number;
  /** Connaît-on vraiment l'heure ? Sinon on met 12:00 par défaut
   *  et l'IA hedge ses interprétations. */
  birthTimeKnown: boolean;
  /** Options de calcul (optionnelles). */
  zodiac?: ZodiacSystem;
  houseSystem?: HouseSystem;
  /** Politique sur heure ambiguë/inexistante (par défaut : tolérant). */
  onAmbiguous?: "earliest" | "latest" | "throw";
  onNonExistent?: "shiftLater" | "throw";
}

// ──────────────────────────────────────────────────────────
// Service public
// ──────────────────────────────────────────────────────────

class EphemerisService {

  /**
   * Calcule un thème natal à partir d'une saisie locale + IANA tz.
   *
   * ✦ Nouvelle API recommandée. La conversion vers UTC et le JD
   *   se font ici, une seule fois, côté serveur, sans convention
   *   implicite.
   */
  async calculateNatalChart(input: NatalChartInput): Promise<EnrichedChart> {
    const zodiac = input.zodiac ?? "tropical";
    const houseSystem = input.houseSystem ?? "placidus";

    // 1. Conversion local → UTC (1 seule fois)
    const conv = localToUTC(
      input.localBirthDate,
      input.localBirthTime,
      input.ianaTz,
      {
        onAmbiguous: input.onAmbiguous ?? "earliest",
        onNonExistent: input.onNonExistent ?? "shiftLater",
      },
    );

    // 2. Cache keyé sur les inputs qui changent le résultat
    const cacheKey = chartCacheKey({
      natalId: input.natalId,
      localBirthDate: input.localBirthDate,
      localBirthTime: input.localBirthTime,
      ianaTz: input.ianaTz,
      latitude: input.latitude,
      longitude: input.longitude,
      zodiac, houseSystem,
      birthTimeKnown: input.birthTimeKnown,
    });
    const cached = await cacheGet<EnrichedChart>(cacheKey);
    if (cached) return cached;

    // 3. Calcul du thème à partir du JD UT directement
    const result = computeChartFromJD(
      conv.jdUT,
      input.latitude,
      input.longitude,
      { zodiac, houseSystem },
    );

    // 4. Métadonnées propagées jusqu'à l'UI et aux prompts IA
    const meta: ChartMeta = {
      localBirthDate: input.localBirthDate,
      localBirthTime: input.localBirthTime,
      ianaTz: input.ianaTz,
      offsetMinutes: conv.offsetMinutes,
      resolution: conv.resolution,
      birthTimeKnown: input.birthTimeKnown,
      utcISO: conv.utcISO,
    };

    const enriched = enrich(result, meta);
    await cacheSet(cacheKey, enriched, 7 * 24 * 3600);
    return enriched;
  }

  // ──────────────────────────────────────────────────────
  // EPHEMERIS-DEEP-CONSOLIDATION-V1
  // City resolver injectable : l'app fournit le lookup ville→coords
  // (typiquement via la table Postgres `cities` GeoNames). Le
  // package ephemeris est ainsi 100% indépendant de toute liste
  // hardcodée.
  // ──────────────────────────────────────────────────────
  private _cityResolver: CityResolver | null = null;

  /**
   * Injecte le resolver de ville. À appeler une fois au boot de
   * l'application (ex: apps/api/src/index.ts).
   *
   * Le resolver peut être sync ou async. Doit retourner null si
   * la ville n'est pas trouvée — le service convertit ce null en
   * `CityNotFoundError` pour le caller.
   */
  setCityResolver(resolver: CityResolver): void {
    this._cityResolver = resolver;
  }

  /**
   * Version convenience : résout le nom de ville en interne via
   * le resolver injecté au boot.
   *
   * Lève `CityNotFoundError` si :
   *   - aucun resolver n'a été injecté (mauvaise config app)
   *   - le resolver retourne null (ville inconnue)
   */
  async calculateFromCityName(args: Omit<NatalChartInput, "ianaTz" | "latitude" | "longitude"> & {
    cityName: string;
  }): Promise<EnrichedChart> {
    const { cityName, ...rest } = args;

    if (!this._cityResolver) {
      throw new CityNotFoundError(
        cityName,
        ["(no city resolver injected — check ephemerisService.setCityResolver() at app boot)"],
      );
    }

    const city = await Promise.resolve(this._cityResolver(cityName));
    if (!city) {
      throw new CityNotFoundError(cityName, []);
    }

    return this.calculateNatalChart({
      ...rest,
      ianaTz:    city.ianaTz,
      latitude:  city.lat,
      longitude: city.lng,
    });
  }

  /** Ciel du moment présent (transits) pour une position. */
  async getCurrentSky(
    latitude: number,
    longitude: number,
    opts: { zodiac?: ZodiacSystem; houseSystem?: HouseSystem } = {},
  ): Promise<EnrichedChart> {
    const result = computeCurrentSky(latitude, longitude, opts);
    const nowIso = new Date().toISOString();
    return enrich(result, {
      localBirthDate: nowIso.slice(0, 10),
      localBirthTime: nowIso.slice(11, 16),
      ianaTz: "UTC",
      offsetMinutes: 0,
      resolution: "valid",
      birthTimeKnown: true,
      utcISO: nowIso,
    });
  }

  // ──────────────────────────────────────────────────────
  // LEGACY — conservé pour compat pendant la migration
  // ──────────────────────────────────────────────────────

  /**
   * @deprecated Utilisez `calculateNatalChart({ localBirthDate, localBirthTime, ianaTz, … })`.
   *
   * Ancienne signature : `birthTimeUT` en heures décimales UT.
   * On la garde pour ne pas casser les appelants qui n'ont pas
   * encore migré, mais elle est marquée deprecated.
   */
  async calculateNatalChartLegacy(
    natalId: string,
    birthDate: string,      // YYYY-MM-DD (en UTC ! sinon pourri)
    birthTimeUT: number,    // heures décimales UT
    latitude: number,
    longitude: number,
    opts: { zodiac?: ZodiacSystem; houseSystem?: HouseSystem } = {},
  ): Promise<EnrichedChart> {
    // eslint-disable-next-line no-console
    console.warn(
      `[ephemeris] calculateNatalChartLegacy called for natalId=${natalId}. ` +
      `Migrate to calculateNatalChart({ localBirthDate, localBirthTime, ianaTz, … }).`,
    );

    // On simule l'ancienne convention : on considère les input comme UTC.
    const hh = Math.floor(birthTimeUT);
    const mm = Math.floor((birthTimeUT - hh) * 60);
    const localBirthTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

    return this.calculateNatalChart({
      natalId,
      localBirthDate: birthDate,
      localBirthTime,
      ianaTz: "UTC",          // on impose UTC puisque l'ancienne signature passait déjà en UT
      latitude, longitude,
      birthTimeKnown: true,   // on ne sait pas, on suppose oui par défaut
      zodiac: opts.zodiac,
      houseSystem: opts.houseSystem,
    });
  }

  /**
   * @deprecated EPHEMERIS-DEEP-CONSOLIDATION-V1 — utiliser
   * directement le resolver via setCityResolver() ou appeler
   * calculateFromCityName() qui l'utilise en interne.
   * Conservé pour rétro-compat ; bascule async sur le resolver injecté.
   */
  async getCityCoords(name: string) {
    if (!this._cityResolver) {
      throw new CityNotFoundError(
        name,
        ["(no city resolver injected — check ephemerisService.setCityResolver() at app boot)"],
      );
    }
    const city = await Promise.resolve(this._cityResolver(name));
    if (!city) throw new CityNotFoundError(name, []);
    return city;
  }
}

export const ephemerisService = new EphemerisService();
export { CityNotFoundError } from "./types.js";

// ARCHIVE-EPHEMERIDES-SWISSEPH-V1 applied

// EPHEMERIS-DEEP-CONSOLIDATION-V1 applied

// CI-CONVERGENCE-V1 applied

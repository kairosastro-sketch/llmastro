// ============================================================
// swiss-engine.ts — Moteur de calcul via Swiss Ephemeris
// ------------------------------------------------------------
// ARCHIVE-EPHEMERIDES-SWISSEPH-V1
//
// Implémente la même interface publique que astro-engine pour les
// fonctions de calcul lourd (computeChartFromJD, computeCurrentSky,
// allPositionsSwiss, calculateHousesSwiss).
//
// Mode Moshier (SEFLG_MOSEPH) :
//   - Précision ~1 arcseconde, plage -3000 à +3000.
//   - Aucun fichier ephemeris (.se1) requis sur disque.
//   - Couvre Soleil, Lune, Mercure→Pluton, nœuds (vrai et moyen),
//     Lilith moyenne. Chiron/asteroïdes nécessitent les fichiers
//     d'éphémérides (phase B via JPL Horizons).
//
// Les helpers calcul-pur (calculateAspects, partOfFortune,
// houseOfLongitude, n360) sont réutilisés depuis astro-engine
// puisqu'ils ne dépendent pas du moteur. EXCEPTION (AYANAMSA-SWISS-
// NATIVE-V1) : l'ayanamsa sidéral n'est PAS repris d'astro-engine —
// le mode Swiss utilise l'ayanamsa Lahiri NATIF (swe_get_ayanamsa_ut),
// exact, au lieu du polynôme maison imprécis.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import {
  type ZodiacSystem,
  type HouseSystem,
  type PlanetPosition,
  type HouseSet,
  type ChartResult,
  type ChartOptions,
  calculateAspects,
  moonPhase,
  partOfFortune,
  computeHermeticLots,
  houseOfLongitude,
  n360,
} from "./astro-engine.js";

// ASTROCARTOGRAPHY-V1 : type partagé des coordonnées équatoriales.
import { type EquatorialCoord } from "./astrocartography.js";

// EXPECT-SWISSEPH-V1 : fallback de chargement pour les contextes ESM (vitest).
import { createRequire } from "node:module";
import { join } from "node:path";

// ──────────────────────────────────────────────────────────
// Chargement lazy de swisseph (optional dependency)
// ──────────────────────────────────────────────────────────

let _swe: any = null;            // null = pas tenté ; false = échec ; objet = OK
let _swissephLoadError: string | null = null;

// require global Node — disponible en CJS (build tsup prod, bundle Next SSR).
// EXPECT-SWISSEPH-V1 : en ESM (vitest exécute ce fichier transformé, sans
// require global), on retombe sur createRequire ancré sur le cwd — turbo
// lance les tests dans packages/ephemeris, où swisseph est une dépendance
// directe. Si la résolution échoue (ex. apps/api en dev ESM), le catch
// ci-dessous garde le fallback AstraCore.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: ((id: string) => any) | undefined;

function loadSwisseph(): boolean {
  if (_swe !== null) return _swe !== false;
  try {
    const req =
      typeof require === "function"
        ? require
        : createRequire(join(process.cwd(), "package.json"));
    _swe = req("swisseph");
    // Configurer le path des fichiers d'éphémérides (utile plus tard
    // pour Chiron/asteroïdes ou licence pro). En mode Moshier seul,
    // ce path n'est pas lu.
    const path = process.env["SWISSEPH_PATH"] ?? "/usr/local/share/swisseph";
    if (typeof _swe.swe_set_ephe_path === "function") {
      try { _swe.swe_set_ephe_path(path); } catch { /* tolérant */ }
    }
    return true;
  } catch (err) {
    _swe = false;
    _swissephLoadError = err instanceof Error ? err.message : String(err);
    return false;
  }
}

export function isSwissephLoaded(): boolean {
  return _swe !== null && _swe !== false;
}

export function getSwissephLoadError(): string | null {
  return _swissephLoadError;
}

/**
 * Force le chargement (utile pour le health-check admin).
 * Retourne true si la lib est disponible, false sinon.
 */
export function ensureSwissephLoaded(): boolean {
  return loadSwisseph();
}

// ──────────────────────────────────────────────────────────
// AYANAMSA-SWISS-NATIVE-V1 — Ayanamsa sidéral via Swiss Ephemeris natif.
//
// Avant ce patch, le mode Swiss réutilisait le polynôme Lahiri "maison"
// de astro-engine. Ce polynôme est calé sur 1900 mais sa pente est trop
// faible (~49.5″/an au lieu de ~50.3″/an), d'où une dérive MESURÉE vs
// swe_get_ayanamsa_ut(SE_SIDM_LAHIRI) :
//   1975 → −60″ · 2000 → −80″ (−1.34′) · 2025 → −100″ (−1.67′) · 1700 → +148″.
// Le mode Swiss bascule donc sur l'ayanamsa NATIF (exact). AstraCore
// (fallback dev) garde son polynôme, faute de lib native.
//
// swe_set_sid_mode DOIT précéder swe_get_ayanamsa_ut : sans lui, la lib
// renvoie Fagan/Bradley (le défaut), pas Lahiri. On le pose une seule
// fois. Ça n'affecte pas les positions tropicales (elles n'utilisent pas
// SEFLG_SIDEREAL) — seul swe_get_ayanamsa_ut lit ce mode.
// ──────────────────────────────────────────────────────────

let _sidModeSet = false;

export function ayanamsaSwiss(JD: number): number {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  if (!_sidModeSet) {
    _swe.swe_set_sid_mode(_swe.SE_SIDM_LAHIRI, 0, 0);
    _sidModeSet = true;
  }
  const r = _swe.swe_get_ayanamsa_ut(JD);
  return typeof r === "number" ? r : (r && r.ayanamsa !== undefined ? r.ayanamsa : r);
}

function toSiderealSwiss(lon: number, JD: number): number {
  return n360(lon - ayanamsaSwiss(JD));
}

// ──────────────────────────────────────────────────────────
// Mappings constantes (initialisés après le 1er load)
// ──────────────────────────────────────────────────────────

interface PlanetIplMap {
  sun: number; moon: number; mercury: number; venus: number;
  mars: number; jupiter: number; saturn: number; uranus: number;
  neptune: number; pluto: number; northNode: number; lilith: number;
  // ASTEROIDS-V1 : corps secondaires. Chiron + les 4 astéroïdes
  // « classiques » exigent les fichiers d'éphémérides (.se1) en mode
  // SEFLG_SWIEPH. lilithTrue (apogée osculateur) reste calculable en
  // Moshier comme la Lilith moyenne.
  chiron: number; ceres: number; pallas: number; juno: number; vesta: number;
  lilithTrue: number;
}

let _PLANET_IPL: PlanetIplMap | null = null;

// ASTEROIDS-V1 : corps qui ne sont disponibles QUE via les fichiers
// d'éphémérides Swiss (SEFLG_SWIEPH). Le mode Moshier (SEFLG_MOSEPH) ne
// sait pas les calculer → on bascule ces corps précis en mode fichier.
const FILE_BASED_BODIES: ReadonlySet<string> = new Set([
  "chiron", "ceres", "pallas", "juno", "vesta",
]);

// ASTEROIDS-V1 : corps « optionnels ». Si swe_calc échoue (fichier .se1
// absent, date hors plage, etc.) on les OMET silencieusement au lieu de
// faire planter tout le thème — le code consommateur itère sur ce qui est
// présent. Inclut lilithTrue : si l'apogée osculateur n'est pas dispo dans
// un binding donné, on retombe simplement sur la Lilith moyenne déjà là.
const OPTIONAL_BODIES: ReadonlySet<string> = new Set([
  "chiron", "ceres", "pallas", "juno", "vesta", "lilithTrue",
]);

// ASTEROIDS-V1 : on ne loggue l'omission d'un corps qu'une fois par clé
// pour ne pas inonder les logs (un thème = 1 omission potentielle par corps).
const _omittedBodiesLogged = new Set<string>();
function logBodyOmission(key: string, reason: string): void {
  if (_omittedBodiesLogged.has(key)) return;
  _omittedBodiesLogged.add(key);
  // eslint-disable-next-line no-console
  console.warn(`[swiss-engine] corps « ${key} » omis (éphémérides .se1 absentes ?) : ${reason}`);
}

function getPlanetIpl(): PlanetIplMap {
  if (_PLANET_IPL) return _PLANET_IPL;
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  _PLANET_IPL = {
    sun:       _swe.SE_SUN,
    moon:      _swe.SE_MOON,
    mercury:   _swe.SE_MERCURY,
    venus:     _swe.SE_VENUS,
    mars:      _swe.SE_MARS,
    jupiter:   _swe.SE_JUPITER,
    saturn:    _swe.SE_SATURN,
    uranus:    _swe.SE_URANUS,
    neptune:   _swe.SE_NEPTUNE,
    pluto:     _swe.SE_PLUTO,
    // Nœud lunaire moyen (cohérent avec astro-engine actuel).
    // Pour passer en nœud vrai : SE_TRUE_NODE.
    northNode: _swe.SE_MEAN_NODE,
    // LILITH-V1 : Mean Apogee = "Lilith astrologique" mean (lisse,
    // standard depuis Dane Rudhyar). Alternative `SE_OSCU_APOG = 13`
    // (osculating) — instantanée, oscille beaucoup, peu utilisée en
    // thème natal. Mean = bon défaut.
    lilith:    _swe.SE_MEAN_APOG,
    // ASTEROIDS-V1 : Chiron + les 4 astéroïdes « féminins/archétypaux »
    // standards. Codes IPL natifs Swiss Ephemeris (mode fichier requis).
    chiron:     _swe.SE_CHIRON,
    ceres:      _swe.SE_CERES,
    pallas:     _swe.SE_PALLAS,
    juno:       _swe.SE_JUNO,
    vesta:      _swe.SE_VESTA,
    // Lilith vraie = apogée lunaire osculateur (instantané).
    lilithTrue: _swe.SE_OSCU_APOG,
  };
  return _PLANET_IPL;
}

const HOUSE_SYSTEM_CHAR: Record<HouseSystem, string> = {
  placidus:   "P",
  koch:       "K",
  equal:      "E",
  whole_sign: "W",
};

// ──────────────────────────────────────────────────────────
// Calcul des positions planétaires
// ──────────────────────────────────────────────────────────

/**
 * Toutes les positions géocentriques pour un JD UT donné.
 * Mode Moshier (pas de fichier disque requis).
 */
export function allPositionsSwiss(JD: number): Record<string, PlanetPosition> {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  const ipl  = getPlanetIpl();
  const out: Record<string, PlanetPosition> = {};

  for (const [key, code] of Object.entries(ipl)) {
    // ASTEROIDS-V1 : Chiron + astéroïdes en mode fichier (SEFLG_SWIEPH) ;
    // tout le reste reste en Moshier comme avant (zéro régression).
    const flag = (FILE_BASED_BODIES.has(key) ? _swe.SEFLG_SWIEPH : _swe.SEFLG_MOSEPH) | _swe.SEFLG_SPEED;

    let r: any;
    try {
      r = _swe.swe_calc_ut(JD, code, flag);
    } catch (err) {
      r = { error: err instanceof Error ? err.message : String(err) };
    }

    const errored = r && typeof r === "object" && "error" in r && r.error;
    const lon = errored ? NaN : n360(r.longitude);
    if (errored || !Number.isFinite(lon)) {
      // ASTEROIDS-V1 : un corps optionnel qui échoue (fichier .se1 manquant,
      // date hors plage) est omis, pas fatal. Les corps classiques restent
      // bloquants — leur absence signalerait une vraie panne du moteur.
      if (OPTIONAL_BODIES.has(key)) {
        logBodyOmission(key, errored ? String(r.error) : "longitude non finie");
        continue;
      }
      throw new Error(`swe_calc_ut failed for ${key} (ipl=${code}): ${errored ? r.error : "longitude non finie"}`);
    }
    out[key] = {
      key,
      longitude: lon,
      signIdx:   Math.floor(lon / 30),
      degree:    lon % 30,
      retrograde: typeof r.longitudeSpeed === "number" ? r.longitudeSpeed < 0 : false,
    };
  }

  // Nœud sud = nord + 180
  if (out["northNode"]) {
    const sn = n360(out["northNode"].longitude + 180);
    out["southNode"] = {
      key: "southNode",
      longitude: sn,
      signIdx:   Math.floor(sn / 30),
      degree:    sn % 30,
      // SOUTH-NODE-RETRO-FIX : le Nœud Sud partage l'axe nodal — il a
      // donc le même mouvement que le Nœud Nord. Sans cette ligne il
      // s'affichait « Direct » alors que le Nœud Nord est rétrograde.
      retrograde: out["northNode"].retrograde ?? false,
    };
  }

  return out;
}

// ──────────────────────────────────────────────────────────
// ASTROCARTOGRAPHY-V1 — Positions équatoriales (RA/Dec) via Swiss
// ──────────────────────────────────────────────────────────
/**
 * Ascension droite + déclinaison (degrés) de chaque corps pour un JD UT.
 * Utilise le flag SEFLG_EQUATORIAL : Swiss Ephemeris renvoie alors
 * directement (RA, Dec) dans les champs `longitude`/`latitude` du wrapper —
 * aucune conversion manuelle, β intégré nativement (Lune, Pluton corrects).
 */
export function equatorialPositionsSwiss(JD: number): Record<string, EquatorialCoord> {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  const flag = _swe.SEFLG_MOSEPH | _swe.SEFLG_EQUATORIAL;
  const ipl  = getPlanetIpl() as unknown as Record<string, number>;
  const out: Record<string, EquatorialCoord> = {};

  // northNode (SE_MEAN_NODE) inclus pour le curseur de dates (ACG_SLOW_BODY_KEYS).
  // Il reste hors du set par défaut côté assemblage → carte natale / « maintenant »
  // inchangées.
  for (const key of ["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto","northNode"]) {
    const code = ipl[key];
    if (typeof code !== "number") continue;
    const r = _swe.swe_calc_ut(JD, code, flag);
    if (r && typeof r === "object" && "error" in r && r.error) {
      throw new Error(`swe_calc_ut (equatorial) failed for ${key}: ${r.error}`);
    }
    // ⚠️ Avec SEFLG_EQUATORIAL, le wrapper node-swisseph renvoie les champs
    // `rectAscension` / `declination` — PAS `longitude` / `latitude` (ceux-ci
    // sont undefined). Lire les mauvais champs donnait NaN, qui faisait
    // exploser findParans (les gardes NaN ne déclenchaient pas) → hang prod.
    // Fallback défensif sur longitude/latitude au cas où un autre binding
    // exposerait ces noms.
    const ra  = r.rectAscension ?? r.longitude;
    const dec = r.declination   ?? r.latitude;
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) {
      throw new Error(
        `swe_calc_ut (equatorial) a renvoyé des coordonnées non finies pour ${key} ` +
        `(ra=${ra}, dec=${dec}) — champs attendus rectAscension/declination.`,
      );
    }
    out[key] = { ra: n360(ra), dec };
  }

  return out;
}

// ──────────────────────────────────────────────────────────
// Calcul des maisons
// ──────────────────────────────────────────────────────────

export function calculateHousesSwiss(
  system: HouseSystem,
  JD: number,
  lat: number,
  lng: number,
): HouseSet {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  const hsys = HOUSE_SYSTEM_CHAR[system] ?? "P";
  const r = _swe.swe_houses(JD, lat, lng, hsys);
  if (r && typeof r === "object" && "error" in r && r.error) {
    throw new Error(`swe_houses failed: ${r.error}`);
  }
  // r.house est un tableau de 12 cusps (1..12)
  // r.ascendant et r.mc sont scalaires
  const cusps: number[] = (r.house as number[]).map(n360);
  // VERTEX-V1 : swe_houses expose le Vertex (ascmc[3]). Lecture défensive
  // au cas où une version du wrapper ne le fournirait pas → null.
  const vertex: number | null =
    typeof r.vertex === "number" ? n360(r.vertex) : null;
  return {
    cusps,
    asc:  n360(r.ascendant),
    mc:   n360(r.mc),
    vertex,
    system,
  };
}

// ──────────────────────────────────────────────────────────
// Phase lunaire — variante depuis longitudes pré-calculées
// ──────────────────────────────────────────────────────────
// On garde la même logique de bornes/phases que astro-engine.moonPhase
// mais en partant des longitudes Swisseph (plus précises) plutôt que
// de recalculer Soleil/Lune via Meeus.

function moonPhaseFromLongitudes(sunLon: number, moonLon: number): ReturnType<typeof moonPhase> {
  const el = n360(moonLon - sunLon);

  let key: string, emoji: string;
  if      (el <  11.25) { key = "moon_new";    emoji = "🌑"; }
  else if (el <  78.75) { key = "moon_waxc";   emoji = "🌒"; }
  else if (el < 101.25) { key = "moon_firstq"; emoji = "🌓"; }
  else if (el < 168.75) { key = "moon_waxg";   emoji = "🌔"; }
  else if (el < 191.25) { key = "moon_full";   emoji = "🌕"; }
  else if (el < 258.75) { key = "moon_wang";   emoji = "🌖"; }
  else if (el < 281.25) { key = "moon_lastq";  emoji = "🌗"; }
  else if (el < 348.75) { key = "moon_wanc";   emoji = "🌘"; }
  else                  { key = "moon_new";    emoji = "🌑"; }

  // Description FR (mêmes textes que astro-engine, dupliqués pour ne pas
  // exporter MOON_PHASES_FR)
  const FR: Record<string, { phase: string; description: string }> = {
    moon_new:    { phase: "Nouvelle Lune",          description: "Temps des semences et des intentions nouvelles" },
    moon_waxc:   { phase: "Premier croissant",      description: "Croissance, construction, prise d'élan" },
    moon_firstq: { phase: "Premier quartier",       description: "Décisions, action, dépassement des obstacles" },
    moon_waxg:   { phase: "Gibbeuse croissante",    description: "Perfectionnement, ajustements, persévérance" },
    moon_full:   { phase: "Pleine Lune",            description: "Culmination, révélation, intensité émotionnelle" },
    moon_wang:   { phase: "Gibbeuse décroissante",  description: "Gratitude, partage, diffusion" },
    moon_lastq:  { phase: "Dernier quartier",       description: "Lâcher-prise, révisions, ajustements" },
    moon_wanc:   { phase: "Dernier croissant",      description: "Repos, introspection, purification" },
  };
  const info = FR[key]!;
  const illumination = (1 - Math.cos((el * Math.PI) / 180)) / 2;

  return {
    key,
    phase: info.phase,
    emoji,
    illumination: Math.round(illumination * 100) / 100,
    description: info.description,
  };
}

// ──────────────────────────────────────────────────────────
// Compute chart depuis un JD UT — entrée canonique
// ──────────────────────────────────────────────────────────

export function computeChartFromJDSwiss(
  JD: number,
  latitude: number,
  longitude: number,
  opts: ChartOptions = {},
): ChartResult {
  const zodiac      = opts.zodiac      ?? "tropical";
  const houseSystem = opts.houseSystem ?? "placidus";
  const T = (JD - 2451545) / 36525;

  // 1. Positions géocentriques
  let planets = allPositionsSwiss(JD);

  // 2. Sidéral si demandé
  if (zodiac === "sidereal") {
    const adjusted: Record<string, PlanetPosition> = {};
    for (const k of Object.keys(planets)) {
      const slon = toSiderealSwiss(planets[k]!.longitude, JD);
      adjusted[k] = {
        ...planets[k]!,
        longitude: slon,
        signIdx:   Math.floor(slon / 30),
        degree:    slon % 30,
      };
    }
    planets = adjusted;
  }

  // 3. Maisons
  const houses = calculateHousesSwiss(houseSystem, JD, latitude, longitude);
  if (zodiac === "sidereal") {
    houses.cusps = houses.cusps.map(c => toSiderealSwiss(c, JD));
    houses.asc   = toSiderealSwiss(houses.asc, JD);
    houses.mc    = toSiderealSwiss(houses.mc,  JD);
    // VERTEX-V1 : aligner le Vertex sur le zodiaque sidéral comme asc/mc.
    if (houses.vertex != null) houses.vertex = toSiderealSwiss(houses.vertex, JD);
  }

  // 4. Maison de chaque planète
  for (const k of Object.keys(planets)) {
    planets[k]!.house = houseOfLongitude(planets[k]!.longitude, houses.cusps);
  }

  // 5. Rétrogrades — déjà dans planets[k].retrograde via SEFLG_SPEED
  const retrogrades: string[] = [];
  // ASTEROIDS-V1 : Chiron + astéroïdes ajoutés à la liste. Le `?.` gère leur
  // absence éventuelle (mode Moshier / fichiers .se1 absents) sans crash.
  for (const k of ["mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto","chiron","ceres","pallas","juno","vesta"]) {
    if (planets[k]?.retrograde) retrogrades.push(k);
  }

  // 6. Aspects
  const aspects = calculateAspects(planets);

  // 7. Part de Fortune
  const sunLon  = planets["sun"]!.longitude;
  const moonLon = planets["moon"]!.longitude;
  const sunAbove = ((sunLon - houses.asc + 360) % 360) >= 180; // B1-FIX : ≥180° = maisons 7-12 = au-dessus de l'horizon (thème de jour)
  const pofLon = partOfFortune(sunLon, moonLon, houses.asc, !sunAbove);
  planets["fortune"] = {
    key: "fortune",
    longitude: pofLon,
    signIdx:   Math.floor(pofLon / 30),
    degree:    pofLon % 30,
    house:     houseOfLongitude(pofLon, houses.cusps),
  };

  // 7b. POINTS-ARABES-V1 : Lots hermétiques (même sect que la Part de Fortune).
  const lots = computeHermeticLots(houses.asc, planets, !sunAbove, pofLon);

  // 8. Phase lunaire à partir des longitudes Swisseph
  const phase = moonPhaseFromLongitudes(sunLon, moonLon);
  void moonPhase; // import gardé pour éviter dead-code warning si on revient à l'ancien

  return {
    planets,
    houses,
    aspects,
    retrogrades,
    moonPhase: phase,
    numerology: 0,           // dérivée plus tard à partir de localBirthDate
    zodiac,
    houseSystem,
    JD, T,
    ayanamsa: zodiac === "sidereal" ? ayanamsaSwiss(JD) : 0,
    lots,
    // C2-FIX : ChartResult.source est désormais "meeus" | "swiss" — on
    // rapporte le vrai moteur. getEngineDiagnostic() reste la source
    // détaillée pour /admin/ephemeris/health.
    source: "swiss",
  };
}

/**
 * Ciel du moment présent (transits) via Swisseph.
 */
export function computeCurrentSkySwiss(
  lat: number,
  lng: number,
  opts: ChartOptions = {},
): ChartResult {
  const JD = Date.now() / 86400000 + 2440587.5;
  return computeChartFromJDSwiss(JD, lat, lng, opts);
}

/**
 * Helper standalone : calcul de la longitude d'un corps unique.
 * Utilisé par le health-check pour vérifier que swisseph répond.
 */
export function getPlanetLongitudeSwiss(JD: number, planetKey: keyof PlanetIplMap): number {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  const ipl = getPlanetIpl();
  const code = ipl[planetKey];
  const r = _swe.swe_calc_ut(JD, code, _swe.SEFLG_MOSEPH);
  if (r && typeof r === "object" && "error" in r && r.error) {
    throw new Error(`swe_calc_ut failed: ${r.error}`);
  }
  return n360(r.longitude);
}

// ──────────────────────────────────────────────────────────
// C3-FIX : helpers routables — variantes Swiss des helpers bruts
// d'AstraCore (isRetrograde / moonPhase). Le routeur (engine-router)
// expose des versions cohérentes avec le moteur actif, pour que
// sky-events.service et event-relevance.service ne tournent plus
// systématiquement en Meeus quand ASTRO_ENGINE=swisseph.
// ──────────────────────────────────────────────────────────

/**
 * Statut rétrograde d'un corps via Swiss Ephemeris : vitesse instantanée
 * `longitudeSpeed` (flag SEFLG_SPEED). Pas de biais de station — contrairement
 * à la différence finie d'AstraCore. Retourne false pour un corps hors mapping.
 */
export function isRetrogradeSwiss(key: string, JD: number): boolean {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  const code = (getPlanetIpl() as unknown as Record<string, number>)[key];
  if (typeof code !== "number") return false;
  // ASTEROIDS-V1 : flag fichier pour Chiron/astéroïdes, Moshier sinon.
  const flag = (FILE_BASED_BODIES.has(key) ? _swe.SEFLG_SWIEPH : _swe.SEFLG_MOSEPH) | _swe.SEFLG_SPEED;
  let r: any;
  try {
    r = _swe.swe_calc_ut(JD, code, flag);
  } catch (err) {
    r = { error: err instanceof Error ? err.message : String(err) };
  }
  if (r && typeof r === "object" && "error" in r && r.error) {
    // ASTEROIDS-V1 : pour un corps optionnel indisponible, on répond
    // « pas rétrograde » plutôt que de propager une panne.
    if (OPTIONAL_BODIES.has(key)) return false;
    throw new Error(`swe_calc_ut failed for ${key}: ${r.error}`);
  }
  return typeof r.longitudeSpeed === "number" ? r.longitudeSpeed < 0 : false;
}

/**
 * Phase lunaire via Swiss Ephemeris — longitudes Soleil/Lune précises.
 * Même découpage en 8 phases que astro-engine.moonPhase.
 */
export function moonPhaseSwiss(JD: number): ReturnType<typeof moonPhase> {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  const ipl = getPlanetIpl();
  const sun  = _swe.swe_calc_ut(JD, ipl.sun,  _swe.SEFLG_MOSEPH);
  const moon = _swe.swe_calc_ut(JD, ipl.moon, _swe.SEFLG_MOSEPH);
  return moonPhaseFromLongitudes(n360(sun.longitude), n360(moon.longitude));
}

// ============================================================
// ECLIPSE-MAGNITUDE-V1
// ------------------------------------------------------------
// Magnitude précise des éclipses via Swiss Ephemeris :
//   • swe_sol_eclipse_where : retourne magnitude + obscuration + saros
//     au point central d'une éclipse solaire à la date donnée
//   • swe_lun_eclipse_how   : retourne umbral/penumbral magnitude
//     d'une éclipse lunaire (la magnitude est globale, on passe des
//     coords nulles — la valeur reste cohérente)
//
// Retournent null si swisseph n'est pas chargé OU si le binding rend
// une erreur (date hors-éclipse, etc.). Le caller doit fallback sur
// la classification qualitative existante en cas de null.
// ============================================================

export type SolarEclipseKind = "total" | "annular" | "partial" | "hybrid";
export type LunarEclipseKind = "total" | "partial" | "penumbral";

export interface SolarEclipseDetails {
  magnitude:        number;             // 0..1.0+ (>1 = totale, ratio diamètres)
  obscuration:      number;             // 0..1 (fraction du disque solaire couverte)
  kind:             SolarEclipseKind;
  saros:            number;             // numéro de série Saros
  sarosMember:      number;             // rang dans la série
}

export interface LunarEclipseDetails {
  magnitude:        number;             // umbralMagnitude (>1 = totale)
  penumbralMagnitude: number;
  kind:             LunarEclipseKind;
  saros:            number;
  sarosMember:      number;
}

function decodeSolarRflag(rflag: number, swe: any): SolarEclipseKind {
  // Bit-flags Swiss Ephemeris : SE_ECL_TOTAL=1, SE_ECL_ANNULAR=2,
  // SE_ECL_PARTIAL=4, SE_ECL_ANNULAR_TOTAL=8 (hybrid).
  if (rflag & (swe.SE_ECL_ANNULAR_TOTAL ?? 8)) return "hybrid";
  if (rflag & (swe.SE_ECL_TOTAL          ?? 1)) return "total";
  if (rflag & (swe.SE_ECL_ANNULAR        ?? 2)) return "annular";
  return "partial";
}

function decodeLunarRflag(rflag: number, swe: any): LunarEclipseKind {
  // SE_ECL_PENUMBRAL = 16. SE_ECL_TOTAL=1, SE_ECL_PARTIAL=4 (lunaire).
  if (rflag & (swe.SE_ECL_TOTAL     ?? 1))  return "total";
  if (rflag & (swe.SE_ECL_PARTIAL   ?? 4))  return "partial";
  if (rflag & (swe.SE_ECL_PENUMBRAL ?? 16)) return "penumbral";
  return "penumbral";
}

export function computeSolarEclipseDetailsSwiss(JD: number): SolarEclipseDetails | null {
  if (!loadSwisseph()) return null;
  try {
    // C4-FIX : SEFLG_MOSEPH — cohérent avec le reste du moteur (mode
    // Moshier, sans fichier .se1 requis). SEFLG_SWIEPH exigeait des
    // fichiers d'éphémérides souvent absents en prod → la magnitude
    // précise retombait silencieusement sur null.
    const r = _swe.swe_sol_eclipse_where(JD, _swe.SEFLG_MOSEPH);
    if (!r || "error" in r) return null;
    return {
      magnitude:   r.eclipseMagnitude,
      obscuration: r.solarDiscFraction,
      kind:        decodeSolarRflag(r.rflag, _swe),
      saros:       r.sarosNumber,
      sarosMember: r.sarosMember,
    };
  } catch {
    return null;
  }
}

export function computeLunarEclipseDetailsSwiss(JD: number): LunarEclipseDetails | null {
  if (!loadSwisseph()) return null;
  try {
    // Pour une éclipse lunaire, la magnitude est globale (la Lune est
    // dans l'ombre de la Terre pour tous les observateurs côté nuit).
    // On passe des coords nulles, seuls azimuth/altitude diffèrent.
    const r = _swe.swe_lun_eclipse_how(JD, _swe.SEFLG_MOSEPH, 0, 0, 0); // C4-FIX : SEFLG_MOSEPH (cf. computeSolarEclipseDetailsSwiss)
    if (!r || "error" in r) return null;
    return {
      magnitude:          r.umbralMagnitude,
      penumbralMagnitude: r.penumbralMagnitude,
      kind:               decodeLunarRflag(r.rflag, _swe),
      saros:              r.sarosNumber,
      sarosMember:        r.sarosMember,
    };
  } catch {
    return null;
  }
}

// ARCHIVE-EPHEMERIDES-SWISSEPH-V1 applied

// ARCHIVE-EPHEMERIDES-SWISSEPH-CJS-FIX-V1 applied
// EXPECT-SWISSEPH-V1 applied

// ============================================================
// astrocartography.ts — Lignes planétaires (AstroCartoGraphy) + parans
// ------------------------------------------------------------
// ASTROCARTOGRAPHY-V1
//
// Module de calcul PUR, indépendant du moteur d'éphémérides. Il ne
// connaît que des coordonnées ÉQUATORIALES déjà calculées (ascension
// droite α + déclinaison δ, en degrés) et le temps sidéral de Greenwich
// (GST, en degrés) pour un instant donné. À partir de ça il produit, par
// corps, les quatre lignes d'angularité tracées sur une carte du monde :
//
//   • MC  — méridien (longitude constante) où le corps culmine
//   • IC  — méridien opposé (le corps passe au plus bas)
//   • AC  — courbe lever (le corps est sur l'horizon est)
//   • DC  — courbe coucher (le corps est sur l'horizon ouest)
//
// et les PARANS : les points où deux lignes (de deux corps différents)
// se croisent — les « points de pouvoir » de l'astrocartographie.
//
// Géométrie (instant fixe, donc GST constant) :
//   MC : longitude géo  λ_MC = wrap(α − GST)            ← verticale
//   IC : λ_IC = wrap(λ_MC + 180)
//   AC/DC, par latitude φ où la planète n'est pas circumpolaire
//   (|tanφ·tanδ| ≤ 1) :
//       H      = acos(−tanφ · tanδ)        (angle horaire, 0..180°)
//       λ_DC  = wrap(α + H − GST)          (coucher, horizon ouest)
//       λ_AC  = wrap(α − H − GST)          (lever,  horizon est)
//
// Convention longitude : Est positif, plage (−180, 180].
// Aucune dépendance externe : testable en isolation totale.
// ============================================================

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Normalise un angle dans [0, 360). */
function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/** Normalise une longitude dans (−180, 180]. */
export function wrap180(x: number): number {
  const v = norm360(x + 180) - 180;
  return v;
}

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

/** Coordonnées équatoriales d'un corps (degrés). */
export interface EquatorialCoord {
  /** Ascension droite α, 0–360°. */
  ra: number;
  /** Déclinaison δ, −90 à +90°. */
  dec: number;
}

/** Corps céleste avec sa clé + ses coordonnées équatoriales. */
export interface EquatorialBody extends EquatorialCoord {
  key: string;
}

/** Point géographique (degrés). lng : Est positif, (−180, 180]. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export type AngleType = "MC" | "IC" | "AC" | "DC";

/** Les 4 lignes d'angularité d'un corps. */
export interface BodyLines {
  key: string;
  /** Longitude du méridien MC (culmination). */
  mcLng: number;
  /** Longitude du méridien IC. */
  icLng: number;
  /** Courbe lever (échantillonnée du nord au sud). */
  asc: GeoPoint[];
  /** Courbe coucher. */
  dsc: GeoPoint[];
}

/** Un croisement de deux lignes = un paran (point de pouvoir). */
export interface Paran {
  aKey: string;
  bKey: string;
  aAngle: AngleType;
  bAngle: AngleType;
  /** Latitude du croisement. */
  lat: number;
  /** Longitude du croisement. */
  lng: number;
}

export interface AcgOptions {
  /** Latitude minimale échantillonnée (défaut −66, limite circumpolaire usuelle). */
  latMin?: number;
  /** Latitude maximale (défaut +66). */
  latMax?: number;
  /** Pas d'échantillonnage en degrés (défaut 1.5). */
  latStep?: number;
}

const DEFAULTS: Required<AcgOptions> = { latMin: -66, latMax: 66, latStep: 1.5 };

// ──────────────────────────────────────────────────────────
// Conversion écliptique → équatorial
// ──────────────────────────────────────────────────────────

/**
 * Convertit des coordonnées écliptiques (longitude λ, latitude β, degrés)
 * en coordonnées équatoriales (α, δ) pour une obliquité ε (degrés).
 *
 *   α = atan2(sinλ·cosε − tanβ·sinε, cosλ)
 *   δ = asin(sinβ·cosε + cosβ·sinε·sinλ)
 *
 * β compte vraiment pour la Lune (±5°) et les planètes à forte latitude
 * écliptique (Pluton ±17°) — ne JAMAIS supposer β = 0 sauf pour le Soleil.
 */
export function eclipticToEquatorial(
  lonDeg: number,
  latDeg: number,
  oblDeg: number,
): EquatorialCoord {
  const l = lonDeg * DEG;
  const b = latDeg * DEG;
  const e = oblDeg * DEG;

  const sinl = Math.sin(l);
  const ra = Math.atan2(
    sinl * Math.cos(e) - Math.tan(b) * Math.sin(e),
    Math.cos(l),
  );
  const dec = Math.asin(
    Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * sinl,
  );

  return { ra: norm360(ra * RAD), dec: dec * RAD };
}

// ──────────────────────────────────────────────────────────
// Lignes d'angularité
// ──────────────────────────────────────────────────────────

/**
 * Calcule les 4 lignes d'angularité d'un corps, pour un GST (degrés) donné.
 */
export function bodyLines(
  body: EquatorialBody,
  gstDeg: number,
  opts: AcgOptions = {},
): BodyLines {
  const { latMin, latMax, latStep } = { ...DEFAULTS, ...opts };
  const { ra, dec } = body;

  // Blindage : des coordonnées non finies (RA/Dec NaN) propageraient des NaN
  // dans tout le pipeline et — pire — feraient échouer les gardes de
  // segIntersect (NaN < seuil = false), explosant findParans. On refuse net.
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) {
    return { key: body.key, mcLng: NaN, icLng: NaN, asc: [], dsc: [] };
  }

  const mcLng = wrap180(ra - gstDeg);
  const icLng = wrap180(mcLng + 180);

  const asc: GeoPoint[] = [];
  const dsc: GeoPoint[] = [];
  const tanDec = Math.tan(dec * DEG);

  for (let lat = latMax; lat >= latMin - 1e-9; lat -= latStep) {
    const cosH = -Math.tan(lat * DEG) * tanDec;
    if (cosH < -1 || cosH > 1) continue; // circumpolaire : ni lever ni coucher
    const H = Math.acos(cosH) * RAD;
    asc.push({ lat, lng: wrap180(ra - H - gstDeg) });
    dsc.push({ lat, lng: wrap180(ra + H - gstDeg) });
  }

  return { key: body.key, mcLng, icLng, asc, dsc };
}

/** Calcule les lignes de tous les corps. */
export function computeAcgLines(
  bodies: EquatorialBody[],
  gstDeg: number,
  opts: AcgOptions = {},
): BodyLines[] {
  return bodies.map((b) => bodyLines(b, gstDeg, opts));
}

// ──────────────────────────────────────────────────────────
// Parans (croisements de lignes)
// ──────────────────────────────────────────────────────────

interface Pt {
  x: number; // lng
  y: number; // lat
}

/** Une ligne d'angularité, exprimée comme polyligne (lng, lat). */
interface NamedPoly {
  key: string;
  angle: AngleType;
  pts: Pt[];
}

const MERIDIAN_LAT = 85;

/** Construit les 4 polylignes d'un corps (MC/IC verticales, AC/DC courbes). */
function bodyPolys(l: BodyLines): NamedPoly[] {
  return [
    { key: l.key, angle: "MC", pts: [{ x: l.mcLng, y: MERIDIAN_LAT }, { x: l.mcLng, y: -MERIDIAN_LAT }] },
    { key: l.key, angle: "IC", pts: [{ x: l.icLng, y: MERIDIAN_LAT }, { x: l.icLng, y: -MERIDIAN_LAT }] },
    { key: l.key, angle: "AC", pts: l.asc.map((p) => ({ x: p.lng, y: p.lat })) },
    { key: l.key, angle: "DC", pts: l.dsc.map((p) => ({ x: p.lng, y: p.lat })) },
  ];
}

/** Intersection de deux segments [a,b] et [c,d]. null si pas de croisement. */
function segIntersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const rx = b.x - a.x, ry = b.y - a.y;
  const sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  // `!(Math.abs(den) >= 1e-12)` est vrai aussi quand den est NaN — sans ça,
  // des coordonnées NaN passeraient toutes les gardes (NaN < x = false) et
  // chaque paire de segments produirait un faux croisement → explosion.
  if (!(Math.abs(den) >= 1e-12)) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  if (!(t >= 0 && t <= 1 && u >= 0 && u <= 1)) return null;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

/**
 * Découpe une polyligne aux sauts d'antiméridien (|Δlng| > 180) pour ne
 * pas créer de faux segments traversant toute la carte.
 */
function splitSegments(pts: Pt[]): Pt[][] {
  const segs: Pt[][] = [];
  let cur: Pt[] = [];
  let prev: Pt | null = null;
  for (const p of pts) {
    if (prev && Math.abs(p.x - prev.x) > 180) {
      if (cur.length) segs.push(cur);
      cur = [];
    }
    cur.push(p);
    prev = p;
  }
  if (cur.length) segs.push(cur);
  return segs;
}

/**
 * Trouve tous les parans : croisements entre lignes de corps DIFFÉRENTS.
 * Dédoublonne les croisements quasi-identiques (même paire de corps à
 * < `dedupDeg` degrés l'un de l'autre).
 */
export function findParans(
  lines: BodyLines[],
  dedupDeg = 1.5,
): Paran[] {
  const polysByBody = lines.map(bodyPolys);
  const out: Paran[] = [];

  for (let i = 0; i < polysByBody.length; i++) {
    for (let j = i + 1; j < polysByBody.length; j++) {
      for (const la of polysByBody[i]!) {
        for (const lb of polysByBody[j]!) {
          const segsA = splitSegments(la.pts);
          const segsB = splitSegments(lb.pts);
          for (const sa of segsA) {
            for (let k = 0; k < sa.length - 1; k++) {
              for (const sb of segsB) {
                for (let m = 0; m < sb.length - 1; m++) {
                  const x = segIntersect(sa[k]!, sa[k + 1]!, sb[m]!, sb[m + 1]!);
                  if (!x) continue;
                  out.push({
                    aKey: la.key, bKey: lb.key,
                    aAngle: la.angle, bAngle: lb.angle,
                    lat: x.y, lng: x.x,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // dédoublonnage : même paire de corps + même paire d'angles, proches
  const kept: Paran[] = [];
  for (const p of out) {
    const dup = kept.some(
      (q) =>
        q.aKey === p.aKey && q.bKey === p.bKey &&
        q.aAngle === p.aAngle && q.bAngle === p.bAngle &&
        Math.abs(q.lat - p.lat) < dedupDeg && Math.abs(q.lng - p.lng) < dedupDeg,
    );
    if (!dup) kept.push(p);
  }
  return kept;
}

// ASTROCARTOGRAPHY-V1 applied

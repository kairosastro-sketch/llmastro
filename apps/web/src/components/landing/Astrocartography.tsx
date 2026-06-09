// ============================================================
// ASTROCARTOGRAPHY-V1 — Carte générale du jour (landing, sous le hero)
// ------------------------------------------------------------
// Lit /public/ephemeris/astrocartography (lignes AC/MC/DC/IC + parans
// déjà calculés côté serveur, en {lat,lng}). Le composant ne fait que
// projeter et dessiner — aucun recalcul de géométrie.
//
// Rôle (décision produit) : HOOK ÉDITORIAL du jour — carte vivante +
// accroche calculée (qui culmine sur quelle région) + interactivité
// légère (toggles + clic ligne → interprétation) + CTA vers la carte
// PERSONNELLE (la vraie valeur pour un connaisseur — lot 5).
// ============================================================

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import styles from "./astrocartography.module.css";

// ── Types (forme du payload de l'endpoint) ──────────────────
interface GeoPoint { lat: number; lng: number; }
interface Line {
  key: string;
  mcLng: number;
  icLng: number;
  asc: GeoPoint[];
  dsc: GeoPoint[];
}
interface Body { key: string; ra: number; dec: number; }
interface AcgPayload {
  date: string;
  gst: number;
  bodies: Body[];
  lines: Line[];
  parans: unknown[];
}

const REFETCH_MS = 10 * 60 * 1000;
const W = 1000, H = 500;

// ── Corps : glyphe, couleur (mutée), nom, défaut, mot-clé ────
interface PlanetMeta {
  key: string; name: string; glyph: string; color: string; on: boolean; word: string;
}
const PLANETS: PlanetMeta[] = [
  { key: "sun",     name: "Soleil",  glyph: "☉", color: "#e6b85c", on: true,  word: "Rayonnement" },
  { key: "moon",    name: "Lune",    glyph: "☽", color: "#c8d2ea", on: true,  word: "Appartenance" },
  { key: "venus",   name: "Vénus",   glyph: "♀", color: "#e0a6bd", on: true,  word: "Douceur" },
  { key: "mars",    name: "Mars",    glyph: "♂", color: "#d18a72", on: true,  word: "Élan" },
  { key: "jupiter", name: "Jupiter", glyph: "♃", color: "#d9b878", on: true,  word: "Expansion" },
  { key: "mercury", name: "Mercure", glyph: "☿", color: "#8fc7c0", on: false, word: "Échanges" },
  { key: "saturn",  name: "Saturne", glyph: "♄", color: "#a99ac9", on: false, word: "Structure" },
  { key: "uranus",  name: "Uranus",  glyph: "♅", color: "#9ec7d8", on: false, word: "Rupture" },
  { key: "neptune", name: "Neptune", glyph: "♆", color: "#8aa6d6", on: false, word: "Rêve" },
  { key: "pluto",   name: "Pluton",  glyph: "♇", color: "#b08fb0", on: false, word: "Mue" },
];
const META = (k: string) => PLANETS.find((p) => p.key === k);

const ANGLE_NAMES: Record<string, string> = {
  MC: "Ligne du Milieu du Ciel", IC: "Ligne du Fond du Ciel",
  AC: "Ligne de l’Ascendant",    DC: "Ligne du Descendant",
};

// Interprétations courtes (clic ligne). Fallback générique.
const COPY: Record<string, string> = {
  "sun|MC": "Là où le Soleil culmine, on se sent vu, légitime, en pleine lumière. Un axe de vocation et de rayonnement public.",
  "moon|MC": "La Lune au zénith colore le lieu d’émotion et d’intériorité. On y ressent plus, on y cherche un foyer.",
  "venus|MC": "Vénus culmine : on y est perçu·e avec grâce. Lieu propice à l’amour, au goût, à la reconnaissance par ce qu’on aime.",
  "venus|AC": "Sur cette ligne, Vénus colore l’abord même : on y arrive plus doux·ce, les rencontres s’y font sans effort.",
  "mars|MC": "Mars au Milieu du Ciel : énergie d’action et d’affirmation. Lieu de conquête, parfois de friction.",
  "jupiter|MC": "Jupiter culmine : portes qui s’ouvrent, mentors, croissance. La ligne de l’ambition récompensée.",
  "jupiter|AC": "Jupiter se lève : optimisme et opportunités à l’abord. On y respire plus large.",
  _default: "Sur cette ligne, ce corps devient angulaire — son thème s’y exprime avec une intensité particulière.",
};

// ── Villes-repères (lon, lat) ───────────────────────────────
const CITIES: [string, number, number][] = [
  ["Los Angeles", -118, 34], ["New York", -74, 40.7], ["Rio", -43, -23],
  ["Londres", -0.1, 51.5], ["Paris", 2.3, 48.9], ["Lagos", 3.4, 6.5],
  ["Le Caire", 31, 30], ["Moscou", 37.6, 55.7], ["Mumbai", 72.8, 19],
  ["Pékin", 116, 39.9], ["Tokyo", 139.7, 35.7], ["Sydney", 151, -33.9],
  ["Le Cap", 18.4, -33.9],
];

// ── Continents stylisés (faibles, repère visuel) ────────────
const CONT: Record<string, [number, number][]> = {
  na: [[-165,60],[-150,58],[-140,68],[-120,69],[-95,70],[-82,73],[-60,58],[-52,47],[-66,45],[-72,40],[-80,33],[-81,25],[-90,29],[-97,26],[-100,18],[-110,23],[-118,33],[-124,40],[-130,50],[-135,55],[-150,55],[-165,60]],
  sa: [[-78,8],[-70,12],[-62,10],[-50,0],[-44,-3],[-38,-12],[-40,-22],[-48,-25],[-58,-35],[-66,-45],[-72,-52],[-74,-50],[-71,-30],[-78,-18],[-81,-6],[-80,2],[-84,7],[-78,8]],
  eur: [[-10,36],[-9,43],[-2,48],[2,51],[-4,58],[5,62],[12,65],[20,68],[28,60],[24,56],[18,55],[12,54],[10,48],[6,46],[8,44],[3,43],[-5,36],[-10,36]],
  afr: [[-16,28],[-10,32],[0,36],[10,34],[20,32],[32,31],[43,12],[51,12],[42,-2],[40,-15],[33,-24],[27,-34],[20,-35],[18,-30],[12,-18],[9,-2],[5,5],[-8,5],[-12,12],[-16,20],[-16,28]],
  asia: [[28,60],[45,66],[60,70],[78,73],[100,76],[120,73],[140,72],[160,68],[178,66],[170,60],[155,57],[143,48],[135,44],[130,35],[122,30],[120,22],[108,18],[100,8],[95,15],[90,22],[80,8],[77,8],[72,20],[60,25],[52,28],[48,38],[40,42],[33,45],[40,50],[35,55],[30,58],[28,60]],
  aus: [[114,-22],[122,-18],[130,-12],[137,-12],[142,-11],[146,-18],[150,-25],[153,-30],[148,-38],[140,-38],[131,-32],[125,-34],[118,-35],[114,-30],[114,-22]],
};

// ── Helpers de projection ───────────────────────────────────
const wrap = (l: number) => ((l + 540) % 360) - 180;
const px = (lng: number) => (wrap(lng) + 180) / 360 * W;
const py = (lat: number) => (90 - lat) / 180 * H;

/** Polyligne {lat,lng} → path SVG, découpée à l'antiméridien. */
function pathFromGeo(pts: GeoPoint[]): string {
  let segs: string[] = [], cur: string[] = [], prevX: number | null = null;
  for (const p of pts) {
    const x = px(p.lng), y = py(p.lat);
    if (prevX !== null && Math.abs(x - prevX) > W / 2) { if (cur.length) segs.push(cur.join(" ")); cur = []; }
    cur.push(`${cur.length ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
    prevX = x;
  }
  if (cur.length) segs.push(cur.join(" "));
  return segs.join(" ");
}

/** "de douceur" / "d'expansion" — élision devant voyelle/h. */
function deElide(word: string): string {
  return /^[aeiouyàâäéèêëîïôöûüh]/i.test(word) ? `d'${word}` : `de ${word}`;
}

function nearestCity(lng: number): string {
  let best = CITIES[0]!, bd = 1e9;
  for (const c of CITIES) {
    const d = Math.abs(wrap(c[1] - lng));
    if (d < bd) { bd = d; best = c; }
  }
  return best[0];
}

export function Astrocartography() {
  const { data: res, isLoading, isError } = useQuery({
    queryKey: ["public-astrocartography"],
    queryFn: () => apiClient.get<AcgPayload>("/public/ephemeris/astrocartography"),
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry: 1,
  });
  const acg = (res as { data?: AcgPayload } | undefined)?.data;

  // Corps activés (défaut : luminaires + Vénus/Mars/Jupiter)
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(PLANETS.filter((p) => p.on).map((p) => p.key)),
  );
  const [selected, setSelected] = useState<string | null>(null); // "key|angle"

  const lineByKey = useMemo(() => {
    const m = new Map<string, Line>();
    acg?.lines.forEach((l) => m.set(l.key, l));
    return m;
  }, [acg]);

  // Accroche éditoriale : Soleil + bénéfiques au zénith de quelle ville.
  // Les corps qui culminent au MÊME endroit (RA proches = conjonction) sont
  // regroupés → « Vénus et Jupiter culminent ensemble au-dessus de Londres ».
  const accroche = useMemo<{ metas: PlanetMeta[]; city: string }[]>(() => {
    if (!acg) return [];
    const groups: { metas: PlanetMeta[]; city: string; mcLng: number }[] = [];
    for (const k of ["sun", "venus", "jupiter"]) {
      const l = lineByKey.get(k); const m = META(k);
      if (!l || !m) continue;
      const city = nearestCity(l.mcLng);
      // même ville + longitudes MC proches (<8°) = conjonction → on regroupe
      const g = groups.find((g) => g.city === city && Math.abs(wrap(g.mcLng - l.mcLng)) < 8);
      if (g) g.metas.push(m);
      else groups.push({ metas: [m], city, mcLng: l.mcLng });
    }
    return groups.map((g) => ({ metas: g.metas, city: g.city }));
  }, [acg, lineByKey]);

  return (
    <section className={styles.module} aria-label="Cartographie céleste du jour">
      <header className={styles.header}>
        <span className={styles.eyebrow}>✦ Le ciel sur Terre, maintenant</span>
        <h2 className={styles.title}>Cartographie céleste du jour</h2>
        {accroche.length > 0 && (
          <p className={styles.accroche}>
            En ce moment, {accroche.map((g, i) => {
              const sep = i < accroche.length - 1 ? (i === accroche.length - 2 ? " et " : ", ") : ".";
              const conj = g.metas.length > 1;
              return (
                <span key={g.metas.map((m) => m.key).join("-")}>
                  {g.metas.map((m, j) => (
                    <span key={m.key}>
                      <span className={styles.glyph} style={{ color: m.color }}>{m.glyph}</span>
                      {j < g.metas.length - 1 ? "" : " "}
                    </span>
                  ))}
                  <b>{g.metas.map((m) => m.name).join(" et ")}</b>{" "}
                  {conj ? "culminent ensemble au-dessus de " : "culmine à la verticale de "}
                  <b>{g.city}</b>
                  {conj && (
                    <span> — une rencontre {g.metas.map((m) => deElide(m.word.toLowerCase())).join(" et ")}</span>
                  )}
                  {sep}
                </span>
              );
            })}
            {" "}Vos lignes, elles, sont écrites dans votre ciel de naissance.
          </p>
        )}
      </header>

      <div className={styles.card}>
        {isLoading && <div className={styles.loading}><div className="spinner" aria-hidden /></div>}
        {isError && <div className={styles.error}>Le ciel reste mystérieux pour l’instant. Revenez dans un moment.</div>}

        {acg && !isLoading && (
          <svg className={styles.map} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
               role="img" aria-label="Lignes planétaires du moment sur une carte du monde">
            <defs>
              <radialGradient id="acgOcean" cx="50%" cy="38%" r="75%">
                <stop offset="0%" stopColor="#11142f" />
                <stop offset="100%" stopColor="#0a0b1d" />
              </radialGradient>
              <filter id="acgGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3.5" />
              </filter>
            </defs>

            <rect width={W} height={H} fill="url(#acgOcean)" />

            {/* graticule */}
            <g>
              {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map((lon) => (
                <line key={`v${lon}`} x1={px(lon)} y1={0} x2={px(lon)} y2={H}
                      stroke="rgba(184,166,224,.08)" strokeWidth={1} />
              ))}
              {[-60,-30,0,30,60].map((lat) => (
                <line key={`h${lat}`} x1={0} y1={py(lat)} x2={W} y2={py(lat)}
                      stroke={lat === 0 ? "rgba(184,166,224,.16)" : "rgba(184,166,224,.08)"} strokeWidth={1} />
              ))}
            </g>

            {/* continents */}
            <g>
              {Object.entries(CONT).map(([k, poly]) => (
                <path key={k} d={`${pathFromGeo(poly.map(([lo, la]) => ({ lat: la, lng: lo })))} Z`}
                      fill="rgba(150,162,214,.14)" stroke="rgba(186,196,240,.26)" strokeWidth={1} strokeLinejoin="round" />
              ))}
            </g>

            {/* villes */}
            <g>
              {CITIES.map(([n, lo, la]) => {
                const x = px(lo), y = py(la), flip = x > W - 90;
                return (
                  <g key={n}>
                    <circle cx={x} cy={y} r={1.6} fill="#c2c8e6" />
                    <text className={styles.cityName} x={x + (flip ? -4 : 4)} y={y + 3}
                          textAnchor={flip ? "end" : "start"}>{n}</text>
                  </g>
                );
              })}
            </g>

            {/* lignes planétaires (corps activés) */}
            <g>
              {acg.lines.filter((l) => enabled.has(l.key)).map((l) => {
                const m = META(l.key); if (!m) return null;
                const angles: { code: string; d: string; dash: boolean; topX: number; topY: number }[] = [
                  { code: "MC", d: `M${px(l.mcLng)},${py(84)} L${px(l.mcLng)},${py(-84)}`, dash: false, topX: px(l.mcLng), topY: py(84) },
                  { code: "IC", d: `M${px(l.icLng)},${py(84)} L${px(l.icLng)},${py(-84)}`, dash: false, topX: px(l.icLng), topY: py(84) },
                  { code: "AC", d: pathFromGeo(l.asc), dash: true, topX: l.asc[0] ? px(l.asc[0].lng) : 0, topY: l.asc[0] ? py(l.asc[0].lat) : 0 },
                  { code: "DC", d: pathFromGeo(l.dsc), dash: true, topX: l.dsc[0] ? px(l.dsc[0].lng) : 0, topY: l.dsc[0] ? py(l.dsc[0].lat) : 0 },
                ];
                return angles.map((a) => {
                  const id = `${l.key}|${a.code}`;
                  const sel = selected === id;
                  return (
                    <g key={id} className={styles.acgLine} onClick={() => setSelected(sel ? null : id)}>
                      {sel && <path d={a.d} fill="none" stroke={m.color} strokeWidth={6} opacity={0.22} filter="url(#acgGlow)" />}
                      <path d={a.d} fill="none" stroke={m.color} strokeWidth={sel ? 2.4 : 1.6}
                            opacity={sel ? 1 : 0.85} strokeLinecap="round"
                            strokeDasharray={a.dash ? "6 5" : undefined} />
                      <text className={styles.lineLabel} x={a.topX} y={a.topY - 4} textAnchor="middle"
                            fill={m.color} opacity={sel ? 1 : 0.8}>{m.glyph} {a.code}</text>
                    </g>
                  );
                });
              })}
            </g>
          </svg>
        )}
        <div className={styles.vignette} />

        {/* légende / toggles */}
        {acg && !isLoading && (
          <div className={styles.legend}>
            {PLANETS.map((p) => {
              const on = enabled.has(p.key);
              return (
                <button key={p.key} type="button"
                        className={`${styles.chip} ${on ? styles.chipOn : styles.chipOff}`}
                        aria-pressed={on}
                        onClick={() => setEnabled((s) => {
                          const n = new Set(s);
                          if (n.has(p.key)) n.delete(p.key); else n.add(p.key);
                          return n;
                        })}>
                  <span className={styles.chipDot} style={{ color: p.color }} />
                  <span className={styles.chipGlyph} style={{ color: p.color }}>{p.glyph}</span>
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* panneau interprétation (clic ligne) */}
      {selected && (() => {
        const [pk, an] = selected.split("|");
        const m = META(pk!); const line = lineByKey.get(pk!);
        if (!m || !line) return null;
        const lng = an === "MC" ? line.mcLng : an === "IC" ? line.icLng
          : an === "AC" ? (line.asc[Math.floor(line.asc.length / 2)]?.lng ?? line.mcLng)
          : (line.dsc[Math.floor(line.dsc.length / 2)]?.lng ?? line.mcLng);
        return (
          <div className={styles.panel}>
            <div className={styles.panelBadge}
                 style={{ color: m.color, background: `radial-gradient(circle at 50% 40%, ${m.color}33, transparent 70%)` }}>
              {m.glyph}
            </div>
            <div>
              <p className={styles.panelTitle}>{m.name} · {an}</p>
              <p className={styles.panelAngle}>{ANGLE_NAMES[an!]}</p>
              <p className={styles.panelBody}>{COPY[`${pk}|${an}`] ?? COPY._default}</p>
              <p className={styles.panelCities}>Passe près de <b>{nearestCity(lng)}</b></p>
            </div>
          </div>
        );
      })()}

      {acg && (
        <p className={styles.hint}>
          Touchez une ligne pour la lire. <b>MC/IC</b> : l’astre culmine / passe au plus bas. <b>AC/DC</b> : il se lève / se couche.
        </p>
      )}

      {/* CTA vers la carte personnelle (lot 5) */}
      <div className={styles.cta}>
        <p className={styles.ctaText}>
          Ceci est le ciel du moment, partagé par tous.<br />
          <b>Votre</b> carte, elle, naît de votre ciel de naissance — vos lignes à vous, pour toujours.
        </p>
        <Link href="/auth/register" className={styles.ctaBtn}>Révéler ma carte personnelle →</Link>
      </div>
    </section>
  );
}

// ============================================================
// apps/web/src/components/ciel/ThemeSky3D.tsx
// THEME-SKY3D-V1 · SKY3D-ASTRO-READ-V1
// ------------------------------------------------------------
// Bi-roue céleste 3D PERSONNELLE (thème utilisateur) : le thème
// natal est FIXE (anneau interne) et les planètes en TRANSIT
// balaient la période de la cadence (jour/semaine/mois/an) sur
// l'anneau externe. Les aspects transit → natal s'allument au fil
// du balayage.
//
// - Réutilise le pattern éprouvé de CielSky3D (three vendorisé
//   same-origin/CSP, rendu impératif rAF, fixes WebGL mobile).
// - Les positions de transit viennent de /public/sky/:cadence/frames
//   (le ciel est universel → mêmes frames que /ciel). Le natal est
//   passé en prop (statique, calculé serveur côté page transits).
// - Mobile-first : tap = tooltip, drag = rotation, pinch = zoom.
//
// SKY3D-ASTRO-READ-V1 — lisibilité astrologue :
// - sens zodiacal ANTIHORAIRE (aligné roue 2D vérifiée vs ciel réel) ;
// - roue orientée sur l'Ascendant (Asc à 9 h, toggle, ON par défaut) ;
// - 12 cuspides de maisons natales + angles AC/MC/DC/IC + numéros I-XII
//   (toggle « Maisons », tooltips nom/mots-clés/cuspide) ;
// - halo OR = natal / VIOLET = transit (la légende devient vraie) ;
// - bouton « 2D/3D » : bascule animée vue à plat ↔ vue inclinée.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";

import {
  ROMAN, HOUSE_NAMES_FR, HOUSE_KEYWORDS_FR,
} from "@/lib/astro/house-names";

const API = process.env["NEXT_PUBLIC_API_URL"] || "";
// Chemin runtime same-origin du build three vendorisé (identique à CielSky3D).
// Référencé via une VARIABLE pour que tsc ne tente pas de le résoudre (TS2307) ;
// les magic comments neutralisent le bundler.
const THREE_URL = "/vendor/three-0.160.0.module.min.js";

// ── métadonnées d'affichage (miroir de CielSky3D + mineurs/nœuds) ──
const GLYPH: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
  // SKY3D-MINORS-V1
  chiron: "⚷", ceres: "⚳", pallas: "⚴", juno: "⚵", vesta: "⚶",
  lilith: "⚸", lilithTrue: "⚸", northNode: "☊", southNode: "☋", fortune: "⊕",
};
const COLOR: Record<string, number> = {
  sun: 0xffd27f, moon: 0xcfd8ff, mercury: 0xb6f0ff, venus: 0xffc8e6, mars: 0xff9b8a,
  jupiter: 0xffe1a8, saturn: 0xd8c9a8, uranus: 0x9ff0e0, neptune: 0xa8c4ff, pluto: 0xd0a8ff,
  // SKY3D-MINORS-V1 — teintes douces (miroir CielSky3D)
  chiron: 0xc9b8ff, ceres: 0xb8e6c0, pallas: 0xcfe0ff, juno: 0xffd0e0, vesta: 0xffe6b0,
  lilith: 0xbcaccc, lilithTrue: 0xbcaccc, northNode: 0xffdf9e, southNode: 0xcfc3ab, fortune: 0xd8cbaa,
};
const PMETA: Record<string, [string, string]> = {
  sun: ["Soleil", "identité · vitalité"], moon: ["Lune", "émotions · intuition"],
  mercury: ["Mercure", "pensée · communication"], venus: ["Vénus", "amour · esthétique"],
  mars: ["Mars", "action · désir"], jupiter: ["Jupiter", "expansion · confiance"],
  saturn: ["Saturne", "structure · responsabilité"], uranus: ["Uranus", "rupture · liberté"],
  neptune: ["Neptune", "rêve · idéal"], pluto: ["Pluton", "transformation · pouvoir"],
  // SKY3D-MINORS-V1
  chiron: ["Chiron", "blessure · guérison"], ceres: ["Cérès", "nourrir · cycles"],
  pallas: ["Pallas", "stratégie · sagesse"], juno: ["Junon", "engagement · alliances"],
  vesta: ["Vesta", "dévotion · feu sacré"], lilith: ["Lilith", "instinct · liberté"],
  lilithTrue: ["Lilith vraie", "instinct · liberté"],
  northNode: ["Nœud Nord", "direction · croissance"],
  southNode: ["Nœud Sud", "acquis · mémoire"],
  fortune: ["Part de Fortune", "chance · fluidité"],
};
// Les 10 corps classiques — alignés sur la roue 2D et le moteur de frames.
const MAJORS = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
];
// SKY3D-MINORS-V1 : corps mineurs affichables (case « Astres mineurs »,
// décochée par défaut comme partout dans l'app). L'intersection avec les
// données réellement disponibles (frames côté transit, natal.lon côté natal)
// décide de ce qui est instancié. Aspects : majeurs ↔ majeurs uniquement,
// comme la grille natale V1 (astéroïdes hors grille).
const MINORS_3D = [
  "chiron", "ceres", "pallas", "juno", "vesta",
  "lilith", "lilithTrue", "northNode", "southNode", "fortune",
];
const SIGN_GLYPH = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
const SIGN_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge",
                 "Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
const SIGN_COLOR = [0xff8a6b,0x9fd08a,0xfff0a8,0x8fd0ff,0xff8a6b,0x9fd08a,
                    0xfff0a8,0x8fd0ff,0xff8a6b,0x9fd08a,0xfff0a8,0x8fd0ff];
const SIGN_ELEM = ["Feu","Terre","Air","Eau","Feu","Terre","Air","Eau","Feu","Terre","Air","Eau"];
const SIGN_KW = ["initiative","sensualité","curiosité","sensibilité","rayonnement","analyse",
                 "harmonie","intensité","aventure","ambition","innovation","imagination"];
// SKY3D-ASTRO-READ-V1 : couleurs des repères natal (or) / transit (violet) —
// mêmes valeurs que la légende et les cercles-pistes, pour un codage unique.
const NATAL_HEX = 0xc9a84c;
const TRANSIT_HEX = 0xb9acff;
const ANGLE_HEX = 0xffe9a8;
const ANGLE_META: Record<string, [string, string]> = {
  AC: ["Ascendant", "horizon est · le Soi qui se présente"],
  DC: ["Descendant", "horizon ouest · la rencontre de l'autre"],
  MC: ["Milieu du Ciel", "zénith · vocation, image publique"],
  IC: ["Fond du Ciel", "nadir · racines, intimité"],
};
const ASPECTS = [
  { angle: 0,   orb: 8, color: 0xffffff, name: "Conjonction", tone: "Conjonction" },
  { angle: 60,  orb: 4, color: 0x8fffd0, name: "Sextile",     tone: "Aspect harmonique" },
  { angle: 90,  orb: 6, color: 0xff7a7a, name: "Carré",       tone: "Aspect tendu" },
  { angle: 120, orb: 6, color: 0x9fd0ff, name: "Trigone",     tone: "Aspect harmonique" },
  { angle: 180, orb: 8, color: 0xff5fa0, name: "Opposition",  tone: "Aspect tendu" },
];

interface SkyFrame { t: string; lon: Record<string, number>; }
interface FramesPayload {
  cadence: "day" | "week" | "month" | "year";
  periodStart: string; periodEnd: string;
  bodies: string[]; frames: SkyFrame[];
  /** SKY3D-MINORS-V1 : sous-ensemble optionnel de `bodies` (case à cocher). */
  minors?: string[];
}
export interface NatalInput {
  /** longitude écliptique natale (0-360) par corps (majeurs). */
  lon: Record<string, number>;
  /** ascendant natal (0-360), optionnel — oriente la roue + axe AC/DC. */
  asc?: number;
  /** Milieu du Ciel natal (0-360), optionnel — axe MC/IC (sinon cuspide X). */
  mc?: number;
  /** 12 cuspides de maisons natales domifiées (longitudes 0-360), optionnel. */
  houses?: number[];
  /** rétrogradation natale par corps — affichée au tooltip. */
  retro?: Record<string, boolean>;
}

let _webglOK: boolean | null = null;
function hasWebGL(): boolean {
  if (_webglOK !== null) return _webglOK;
  try {
    const c = document.createElement("canvas");
    const gl: any = c.getContext("webgl") || c.getContext("experimental-webgl");
    _webglOK = !!(window.WebGLRenderingContext && gl);
    gl?.getExtension?.("WEBGL_lose_context")?.loseContext?.();
  } catch { _webglOK = false; }
  return _webglOK;
}

// interpolation de longitude par l'arc le plus court
function lerpLon(a: number, b: number, t: number): number {
  const d = (((b - a) % 360) + 540) % 360 - 180;
  return ((a + d * t) % 360 + 360) % 360;
}
function sep(a: number, b: number): number { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

export function ThemeSky3D(
  { cadence, natal, profileLabel, onUnavailable }: {
    cadence: FramesPayload["cadence"];
    natal: NatalInput;
    profileLabel?: string;
    onUnavailable?: () => void;
  },
) {
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  // natal capté dans un ref : la scène est reconstruite à chaque changement de
  // cadence (dépendance `state`), mais on lit toujours le natal courant.
  const natalRef = useRef(natal);
  natalRef.current = natal;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const playRef = useRef<HTMLButtonElement | null>(null);
  const speedRef = useRef<HTMLSelectElement | null>(null);
  const flatRef = useRef<HTMLButtonElement | null>(null); // SKY3D-ASTRO-READ-V1

  const [state, setState] = useState<"loading" | "ready" | "skip">("loading");
  const framesRef = useRef<FramesPayload | null>(null);

  // SKY3D-ASTRO-READ-V1 : toggles HUD lus par la boucle rAF via ref (pas de
  // rebuild de scène) ; l'état React ne sert qu'au rendu des cases.
  const hudRef = useRef({ houses: true, orient: true, minors: false });
  const [hudHouses, setHudHouses] = useState(true);
  const [hudOrient, setHudOrient] = useState(true);
  const [hudMinors, setHudMinors] = useState(false); // SKY3D-MINORS-V1
  const [framesHasMinors, setFramesHasMinors] = useState(false);
  const hasHousesProp = Array.isArray(natal.houses) && natal.houses.length === 12;
  const hasAscProp = typeof natal.asc === "number";
  const natalHasMinors = MINORS_3D.some((b) => typeof natal.lon[b] === "number");
  const hasMinors = framesHasMinors || natalHasMinors;

  useEffect(() => {
    if (state === "skip") onUnavailableRef.current?.();
  }, [state]);

  // 1) WebGL + fetch des frames de transit
  useEffect(() => {
    if (!hasWebGL()) { setState("skip"); return; }
    setState("loading");
    let alive = true;
    (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {        // retry réseau mobile
        try {
          const res = await fetch(`${API}/public/sky/${cadence}/frames`, { cache: "force-cache" });
          const json = await res.json();
          if (!alive) return;
          if (json?.success && json.data?.frames?.length) {
            framesRef.current = json.data as FramesPayload;
            // SKY3D-MINORS-V1 : la case n'apparaît que si des mineurs existent
            const first = json.data.frames[0]?.lon ?? {};
            setFramesHasMinors((json.data.minors ?? [])
              .some((b: string) => first[b] !== undefined));
            setState("ready");
            return;
          }
        } catch { /* retry */ }
        if (!alive) return;
      }
      if (alive) setState("skip");
    })();
    return () => { alive = false; };
  }, [cadence]);

  // 2) scène three (bi-roue) après frames + canvas prêts
  useEffect(() => {
    if (state !== "ready") return;
    const wrap = wrapRef.current, canvas = canvasRef.current, payload = framesRef.current;
    const natalNow = natalRef.current;
    if (!wrap || !canvas || !payload) return;

    let disposed = false;
    let raf = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
     try {
      const THREE: any = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ THREE_URL);
      if (disposed) return;

      // corps réellement disponibles — majeurs (toujours) / mineurs (option).
      // SKY3D-MINORS-V1 : les aspects restent majeurs ↔ majeurs (grille V1) ;
      // les mineurs sont des sprites d'affichage togglables.
      const firstLon = payload.frames[0].lon;
      const transitBodies = MAJORS.filter((b) => firstLon[b] !== undefined);
      const transitMinors = (payload.minors ?? [])
        .filter((b) => firstLon[b] !== undefined && !transitBodies.includes(b));
      const natalBodies = MAJORS.filter((b) => typeof natalNow.lon[b] === "number");
      const natalMinors = MINORS_3D.filter((b) => typeof natalNow.lon[b] === "number");
      const N = payload.frames.length - 1;                 // segments
      const d2r = THREE.MathUtils.degToRad;
      // 3 anneaux concentriques : natal (interne) · transit (médian) · zodiaque
      const R_NATAL = 48, R_TRANSIT = 70, R_RING = 88;

      // SKY3D-ASTRO-READ-V1 : z NÉGATIF → longitudes croissantes ANTIHORAIRES
      // à l'écran (convention des thèmes, alignée sur la roue 2D vérifiée).
      const ecl = (lon: number, r: number) => new THREE.Vector3(
        r * Math.cos(d2r(lon)), 0, -r * Math.sin(d2r(lon)),
      );
      // longitude de transit interpolée à l'instant u (index fractionnaire)
      const posAt = (b: string, u: number): number => {
        let i = Math.floor(u);
        if (!Number.isFinite(i) || i < 0) i = 0; else if (i > N - 1) i = N - 1;
        const fa = payload.frames[i], fc = payload.frames[i + 1] || fa;
        const a = fa.lon[b], c = fc.lon[b];
        if (a === undefined) return c ?? 0;
        if (c === undefined) return a;
        return lerpLon(a, c, Number.isFinite(u) ? u - i : 0);
      };
      // SKY3D-MINORS-V1 : rétrograde à l'instant u = longitude décroissante
      // (arc le plus court) entre les deux frames encadrantes. Zéro appel
      // moteur — dérivé des frames déjà chargées. Les nœuds ressortent ℞ en
      // continu : c'est leur marche canonique, la 2D fait pareil.
      const retroAt = (b: string, u: number): boolean => {
        let i = Math.floor(u);
        if (!Number.isFinite(i) || i < 0) i = 0; else if (i > N - 1) i = N - 1;
        const fa = payload.frames[i], fc = payload.frames[i + 1];
        if (!fc) return false;
        const a = fa.lon[b], c = fc.lon[b];
        if (a === undefined || c === undefined) return false;
        const d = (((c - a) % 360) + 540) % 360 - 180;
        return d < -1e-4;
      };

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07040f, 0.0016);
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const sky = new THREE.Group(); scene.add(sky);

      // ── textures procédurales (identiques à CielSky3D) ──
      const texCache: Record<string, any> = {};
      // SKY3D-ASTRO-READ-V1 : `fs` = ratio de fonte, réduit pour les textes
      // multi-caractères (numéros de maison VIII/XII, angles AC/MC…).
      const glyphTex = (g: string, hex: number, key: string, fs = 0.62) => {
        if (texCache[key]) return texCache[key];
        const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
        const x = c.getContext("2d")!;
        x.font = `${s * fs}px "Segoe UI Symbol","Noto Sans Symbols2",serif`;
        x.textAlign = "center"; x.textBaseline = "middle";
        x.shadowColor = "#" + hex.toString(16).padStart(6, "0"); x.shadowBlur = s * 0.18;
        x.fillStyle = "#fff"; x.fillText(g, s / 2, s / 2 + s * 0.04);
        const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return (texCache[key] = t);
      };
      const haloTex = (hex: number) => {
        if (texCache["h" + hex]) return texCache["h" + hex];
        const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
        const x = c.getContext("2d")!; const col = new THREE.Color(hex);
        const r = col.r * 255 | 0, g = col.g * 255 | 0, b = col.b * 255 | 0;
        const grd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grd.addColorStop(0, `rgba(${r},${g},${b},.95)`);
        grd.addColorStop(.35, `rgba(${r},${g},${b},.35)`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = grd; x.fillRect(0, 0, s, s);
        return (texCache["h" + hex] = new THREE.CanvasTexture(c));
      };
      const sprite = (tex: any, sc: number, blend: any, op = 1) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, transparent: true, blending: blend, opacity: op, depthWrite: false }));
        sp.scale.setScalar(sc); return sp;
      };

      // ── étoiles ──
      const SN = 1000, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 3);
      for (let i = 0; i < SN; i++) {
        const u = Math.random(), v = Math.random();
        const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1), rr = 380 + Math.random() * 220;
        sp[i*3] = rr*Math.sin(ph)*Math.cos(th); sp[i*3+1] = rr*Math.sin(ph)*Math.sin(th); sp[i*3+2] = rr*Math.cos(ph);
        const tt = .7 + Math.random()*.3; sc[i*3]=tt; sc[i*3+1]=tt; sc[i*3+2]=1;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
      sg.setAttribute("color", new THREE.BufferAttribute(sc, 3));
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({
        size: 1.6, sizeAttenuation: true, vertexColors: true, transparent: true,
        opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })));

      const pickables: any[] = [];        // sprites (planètes/signes)
      const aspectPickables: any[] = [];  // lignes d'aspect transit→natal (live)
      const linePickables: any[] = [];    // lignes structurelles fixes (Asc, cuspides, cercles) — tooltips

      // ── anneau zodiacal + signes ──
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(R_RING, R_RING + 14, 128),
        new THREE.MeshBasicMaterial({ color: 0x8f7fff, transparent: true, opacity: .10,
          side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; sky.add(ring);
      for (let i = 0; i < 12; i++) {
        const a = ecl(i * 30, R_RING), b = ecl(i * 30, R_RING + 14);
        // cuspide = limite entre deux signes (survolable)
        const tick = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]),
          new THREE.LineBasicMaterial({ color: 0x8f7fff, transparent: true, opacity: .22 }));
        tick.frustumCulled = false; tick.userData = { kind: "cusp", si: i };
        linePickables.push(tick); sky.add(tick);
        const s2 = sprite(glyphTex(SIGN_GLYPH[i], SIGN_COLOR[i], "s" + i), 9, THREE.NormalBlending, .9);
        s2.position.copy(ecl(i * 30 + 15, R_RING + 28));
        s2.userData = { kind: "sign", si: i }; pickables.push(s2); sky.add(s2);
      }
      // SKY3D-MINORS-V1 : graduations tous les 10° (les 30° sont déjà les
      // cuspides de signes) — repère fin pour estimer un degré à l'œil.
      for (let g = 0; g < 360; g += 10) {
        if (g % 30 === 0) continue;
        const t10 = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([ecl(g, R_RING), ecl(g, R_RING + 4)]),
          new THREE.LineBasicMaterial({ color: 0x8f7fff, transparent: true, opacity: .14 }));
        t10.frustumCulled = false; sky.add(t10);
      }
      // deux cercles-guides discrets (piste natale / piste transit)
      const trackCircle = (r: number, hex: number, op: number, kind: string) => {
        const pts: any[] = [];
        for (let i = 0; i <= 96; i++) pts.push(ecl((i / 96) * 360, r));
        const circle = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false }));
        circle.frustumCulled = false; circle.userData = { kind };
        linePickables.push(circle); sky.add(circle);
      };
      trackCircle(R_NATAL, 0xc9a84c, .16, "ring-natal");     // natal (or)
      trackCircle(R_TRANSIT, 0x8f7fff, .14, "ring-transit");  // transit (violet)
      sky.add(sprite(haloTex(0x6f5ad0), 22, THREE.AdditiveBlending, .28)); // noyau

      // ── maisons natales + angles AC/MC/DC/IC (SKY3D-ASTRO-READ-V1) ──
      const hasAsc = typeof natalNow.asc === "number";
      const cusps = Array.isArray(natalNow.houses) && natalNow.houses.length === 12
        && natalNow.houses.every((c) => typeof c === "number" && Number.isFinite(c))
        ? natalNow.houses : null;
      // groupe dédié → toggle « Maisons » sans reconstruire la scène
      const houseGroup = new THREE.Group();
      sky.add(houseGroup);
      const radialLine = (lonDeg: number, r0: number, r1: number,
        hex: number, op: number, ud: Record<string, unknown>) => {
        const l = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([ecl(lonDeg, r0), ecl(lonDeg, r1)]),
          new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: op }));
        l.frustumCulled = false; l.userData = ud;
        linePickables.push(l); houseGroup.add(l); return l;
      };
      if (cusps) {
        const ascLon = hasAsc ? natalNow.asc! : cusps[0];
        const mcLon = typeof natalNow.mc === "number" ? natalNow.mc : cusps[9];
        for (let i = 0; i < 12; i++) {
          // cuspides I/IV/VII/X ≈ angles (systèmes à quadrants) → accentuées
          const isAngle = i % 3 === 0;
          radialLine(cusps[i], isAngle ? 3 : 30, isAngle ? R_RING + 8 : R_RING,
            isAngle ? ANGLE_HEX : NATAL_HEX, isAngle ? .5 : .22, { kind: "house", hi: i });
          // numéro de maison au milieu d'arc, à l'intérieur du cercle natal
          const span = (((cusps[(i + 1) % 12] - cusps[i]) % 360) + 360) % 360 || 30;
          const num = sprite(glyphTex(ROMAN[i], NATAL_HEX, "hn" + i, 0.34), 5.5, THREE.NormalBlending, .8);
          num.position.copy(ecl(cusps[i] + span / 2, 36));
          num.userData = { kind: "house", hi: i }; pickables.push(num); houseGroup.add(num);
        }
        // labels des 4 angles — AC/DC portés par l'Asc réel, MC/IC par le vrai MC
        const angles: Array<[string, number]> = [
          ["AC", ascLon], ["DC", (ascLon + 180) % 360],
          ["MC", mcLon], ["IC", (mcLon + 180) % 360],
        ];
        for (const [code, lonA] of angles) {
          const spA = sprite(glyphTex(code, ANGLE_HEX, "ang" + code, 0.46), 9, THREE.NormalBlending, .9);
          spA.position.copy(ecl(lonA, R_RING + 34));
          spA.userData = { kind: "angle", code, lon: lonA }; pickables.push(spA); houseGroup.add(spA);
        }
      } else if (hasAsc) {
        // repli sans domification (pas d'heure de naissance) : simple repère Asc
        radialLine(natalNow.asc!, 0, R_RING, ANGLE_HEX, .5, { kind: "asc" });
        const asp = sprite(glyphTex("Asc", ANGLE_HEX, "asc"), 10, THREE.NormalBlending, .9);
        asp.position.copy(ecl(natalNow.asc!, R_RING + 34));
        asp.userData = { kind: "asc" }; pickables.push(asp); houseGroup.add(asp);
      }

      // ── planètes NATALES (statiques, anneau interne) ──
      // SKY3D-ASTRO-READ-V1 : le halo encode natal (or) / transit (violet) —
      // le glyphe garde le liseré couleur-planète. Sans ça, deux ☽ identiques.
      // SKY3D-MINORS-V1 : mineurs plus petits, visibilité pilotée par la case.
      const natalMinorSprites: Array<{ halo: any; gl: any }> = [];
      for (const b of [...natalBodies, ...natalMinors]) {
        const isMinor = natalMinors.includes(b);
        const lon = natalNow.lon[b];
        const halo = sprite(haloTex(NATAL_HEX), isMinor ? 8 : 11, THREE.AdditiveBlending, .6);
        const gl = sprite(glyphTex(GLYPH[b] ?? "•", COLOR[b] ?? 0xffffff, "n" + b), isMinor ? 5 : 6, THREE.NormalBlending, .92);
        halo.position.copy(ecl(lon, R_NATAL)); gl.position.copy(ecl(lon, R_NATAL));
        halo.userData = { kind: "natal", body: b }; pickables.push(halo);
        sky.add(halo, gl);
        if (isMinor) natalMinorSprites.push({ halo, gl });
      }

      // ── planètes en TRANSIT (mobiles, anneau médian) ──
      const transitSprites = [...transitBodies, ...transitMinors].map((b) => {
        const isMinor = transitMinors.includes(b);
        const halo = sprite(haloTex(TRANSIT_HEX), isMinor ? 11 : 15, THREE.AdditiveBlending, .8);
        const gl = sprite(glyphTex(GLYPH[b] ?? "•", COLOR[b] ?? 0xffffff, "t" + b), isMinor ? 6 : 7.5, THREE.NormalBlending);
        // SKY3D-MINORS-V1 : badge ℞ discret, repositionné/affiché par tick
        const rx = sprite(glyphTex("℞", 0xffb3c8, "rx"), 3.6, THREE.NormalBlending, .9);
        rx.visible = false;
        halo.userData = { kind: "transit", body: b }; pickables.push(halo);
        sky.add(halo, gl, rx); return { b, halo, gl, rx, isMinor };
      });

      // ── pool de lignes d'aspect transit → natal ──
      const pool = Math.max(1, transitBodies.length * natalBodies.length);
      const aspectLines = Array.from({ length: pool }, () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        l.frustumCulled = false; l.userData = { kind: "aspect", on: false };
        sky.add(l); aspectPickables.push(l); return l;
      });

      // ── orbite caméra (sphérique) ──
      let radius = 185, theta = 0, phi = Math.PI * 0.30;
      // SKY3D-ASTRO-READ-V1 : cible d'inclinaison animée (bouton 2D/3D)
      const PHI_FLAT = 0.12, PHI_TILT = Math.PI * 0.30;
      let phiTarget: number | null = null;
      const updateCam = () => {
        camera.position.set(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.cos(theta));
        camera.lookAt(0, 0, 0);
      };

      // ── resize responsive ──
      let fitRadius = 185;
      const resize = () => {
        const w = wrap.clientWidth, h = wrap.clientHeight;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
        const vHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        // SKY3D-ASTRO-READ-V1 : 118→142 pour cadrer les labels d'angles
        // (AC/DC à R_RING+34 ≈ 122 + demi-sprite) sans les couper aux bords.
        const distH = 142 / (vHalf * camera.aspect);
        const distV = 106 / vHalf;
        fitRadius = Math.max(distH, distV);
        if (radius < fitRadius) radius = fitRadius;
      };
      const ro = new ResizeObserver(resize); ro.observe(wrap); resize();

      // ── tooltips (raycast espace-écran) ──
      const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
      const tmp = new THREE.Vector3();
      raycaster.params.Line = { threshold: 4 };   // survol/tap généreux des lignes (mobile)
      let active: any = null;
      const tip = tipRef.current!;
      const pname = (b: string) => (PMETA[b]?.[0]) ?? b;
      const fmtDeg = (lon: number) => {
        const L = ((lon % 360) + 360) % 360, di = L % 30;
        const deg = Math.floor(di), min = Math.floor((di - deg) * 60).toString().padStart(2, "0");
        return { deg, min, si: Math.floor(L / 30) % 12 };
      };
      const posLine = (label: string, lon: number) => {
        const f = fmtDeg(lon);
        return `<div class="ts3d-tm">${label} · ${SIGN_GLYPH[f.si]} ${f.deg}°${f.min}' ${SIGN_FR[f.si]}</div>`;
      };
      const tipHtml = (d: any): string => {
        if (!d) return "";
        if (d.kind === "transit") {
          const [name, kw] = PMETA[d.body] ?? [d.body, ""];
          const rx = retroAt(d.body, idx) ? " ℞" : ""; // SKY3D-MINORS-V1
          return `<div class="ts3d-tt">${GLYPH[d.body] ?? ""} ${name}${rx} <span class="ts3d-tag ts3d-tag-t">transit</span></div>`
            + (kw ? `<div class="ts3d-ts">${kw}</div>` : "")
            + posLine("Transit", posAt(d.body, idx))
            + (rx ? `<div class="ts3d-tm">℞ rétrograde en ce moment</div>` : "");
        }
        if (d.kind === "natal") {
          const [name, kw] = PMETA[d.body] ?? [d.body, ""];
          const rx = natalNow.retro?.[d.body] ? " ℞" : ""; // SKY3D-ASTRO-READ-V1
          return `<div class="ts3d-tt">${GLYPH[d.body] ?? ""} ${name}${rx} <span class="ts3d-tag ts3d-tag-n">natal</span></div>`
            + (kw ? `<div class="ts3d-ts">${kw}</div>` : "")
            + posLine("Natal", natalNow.lon[d.body]);
        }
        if (d.kind === "house") { // SKY3D-ASTRO-READ-V1
          const cusp = natalNow.houses?.[d.hi];
          return `<div class="ts3d-tt">Maison ${ROMAN[d.hi]} · ${HOUSE_NAMES_FR[d.hi]}</div>`
            + `<div class="ts3d-ts">${HOUSE_KEYWORDS_FR[d.hi]}</div>`
            + (typeof cusp === "number" ? posLine("Cuspide", cusp) : "");
        }
        if (d.kind === "angle") { // SKY3D-ASTRO-READ-V1
          const [name, kw] = ANGLE_META[d.code] ?? [d.code, ""];
          return `<div class="ts3d-tt">${d.code} · ${name}</div>`
            + `<div class="ts3d-ts">${kw}</div>`
            + posLine(d.code, d.lon);
        }
        if (d.kind === "sign") {
          return `<div class="ts3d-tt">${SIGN_GLYPH[d.si]} ${SIGN_FR[d.si]}</div>`
            + `<div class="ts3d-ts">${SIGN_ELEM[d.si]} · ${SIGN_KW[d.si]}</div>`;
        }
        if (d.kind === "asc") {
          return `<div class="ts3d-tt">Ascendant</div>`
            + `<div class="ts3d-ts">horizon est · début de la maison I</div>`
            + posLine("Asc", natalNow.asc ?? 0);
        }
        if (d.kind === "cusp") {
          const prev = (d.si + 11) % 12;
          return `<div class="ts3d-tt">${SIGN_GLYPH[d.si]} 0° ${SIGN_FR[d.si]}</div>`
            + `<div class="ts3d-ts">limite ${SIGN_FR[prev]} · ${SIGN_FR[d.si]}</div>`;
        }
        if (d.kind === "ring-natal") {
          return `<div class="ts3d-tt"><span class="ts3d-tag ts3d-tag-n">natal</span> Cercle natal</div>`
            + `<div class="ts3d-ts">position des planètes de ton thème (fixe)</div>`;
        }
        if (d.kind === "ring-transit") {
          return `<div class="ts3d-tt"><span class="ts3d-tag ts3d-tag-t">transit</span> Cercle des transits</div>`
            + `<div class="ts3d-ts">planètes du ciel qui balaient la période</div>`;
        }
        if (d.kind === "aspect") {
          const u = d.line.userData;
          if (!u.on) return tip.innerHTML;
          return `<div class="ts3d-tt">${u.aspName}</div>`
            + `<div class="ts3d-ts">${u.aspTone}</div>`
            + `<div class="ts3d-tm">${pname(u.t)} <span class="ts3d-tag ts3d-tag-t">transit</span> — `
            + `${pname(u.n)} <span class="ts3d-tag ts3d-tag-n">natal</span> · orbe ${u.orb}°</div>`;
        }
        return "";
      };
      const pickAt = (cx: number, cy: number, tol = 16) => {
        const rect = wrap.getBoundingClientRect();
        const px = cx - rect.left, py = cy - rect.top;
        scene.updateMatrixWorld();
        const near: Array<{ o: any; d: number }> = [];
        for (const o of pickables) {
          if (o.material.opacity <= 0.03) continue;
          // SKY3D-ASTRO-READ-V1 : maisons/angles masqués → non survolables
          const k0 = o.userData?.kind;
          if ((k0 === "house" || k0 === "angle" || k0 === "asc") && !hudRef.current.houses) continue;
          o.getWorldPosition(tmp).project(camera);
          if (tmp.z > 1) continue;
          const sx = (tmp.x * 0.5 + 0.5) * rect.width, sy = (-tmp.y * 0.5 + 0.5) * rect.height;
          const d = Math.hypot(sx - px, sy - py);
          if (d <= tol) near.push({ o, d });
        }
        near.sort((a, b) => a.d - b.d);
        if (near[0]) return near[0].o.userData;
        ndc.x = (px / rect.width) * 2 - 1; ndc.y = -(py / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        // aspects actifs (données live) + lignes structurelles fixes (Asc, cuspides, cercles)
        const lineTargets = aspectPickables.filter((l: any) => l.userData.on)
          .concat(linePickables.filter((l: any) =>
            hudRef.current.houses || (l.userData.kind !== "house" && l.userData.kind !== "asc")));
        const lHit = raycaster.intersectObjects(lineTargets, false)[0];
        if (lHit) {
          const obj: any = lHit.object;
          return obj.userData.kind === "aspect" ? { kind: "aspect", line: obj } : obj.userData;
        }
        return null;
      };
      const showTip = (d: any, cx: number, cy: number) => {
        const rect = wrap.getBoundingClientRect();
        active = d; tip.innerHTML = tipHtml(d);
        let L = cx - rect.left + 14, T = cy - rect.top + 14;
        if (L + 210 > rect.width) L = cx - rect.left - 210; if (T + 92 > rect.height) T = cy - rect.top - 92;
        tip.style.left = Math.max(6, L) + "px"; tip.style.top = Math.max(6, T) + "px"; tip.style.opacity = "1";
      };
      const hideTip = () => { active = null; tip.style.opacity = "0"; };

      // ── interactions pointeur (identiques à CielSky3D) ──
      let dragging = false, lastX = 0, lastY = 0, moved = false, downX = 0, downY = 0;
      let pinchD = 0;
      const onDown = (e: PointerEvent) => {
        canvas.setPointerCapture?.(e.pointerId);
        dragging = true; moved = false;
        lastX = downX = e.clientX; lastY = downY = e.clientY;
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "mouse" && !dragging) {
          const b = pickAt(e.clientX, e.clientY);
          if (b) { showTip(b, e.clientX, e.clientY); canvas.style.cursor = "pointer"; }
          else { hideTip(); canvas.style.cursor = "grab"; }
          return;
        }
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) moved = true;
        theta -= dx * 0.005;
        if (dy) phiTarget = null; // le drag manuel reprend la main sur le 2D/3D
        phi = Math.max(PHI_FLAT, Math.min(1.45, phi - dy * 0.005));
        if (e.pointerType === "mouse" && active) showTip(active, e.clientX, e.clientY);
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        // SKY3D-ASTRO-READ-V1 : resynchronise l'étiquette du bouton 2D/3D
        const fb = flatRef.current;
        if (fb) fb.textContent = phi > 0.35 ? "2D" : "3D";
        if (e.pointerType === "touch") {
          if (!moved) { const b = pickAt(downX, downY, 26); if (b) showTip(b, downX, downY); else hideTip(); }
        }
      };
      const onCancel = () => { dragging = false; pinchD = 0; };
      const clampR = (r: number) => Math.max(90, Math.min(620, r));
      const onWheel = (e: WheelEvent) => { e.preventDefault(); radius = clampR(radius + e.deltaY * 0.12); };
      const touchMove = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          if (pinchD) radius = clampR(radius - (d - pinchD) * 0.4);
          pinchD = d; e.preventDefault();
        }
      };
      const touchEnd = () => { pinchD = 0; };

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onCancel);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("touchmove", touchMove, { passive: false });
      canvas.addEventListener("touchend", touchEnd);

      // ── timeline ──
      let idx = 0, playing = true;
      const SPS = () => { const v = parseFloat(speedRef.current?.value || "14");
        return N / (Number.isFinite(v) && v > 0 ? v : 14); };
      const slider = sliderRef.current!, play = playRef.current!, dateEl = dateRef.current!;
      slider.min = "0"; slider.max = String(N); slider.step = "0.001"; slider.value = "0";
      const fmtDate = new Intl.DateTimeFormat("fr-FR",
        payload.cadence === "day"
          ? { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }
          : { weekday: "short", day: "numeric", month: "long", year: "numeric" });
      const updateDate = () => {
        const ts = payload.frames[Math.max(0, Math.min(N, Math.round(idx)))].t;
        dateEl.textContent = fmtDate.format(new Date(ts));
      };
      play.onclick = () => { playing = !playing; play.textContent = playing ? "⏸" : "▶"; };
      slider.oninput = () => { idx = parseFloat(slider.value); playing = false; play.textContent = "▶"; };
      // SKY3D-ASTRO-READ-V1 : bascule animée vue à plat (quasi-2D) ↔ vue 3D
      const flatBtn = flatRef.current;
      if (flatBtn) {
        flatBtn.textContent = "2D";
        flatBtn.onclick = () => {
          const goFlat = phi > 0.35;
          phiTarget = goFlat ? PHI_FLAT : PHI_TILT;
          flatBtn.textContent = goFlat ? "3D" : "2D";
        };
      }

      // ── boucle ──
      let last = performance.now();
      const tick = (now: number) => {
       try {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (playing) {
          idx += SPS() * dt;
          if (!Number.isFinite(idx)) idx = 0;
          else if (idx >= N) idx = 0;
          slider.value = String(idx);
        }

        // positions de transit (+ visibilité mineurs & badge ℞ — SKY3D-MINORS-V1)
        const showMin = hudRef.current.minors;
        for (const ps of transitSprites) {
          const lon = posAt(ps.b, idx);
          ps.halo.position.copy(ecl(lon, R_TRANSIT)); ps.gl.position.copy(ecl(lon, R_TRANSIT));
          const vis = !ps.isMinor || showMin;
          ps.halo.visible = vis; ps.gl.visible = vis;
          ps.halo.material.opacity = vis ? .8 : 0;   // opacité 0 = ignoré par pickAt
          const rxOn = vis && retroAt(ps.b, idx);
          ps.rx.visible = rxOn;
          if (rxOn) ps.rx.position.copy(ecl(lon, R_TRANSIT + 9));
        }
        for (const ns of natalMinorSprites) {
          ns.halo.visible = showMin; ns.gl.visible = showMin;
          ns.halo.material.opacity = showMin ? .6 : 0;
        }
        // aspects transit → natal
        let k = 0;
        for (const t of transitBodies) {
          const tl = posAt(t, idx);
          for (const n of natalBodies) {
            const s = sep(tl, natalNow.lon[n]);
            const asp = ASPECTS.find((a) => Math.abs(s - a.angle) <= a.orb);
            const line = aspectLines[k++];
            if (!asp) { line.material.opacity = 0; line.userData.on = false; continue; }
            const exact = 1 - Math.abs(s - asp.angle) / asp.orb;
            const A = ecl(tl, R_TRANSIT), B = ecl(natalNow.lon[n], R_NATAL);
            const pa = line.geometry.attributes.position;
            pa.setXYZ(0, A.x, A.y, A.z); pa.setXYZ(1, B.x, B.y, B.z); pa.needsUpdate = true;
            line.material.color.setHex(asp.color); line.material.opacity = 0.14 + 0.5 * exact;
            const ud = line.userData;
            ud.on = true; ud.t = t; ud.n = n;
            ud.aspName = asp.name; ud.aspTone = asp.tone; ud.orb = Math.round(Math.abs(s - asp.angle));
          }
        }
        for (; k < aspectLines.length; k++) { aspectLines[k].material.opacity = 0; aspectLines[k].userData.on = false; }

        // SKY3D-ASTRO-READ-V1 : toggles HUD + inclinaison animée + orientation Asc
        houseGroup.visible = hudRef.current.houses;
        sky.rotation.y = (hudRef.current.orient && hasAsc) ? d2r(180 - natalNow.asc!) : 0;
        if (phiTarget !== null) {
          phi += (phiTarget - phi) * Math.min(1, dt * 5);
          if (Math.abs(phi - phiTarget) < 0.004) { phi = phiTarget; phiTarget = null; }
        }

        if (active) tip.innerHTML = tipHtml(active);
        updateDate(); updateCam();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
       } catch (e) {
        (window as any).__theme3dErr = "tick: " + String((e as any)?.stack || e);
        console.error("[ThemeSky3D] tick", e);
        cancelAnimationFrame(raf);
       }
      };
      tick(performance.now());

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onCancel);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("touchmove", touchMove);
        canvas.removeEventListener("touchend", touchEnd);
        renderer.forceContextLoss?.();
        renderer.dispose();
        scene.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose?.()); }
        });
        Object.values(texCache).forEach((t: any) => t.dispose?.());
      };
     } catch (e) {
       (window as any).__theme3dErr = "setup: " + String((e as any)?.stack || e);
       console.error("[ThemeSky3D] setup", e);
       if (!disposed) setState("skip");
     }
    })();

    return () => { disposed = true; cleanup?.(); };
  }, [state]);

  // Plein écran (utile en paysage sur mobile) — THEME-SKY3D-V1
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    const doc = document as any;
    const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (!fsEl) {
      const req = (el as any).requestFullscreen || (el as any).webkitRequestFullscreen;
      const p = req?.call(el);
      const lock = () => { try { (screen.orientation as any)?.lock?.("landscape"); } catch { /* iOS */ } };
      if (p?.then) p.then(lock).catch(() => {}); else lock();
    } else {
      try { (screen.orientation as any)?.unlock?.(); } catch { /* noop */ }
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
    }
  };

  if (state === "skip") return null;

  return (
    <div className="ts3d" ref={wrapRef} aria-hidden>
      <canvas ref={canvasRef} className="ts3d-canvas" />
      <div className="ts3d-hud">
        <div className="ts3d-date" ref={dateRef} />
        {profileLabel && <div className="ts3d-who">{profileLabel}</div>}
      </div>
      <div className="ts3d-side">
        <div className="ts3d-legend">
          <span><i className="ts3d-dot ts3d-dot-n" /> Natal</span>
          <span><i className="ts3d-dot ts3d-dot-t" /> Transit</span>
        </div>
        {(hasHousesProp || hasAscProp || hasMinors) && (
          <div className="ts3d-toggles">
            {hasHousesProp && (
              <label className="ts3d-tog">
                <input
                  type="checkbox"
                  checked={hudHouses}
                  onChange={(e) => { hudRef.current.houses = e.target.checked; setHudHouses(e.target.checked); }}
                />
                Maisons
              </label>
            )}
            {hasMinors && (
              <label className="ts3d-tog">
                <input
                  type="checkbox"
                  checked={hudMinors}
                  onChange={(e) => { hudRef.current.minors = e.target.checked; setHudMinors(e.target.checked); }}
                />
                Astres mineurs
              </label>
            )}
            {hasAscProp && (
              <label className="ts3d-tog">
                <input
                  type="checkbox"
                  checked={hudOrient}
                  onChange={(e) => { hudRef.current.orient = e.target.checked; setHudOrient(e.target.checked); }}
                />
                Orientée Asc
              </label>
            )}
          </div>
        )}
      </div>
      <div className="ts3d-tip" ref={tipRef} />
      <div className="ts3d-panel">
        <button className="ts3d-play" ref={playRef} type="button" aria-label="lecture / pause">⏸</button>
        <input className="ts3d-slider" ref={sliderRef} type="range" aria-label="date" />
        <select className="ts3d-speed" ref={speedRef} defaultValue="14" aria-label="vitesse">
          <option value="24">lent</option>
          <option value="14">normal</option>
          <option value="7">rapide</option>
        </select>
        <button className="ts3d-flatbtn" ref={flatRef} type="button"
          aria-label="basculer vue à plat / vue 3D">2D</button>
        <button className="ts3d-fs" type="button" onClick={toggleFullscreen} aria-label="plein écran">⛶</button>
      </div>
      {state === "loading" && <div className="ts3d-load">Chargement du thème…</div>}

      <style dangerouslySetInnerHTML={{ __html: TS3D_CSS }} />
    </div>
  );
}

const TS3D_CSS = `
.ts3d { position: relative; width: 100%; height: 100%; min-height: 320px;
  border-radius: 16px; overflow: hidden;
  background: radial-gradient(120% 120% at 50% 28%, #241a52 0%, #120c33 45%, #06040f 100%); }
.ts3d-canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.ts3d-hud { position: absolute; left: 14px; top: 12px; pointer-events: none; text-shadow: 0 1px 12px #000a; }
.ts3d-date { font-size: 14px; font-weight: 600; color: #e7e0ff; letter-spacing: .01em; text-transform: capitalize; }
.ts3d-who { font-size: 11.5px; color: #cbbcff; margin-top: 2px; }
.ts3d-side { position: absolute; right: 12px; top: 10px; z-index: 4;
  display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.ts3d-legend { display: flex; gap: 12px;
  padding: 6px 11px; border-radius: 11px; color: #e7e0ff; font-size: 11.5px; font-weight: 600;
  background: rgba(20,14,48,.5); border: 1px solid rgba(143,127,255,.24); box-shadow: 0 6px 20px #0007;
  pointer-events: none; }
.ts3d-legend span { display: inline-flex; align-items: center; gap: 6px; }
.ts3d-toggles { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.ts3d-tog { display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
  padding: 4px 9px; border-radius: 9px; color: #e7e0ff; font-size: 11px; font-weight: 600;
  background: rgba(20,14,48,.5); border: 1px solid rgba(143,127,255,.24); box-shadow: 0 6px 20px #0007;
  -webkit-tap-highlight-color: transparent; user-select: none; }
.ts3d-tog input { accent-color: #b9acff; width: 13px; height: 13px; margin: 0; cursor: pointer; }
.ts3d-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.ts3d-dot-n { background: #c9a84c; box-shadow: 0 0 6px #c9a84c; }
.ts3d-dot-t { background: #b9acff; box-shadow: 0 0 6px #b9acff; }
.ts3d-tip { position: absolute; z-index: 5; pointer-events: none; opacity: 0; transition: opacity .12s;
  max-width: 210px; padding: 8px 11px; border-radius: 11px; color: #e7e0ff; font-size: 12px; line-height: 1.45;
  background: rgba(20,14,48,.88); border: 1px solid rgba(143,127,255,.28); box-shadow: 0 8px 26px #0009; }
.ts3d-tt { font-weight: 600; font-size: 13px; }
.ts3d-ts { opacity: .7; margin-top: 1px; }
.ts3d-tm { margin-top: 3px; font-size: 11px; color: #cbbcff; }
.ts3d-tag { font-size: 9.5px; font-weight: 700; padding: 0 6px; border-radius: 999px; vertical-align: middle;
  text-transform: uppercase; letter-spacing: .3px; }
.ts3d-tag-t { color: #1a1340; background: #b9acff; }
.ts3d-tag-n { color: #2a1e07; background: #e2c56b; }
.ts3d-panel { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 11px; width: min(560px, 90%);
  padding: 9px 13px; border-radius: 14px; background: rgba(20,14,48,.5);
  border: 1px solid rgba(143,127,255,.18); box-shadow: 0 8px 30px #0007; }
.ts3d-play { flex: 0 0 auto; width: 36px; height: 36px; min-width: 36px; padding: 0; border-radius: 50%;
  cursor: pointer; color: #e7e0ff; border: 1px solid rgba(143,127,255,.35);
  background: rgba(143,127,255,.16); font-size: 14px; line-height: 1; }
.ts3d-slider { -webkit-appearance: none; appearance: none; flex: 1 1 auto; width: auto; min-width: 60px;
  height: 6px; padding: 0; border: none; border-radius: 3px; background: rgba(143,127,255,.28); cursor: pointer; }
.ts3d-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px;
  border-radius: 50%; background: #b9acff; border: 2px solid rgba(255,255,255,.5); margin-top: 0; }
.ts3d-slider::-moz-range-thumb { width: 16px; height: 16px; border: none; border-radius: 50%; background: #b9acff; }
.ts3d-slider::-moz-range-track { height: 6px; border-radius: 3px; background: rgba(143,127,255,.28); }
.ts3d-speed { flex: 0 0 auto; width: auto; min-width: 74px; max-width: 104px;
  -webkit-appearance: none; appearance: none; color: #e7e0ff; line-height: 1.1;
  background-color: rgba(143,127,255,.16); border: 1px solid rgba(143,127,255,.32);
  border-radius: 9px; padding: 7px 24px 7px 10px; font-size: 12px; cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%23cbbcff' stroke-width='1.5'><path d='M1 1l4 4 4-4'/></svg>");
  background-repeat: no-repeat; background-position: right 9px center; }
.ts3d-speed option { color: #1a1340; background: #e7e0ff; }
.ts3d-fs { flex: 0 0 auto; width: 36px; height: 36px; min-width: 36px; padding: 0; border-radius: 50%;
  cursor: pointer; color: #e7e0ff; border: 1px solid rgba(143,127,255,.35);
  background: rgba(143,127,255,.16); font-size: 15px; line-height: 1; }
.ts3d-flatbtn { flex: 0 0 auto; width: 36px; height: 36px; min-width: 36px; padding: 0; border-radius: 50%;
  cursor: pointer; color: #e7e0ff; border: 1px solid rgba(143,127,255,.35);
  background: rgba(143,127,255,.16); font-size: 11px; font-weight: 700; line-height: 1;
  letter-spacing: .3px; }
.ts3d:fullscreen { width: 100vw; height: 100vh; border-radius: 0; }
.ts3d:-webkit-full-screen { width: 100vw; height: 100vh; border-radius: 0; }
.ts3d-load { position: absolute; inset: 0; display: grid; place-items: center;
  color: #cbbcff; font-size: 13px; pointer-events: none; }
@media (max-width: 640px) {
  .ts3d-panel { width: calc(100% - 20px); gap: 8px; padding: 8px 10px; }
  .ts3d-legend { gap: 9px; padding: 5px 9px; font-size: 11px; }
}
`;

// THEME-SKY3D-V1 ThemeSky3D applied
// SKY3D-ASTRO-READ-V1 applied
// SKY3D-MINORS-V1 applied

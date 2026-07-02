// ============================================================
// apps/web/src/components/ciel/CielSky3D.tsx
// CIEL-SKY3D-V1
// ------------------------------------------------------------
// Roue céleste 3D du ciel public (/ciel) : balaye la période de
// la cadence (jour/semaine/mois/an) en interpolant des frames de
// positions calculées serveur (/public/sky/:cadence/frames).
//
// - three est chargé en runtime depuis public/vendor (same-origin,
//   conforme CSP) — pas une dépendance npm, pas de lockfile touché.
// - Rendu purement impératif (refs + rAF) ; React ne gère que le
//   chargement / le fallback. Si pas de WebGL → rend null (la roue
//   2D SSR reste affichée en dessous).
// - Mobile-first : tap = tooltip, drag = rotation, pinch = zoom.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env["NEXT_PUBLIC_API_URL"] || "";
// Chemin runtime same-origin du build three vendorisé. Référencé via une
// VARIABLE (pas un littéral) pour que tsc ne tente pas de résoudre le module
// (TS2307) ; les magic comments ci-dessous neutralisent le bundler.
const THREE_URL = "/vendor/three-0.160.0.module.min.js";

// ── métadonnées d'affichage (reprises de ZodiacWheel) ──
const GLYPH: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
  // CIEL-SKY3D-MINORS-V1 : astres mineurs (option)
  chiron: "⚷", ceres: "⚳", pallas: "⚴", juno: "⚵", vesta: "⚶", lilith: "⚸",
};
const COLOR: Record<string, number> = {
  sun: 0xffd27f, moon: 0xcfd8ff, mercury: 0xb6f0ff, venus: 0xffc8e6, mars: 0xff9b8a,
  jupiter: 0xffe1a8, saturn: 0xd8c9a8, uranus: 0x9ff0e0, neptune: 0xa8c4ff, pluto: 0xd0a8ff,
  // CIEL-SKY3D-MINORS-V1 — teintes douces, distinctes des majeures
  chiron: 0xc9b8ff, ceres: 0xb8e6c0, pallas: 0xcfe0ff, juno: 0xffd0e0, vesta: 0xffe6b0, lilith: 0xbcaccc,
};
const PMETA: Record<string, [string, string]> = {
  sun: ["Soleil", "identité · vitalité"], moon: ["Lune", "émotions · intuition"],
  mercury: ["Mercure", "pensée · communication"], venus: ["Vénus", "amour · esthétique"],
  mars: ["Mars", "action · désir"], jupiter: ["Jupiter", "expansion · confiance"],
  saturn: ["Saturne", "structure · responsabilité"], uranus: ["Uranus", "rupture · liberté"],
  neptune: ["Neptune", "rêve · idéal"], pluto: ["Pluton", "transformation · pouvoir"],
  // CIEL-SKY3D-MINORS-V1
  chiron: ["Chiron", "blessure · guérison"], ceres: ["Cérès", "nourrir · cycles"],
  pallas: ["Pallas", "stratégie · sagesse"], juno: ["Junon", "engagement · alliance"],
  vesta: ["Vesta", "dévotion · feu sacré"], lilith: ["Lilith", "instinct · liberté"],
};
const SIGN_GLYPH = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
const SIGN_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge",
                 "Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
const SIGN_COLOR = [0xff8a6b,0x9fd08a,0xfff0a8,0x8fd0ff,0xff8a6b,0x9fd08a,
                    0xfff0a8,0x8fd0ff,0xff8a6b,0x9fd08a,0xfff0a8,0x8fd0ff];
const SIGN_ELEM = ["Feu","Terre","Air","Eau","Feu","Terre","Air","Eau","Feu","Terre","Air","Eau"];
const SIGN_KW = ["initiative","sensualité","curiosité","sensibilité","rayonnement","analyse",
                 "harmonie","intensité","aventure","ambition","innovation","imagination"];
// name = nom de l'aspect, tone = catégorie affichée dans le tooltip
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
  // CIEL-SKY3D-MINORS-V1 : sous-ensemble de `bodies` masquable via la case.
  minors?: string[];
}

let _webglOK: boolean | null = null;
function hasWebGL(): boolean {
  if (_webglOK !== null) return _webglOK;
  try {
    const c = document.createElement("canvas");
    const gl: any = c.getContext("webgl") || c.getContext("experimental-webgl");
    _webglOK = !!(window.WebGLRenderingContext && gl);
    // libère immédiatement le contexte de test : sur mobile le nombre de
    // contextes WebGL est limité, en accumuler épuise le GPU (3D qui ne
    // s'affiche plus « à tous les coups »).
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

export function CielSky3D(
  { cadence, onUnavailable }: { cadence: FramesPayload["cadence"]; onUnavailable?: () => void },
) {
  // capté dans un ref pour ne pas re-déclencher l'effet à chaque rendu parent
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const playRef = useRef<HTMLButtonElement | null>(null);
  const speedRef = useRef<HTMLSelectElement | null>(null);

  const [state, setState] = useState<"loading" | "ready" | "skip">("loading");
  const framesRef = useRef<FramesPayload | null>(null);

  // CIEL-SKY3D-MINORS-V1 : case « astres mineurs ». `hasMinors` n'est vrai
  // qu'une fois les frames chargées si le moteur a calculé des mineurs.
  // `showMinorsRef` est lu en live dans la boucle rAF → bascule sans
  // reconstruire la scène WebGL (coûteux/instable sur mobile).
  const [showMinors, setShowMinors] = useState(false);
  const [hasMinors, setHasMinors] = useState(false);
  const showMinorsRef = useRef(false);
  showMinorsRef.current = showMinors;

  // Pas de WebGL / frames indisponibles → on prévient le parent pour qu'il
  // bascule sur la roue 2D de secours (CIEL-SKY3D-DEFAULT-V1).
  useEffect(() => {
    if (state === "skip") onUnavailableRef.current?.();
  }, [state]);

  // 1) WebGL + fetch des frames
  useEffect(() => {
    if (!hasWebGL()) { setState("skip"); return; }
    let alive = true;
    (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {        // retry réseau mobile
        try {
          // SKY-FRAMES-CACHE-BUST-V1 : force-cache sur URL fixe = un visiteur
          // récurrent gardait les frames de sa PREMIÈRE visite (ciel périmé,
          // constaté en prod : « 26 juin » affiché le 2 juillet). La clé datée
          // garde le bénéfice du cache DANS la journée et le casse au-delà.
          const bust = new Date().toISOString().slice(0, 10);
          const res = await fetch(`${API}/public/sky/${cadence}/frames?d=${bust}`, { cache: "force-cache" });
          const json = await res.json();
          if (!alive) return;
          if (json?.success && json.data?.frames?.length) {
            const data = json.data as FramesPayload;
            framesRef.current = data;
            // mineurs réellement présents dans la 1re frame (le payload peut
            // les annoncer mais ne pas les avoir si .se1 absents côté moteur)
            const first = data.frames[0]?.lon ?? {};
            setHasMinors((data.minors ?? []).some((b) => first[b] !== undefined));
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

  // 2) scène three (après que les frames + le canvas soient prêts)
  useEffect(() => {
    if (state !== "ready") return;
    const wrap = wrapRef.current, canvas = canvasRef.current, payload = framesRef.current;
    if (!wrap || !canvas || !payload) return;

    let disposed = false;
    let raf = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
     try {
      // three same-origin — spécificateur VARIABLE : invisible pour tsc
      // (pas de TS2307) et neutralisé pour le bundler par les magic comments.
      const THREE: any = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ THREE_URL);
      if (disposed) return;

      const bodies = payload.bodies.filter((b) => payload.frames[0].lon[b] !== undefined);
      // CIEL-SKY3D-MINORS-V1 : mineurs présents (option) vs majeurs (toujours).
      // Les mineurs sont dessinés mais masqués par défaut, et exclus de la
      // grille d'aspects + des stelliums (convention de l'app : astéroïdes
      // hors grille d'aspects).
      const minorSet = new Set((payload.minors ?? []).filter((b) => bodies.includes(b)));
      const majorBodies = bodies.filter((b) => !minorSet.has(b));
      const N = payload.frames.length - 1;                 // segments
      const d2r = THREE.MathUtils.degToRad;
      const R = 60, R_RING = 80;

      // CIEL-SKY3D-DIRECTION-V1 : z NÉGATIF → longitudes croissantes
      // ANTIHORAIRES à l'écran. La roue tournait en sens horaire, à l'envers
      // de la 2D vérifiée contre le ciel réel et de la bi-roue 3D des
      // transits (SKY3D-ASTRO-READ-V1) — backport du même flip.
      const ecl = (lon: number, r: number) => new THREE.Vector3(
        r * Math.cos(d2r(lon)), 0, -r * Math.sin(d2r(lon)),
      );
      const posAt = (b: string, u: number): number => {
        let i = Math.floor(u);
        if (!Number.isFinite(i) || i < 0) i = 0; else if (i > N - 1) i = N - 1;
        const fa = payload.frames[i], fc = payload.frames[i + 1] || fa;  // jamais d'index hors plage
        const a = fa.lon[b], c = fc.lon[b];
        if (a === undefined) return c ?? 0;
        if (c === undefined) return a;
        return lerpLon(a, c, Number.isFinite(u) ? u - i : 0);
      };

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07040f, 0.0016);
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const sky = new THREE.Group(); scene.add(sky);

      // textures procédurales
      const texCache: Record<string, any> = {};
      const glyphTex = (g: string, hex: number, key: string) => {
        if (texCache[key]) return texCache[key];
        const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
        const x = c.getContext("2d")!;
        x.font = `${s * 0.62}px "Segoe UI Symbol","Noto Sans Symbols2",serif`;
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

      // étoiles
      const SN = 1200, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 3);
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

      // cibles tooltip (raycast) : planètes, signes, stelliums, lignes d'aspect
      const pickables: any[] = [];        // sprites (planètes/signes/stelliums)
      const aspectPickables: any[] = [];  // lignes d'aspect (seuil de survol)

      // anneau zodiacal + signes
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(R_RING, R_RING + 14, 128),
        new THREE.MeshBasicMaterial({ color: 0x8f7fff, transparent: true, opacity: .10,
          side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; sky.add(ring);
      const stelliumTicks: any[] = [];
      for (let i = 0; i < 12; i++) {
        const a = ecl(i * 30, R_RING), b = ecl(i * 30, R_RING + 14);
        sky.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]),
          new THREE.LineBasicMaterial({ color: 0x8f7fff, transparent: true, opacity: .22 })));
        const s2 = sprite(glyphTex(SIGN_GLYPH[i], SIGN_COLOR[i], "s" + i), 9, THREE.NormalBlending, .9);
        s2.position.copy(ecl(i * 30 + 15, R_RING + 28));
        s2.userData = { kind: "sign", si: i }; pickables.push(s2); sky.add(s2);
        // marqueur stellium (caché par défaut) au-dessus du glyphe de signe
        const tk = sprite(haloTex(0xffe9a8), 7, THREE.AdditiveBlending, 0);
        tk.position.copy(ecl(i * 30 + 15, R_RING + 7));
        tk.userData = { kind: "stellium", si: i, count: 0 };
        stelliumTicks.push(tk); pickables.push(tk); sky.add(tk);
      }
      sky.add(sprite(haloTex(0x6f5ad0), 24, THREE.AdditiveBlending, .3)); // noyau

      // planètes (sprites mobiles) — mineurs un peu plus discrets, masqués
      // tant que la case n'est pas cochée (opacité halo 0 = ignoré au picking).
      const planetSprites = bodies.map((b) => {
        const isMinor = minorSet.has(b);
        const halo = sprite(haloTex(COLOR[b] ?? 0xffffff), isMinor ? 11 : 15, THREE.AdditiveBlending, isMinor ? 0 : .9);
        const gl = sprite(glyphTex(GLYPH[b] ?? "•", COLOR[b] ?? 0xffffff, "p" + b), isMinor ? 6 : 7.5, THREE.NormalBlending);
        if (isMinor) { halo.visible = false; gl.visible = false; }
        halo.userData = { kind: "planet", body: b }; pickables.push(halo);
        sky.add(halo, gl); return { b, halo, gl, isMinor };
      });

      // pool de lignes d'aspect (userData mis à jour chaque frame) — majeurs seuls
      const pool = majorBodies.length * majorBodies.length;
      const aspectLines = Array.from({ length: pool }, () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        l.frustumCulled = false; l.userData = { kind: "aspect", on: false };
        sky.add(l); aspectPickables.push(l); return l;
      });

      // ── orbite caméra (sphérique) ──
      let radius = 175, theta = 0, phi = Math.PI * 0.30;
      const updateCam = () => {
        camera.position.set(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.cos(theta));
        camera.lookAt(0, 0, 0);
      };

      // ── resize : caméra responsive (la roue rentre quel que soit le ratio) ──
      let fitRadius = 175;
      const resize = () => {
        const w = wrap.clientWidth, h = wrap.clientHeight;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
        const vHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        // le wheel est incliné : largeur projetée ~112, hauteur projetée ~72.
        const distH = 112 / (vHalf * camera.aspect);   // tient horizontalement
        const distV = 72 / vHalf;                       // tient verticalement
        fitRadius = Math.max(distH, distV);             // ≈175 en desktop, monte en portrait
        if (radius < fitRadius) radius = fitRadius;
      };
      const ro = new ResizeObserver(resize); ro.observe(wrap); resize();

      // ── tooltips (raycast) : planètes, signes, aspects, stelliums ──
      const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
      const tmp = new THREE.Vector3();              // vecteur de travail (projection)
      raycaster.params.Line = { threshold: 2.5 };   // tolérance de survol des lignes
      let active: any = null;                         // descripteur de l'élément survolé
      const tip = tipRef.current!;
      const pname = (b: string) => (PMETA[b]?.[0]) ?? b;
      const fmtDeg = (lon: number) => {
        const L = ((lon % 360) + 360) % 360, di = L % 30;
        const deg = Math.floor(di), min = Math.floor((di - deg) * 60).toString().padStart(2, "0");
        return { deg, min, si: Math.floor(L / 30) % 12 };
      };
      const tipHtml = (d: any): string => {
        if (!d) return "";
        if (d.kind === "planet") {
          const [name, kw] = PMETA[d.body] ?? [d.body, ""];
          const f = fmtDeg(posAt(d.body, idx));
          return `<div class="cs3d-tt">${GLYPH[d.body] ?? ""} ${name}</div>`
            + (kw ? `<div class="cs3d-ts">${kw}</div>` : "")
            + `<div class="cs3d-tm">${SIGN_GLYPH[f.si]} ${f.deg}°${f.min}' ${SIGN_FR[f.si]}</div>`;
        }
        if (d.kind === "planets") {   // plusieurs planètes proches : on les liste
          return d.bodies.map((b: string) => {
            const [name] = PMETA[b] ?? [b, ""];
            const f = fmtDeg(posAt(b, idx));
            return `<div class="cs3d-tt" style="font-size:12px">${GLYPH[b] ?? ""} ${name}`
              + ` <span style="opacity:.6;font-weight:400">${f.deg}°${f.min}' ${SIGN_GLYPH[f.si]}</span></div>`;
          }).join("");
        }
        if (d.kind === "sign") {
          return `<div class="cs3d-tt">${SIGN_GLYPH[d.si]} ${SIGN_FR[d.si]}</div>`
            + `<div class="cs3d-ts">${SIGN_ELEM[d.si]} · ${SIGN_KW[d.si]}</div>`;
        }
        if (d.kind === "aspect") {
          const u = d.line.userData;
          if (!u.on) return tip.innerHTML;
          return `<div class="cs3d-tt">${u.aspName}</div>`
            + `<div class="cs3d-ts">${u.aspTone}</div>`
            + `<div class="cs3d-tm">${pname(u.a)} – ${pname(u.b)} · orbe ${u.orb}°</div>`;
        }
        if (d.kind === "stellium") {
          return `<div class="cs3d-tt">✦ Stellium en ${SIGN_FR[d.si]}</div>`
            + `<div class="cs3d-ts">${stelliumTicks[d.si].userData.count} planètes regroupées</div>`;
        }
        return "";
      };
      // pick en ESPACE-ÉCRAN (bien plus fiable au doigt que le ray-quad) :
      // on cherche le sprite visible le plus proche du curseur sous `tol` px,
      // et on regroupe les planètes proches en un seul tooltip.
      const pickAt = (cx: number, cy: number, tol = 16) => {
        const rect = wrap.getBoundingClientRect();
        const px = cx - rect.left, py = cy - rect.top;
        scene.updateMatrixWorld();
        const near: Array<{ o: any; d: number }> = [];
        for (const o of pickables) {
          if (o.material.opacity <= 0.03) continue;
          o.getWorldPosition(tmp).project(camera);
          if (tmp.z > 1) continue;                 // derrière la caméra
          const sx = (tmp.x * 0.5 + 0.5) * rect.width, sy = (-tmp.y * 0.5 + 0.5) * rect.height;
          const d = Math.hypot(sx - px, sy - py);
          if (d <= tol) near.push({ o, d });
        }
        near.sort((a, b) => a.d - b.d);
        const planets = near.filter((n) => n.o.userData.kind === "planet");
        if (planets.length > 1) return { kind: "planets", bodies: planets.map((p) => p.o.userData.body) };
        if (near[0]) return near[0].o.userData;
        // sinon, lignes d'aspect actuellement actives (raycast avec seuil)
        ndc.x = (px / rect.width) * 2 - 1; ndc.y = -(py / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const lHit = raycaster.intersectObjects(aspectPickables.filter((l: any) => l.userData.on), false)[0];
        if (lHit) return { kind: "aspect", line: lHit.object };
        return null;
      };
      const showTip = (d: any, cx: number, cy: number) => {
        const rect = wrap.getBoundingClientRect();
        active = d; tip.innerHTML = tipHtml(d);
        let L = cx - rect.left + 14, T = cy - rect.top + 14;
        if (L + 200 > rect.width) L = cx - rect.left - 200; if (T + 84 > rect.height) T = cy - rect.top - 84;
        tip.style.left = Math.max(6, L) + "px"; tip.style.top = Math.max(6, T) + "px"; tip.style.opacity = "1";
      };
      const hideTip = () => { active = null; tip.style.opacity = "0"; };

      // ── interactions pointeur ──
      let dragging = false, lastX = 0, lastY = 0, moved = false, downX = 0, downY = 0;
      let pinchD = 0;
      const onDown = (e: PointerEvent) => {
        canvas.setPointerCapture?.(e.pointerId);
        dragging = true; moved = false;
        lastX = downX = e.clientX; lastY = downY = e.clientY;
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "mouse" && !dragging) {           // hover desktop
          const b = pickAt(e.clientX, e.clientY);
          if (b) { showTip(b, e.clientX, e.clientY); canvas.style.cursor = "pointer"; }
          else { hideTip(); canvas.style.cursor = "grab"; }
          return;
        }
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) moved = true;
        theta -= dx * 0.005;
        phi = Math.max(0.12, Math.min(1.45, phi - dy * 0.005));
        if (e.pointerType === "mouse" && active) showTip(active, e.clientX, e.clientY);
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        if (e.pointerType === "touch") {                        // tap = tooltip (tolérance large)
          if (!moved) { const b = pickAt(downX, downY, 26); if (b) showTip(b, downX, downY); else hideTip(); }
        }
      };
      const onCancel = () => { dragging = false; pinchD = 0; };
      const clampR = (r: number) => Math.max(80, Math.min(600, r));
      const onWheel = (e: WheelEvent) => {
        e.preventDefault(); radius = clampR(radius + e.deltaY * 0.12);
      };
      // pinch (2 doigts)
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
      const SPS = () => { const v = parseFloat(speedRef.current?.value || "14"); // frames/sec
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

      // ── boucle ──
      let last = performance.now();
      const tick = (now: number) => {
       try {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (playing) {
          idx += SPS() * dt;
          if (!Number.isFinite(idx)) {
            (window as any).__sky3dWarn = `idx NaN dt=${dt} sps=${SPS()} speed=${speedRef.current?.value}`;
            idx = 0;
          } else if (idx >= N) idx = 0;
          slider.value = String(idx);
        }

        const showMin = showMinorsRef.current;   // CIEL-SKY3D-MINORS-V1
        const signCount = [0,0,0,0,0,0,0,0,0,0,0,0];
        for (const ps of planetSprites) {
          const lon = posAt(ps.b, idx);
          ps.halo.position.copy(ecl(lon, R)); ps.gl.position.copy(ecl(lon, R));
          if (ps.isMinor) {
            // visibilité live + opacité (0 = ignoré par le picking espace-écran)
            ps.halo.visible = showMin; ps.gl.visible = showMin;
            ps.halo.material.opacity = showMin ? 0.9 : 0;
          } else {
            signCount[Math.floor((((lon % 360) + 360) % 360) / 30) % 12]++;
          }
        }
        // marqueurs stellium (≥3 planètes dans un signe)
        for (let i = 0; i < 12; i++) {
          stelliumTicks[i].userData.count = signCount[i];
          stelliumTicks[i].material.opacity = signCount[i] >= 3 ? 0.85 : 0;
        }
        // aspects ciel-interne (+ userData pour les tooltips)
        let k = 0;
        for (let i = 0; i < majorBodies.length; i++) for (let j = i + 1; j < majorBodies.length; j++) {
          const s = sep(posAt(majorBodies[i], idx), posAt(majorBodies[j], idx));
          const asp = ASPECTS.find((a) => Math.abs(s - a.angle) <= a.orb);
          const line = aspectLines[k++];
          if (!asp) { line.material.opacity = 0; line.userData.on = false; continue; }
          const exact = 1 - Math.abs(s - asp.angle) / asp.orb;
          const pa = line.geometry.attributes.position;
          const A = ecl(posAt(majorBodies[i], idx), R), B = ecl(posAt(majorBodies[j], idx), R);
          pa.setXYZ(0, A.x, A.y, A.z); pa.setXYZ(1, B.x, B.y, B.z); pa.needsUpdate = true;
          line.material.color.setHex(asp.color); line.material.opacity = 0.12 + 0.45 * exact;
          const ud = line.userData;
          ud.on = true; ud.a = majorBodies[i]; ud.b = majorBodies[j];
          ud.aspName = asp.name; ud.aspTone = asp.tone; ud.orb = Math.round(Math.abs(s - asp.angle));
        }
        for (; k < aspectLines.length; k++) { aspectLines[k].material.opacity = 0; aspectLines[k].userData.on = false; }

        if (active) tip.innerHTML = tipHtml(active);
        updateDate(); updateCam();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
       } catch (e) {
        (window as any).__sky3dErr = "tick: " + String((e as any)?.stack || e);
        console.error("[CielSky3D] tick", e);
        cancelAnimationFrame(raf);
       }
      };
      tick(performance.now());  // 1re frame rendue immédiatement (tick planifie la suite)

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
        renderer.forceContextLoss?.();   // rend le contexte WebGL au GPU (mobile)
        renderer.dispose();
        scene.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose?.()); }
        });
        Object.values(texCache).forEach((t: any) => t.dispose?.());
      };
     } catch (e) {
       (window as any).__sky3dErr = "setup: " + String((e as any)?.stack || e);
       console.error("[CielSky3D] setup", e);
       if (!disposed) setState("skip");   // fallback gracieux → roue 2D
     }
    })();

    return () => { disposed = true; cleanup?.(); };
  }, [state]);

  // Plein écran (utile surtout en paysage sur mobile) : passe le wrap en
  // fullscreen et tente de verrouiller l'orientation paysage. Le ResizeObserver
  // existant redimensionne le canvas tout seul. CIEL-SKY3D-FULLSCREEN-V1
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    const doc = document as any;
    const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (!fsEl) {
      const req = (el as any).requestFullscreen || (el as any).webkitRequestFullscreen;
      const p = req?.call(el);
      const lock = () => { try { (screen.orientation as any)?.lock?.("landscape"); } catch { /* iOS : non supporté */ } };
      if (p?.then) p.then(lock).catch(() => {}); else lock();
    } else {
      try { (screen.orientation as any)?.unlock?.(); } catch { /* noop */ }
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
    }
  };

  if (state === "skip") return null;

  return (
    <div className="cs3d" ref={wrapRef} aria-hidden>
      <canvas ref={canvasRef} className="cs3d-canvas" />
      <div className="cs3d-hud"><div className="cs3d-date" ref={dateRef} /></div>
      {hasMinors && (
        <label className="cs3d-minors">
          <input
            type="checkbox"
            checked={showMinors}
            onChange={(e) => setShowMinors(e.target.checked)}
          />
          <span>Astres mineurs</span>
        </label>
      )}
      <div className="cs3d-tip" ref={tipRef} />
      <div className="cs3d-panel">
        <button className="cs3d-play" ref={playRef} type="button" aria-label="lecture / pause">⏸</button>
        <input className="cs3d-slider" ref={sliderRef} type="range" aria-label="date" />
        <select className="cs3d-speed" ref={speedRef} defaultValue="14" aria-label="vitesse">
          <option value="24">lent</option>
          <option value="14">normal</option>
          <option value="7">rapide</option>
        </select>
        <button className="cs3d-fs" type="button" onClick={toggleFullscreen} aria-label="plein écran">⛶</button>
      </div>
      {state === "loading" && <div className="cs3d-load">Chargement du ciel…</div>}

      <style dangerouslySetInnerHTML={{ __html: CS3D_CSS }} />
    </div>
  );
}

const CS3D_CSS = `
.cs3d { position: relative; width: 100%; height: clamp(360px, 62vh, 560px);
  border-radius: 16px; overflow: hidden;
  background: radial-gradient(120% 120% at 50% 28%, #241a52 0%, #120c33 45%, #06040f 100%); }
/* touch-action: none UNIQUEMENT sur le canvas (orbite/pinch sans scroll) ;
   le panneau du bas garde le tactile natif (slider + sélecteur). */
.cs3d-canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.cs3d-hud { position: absolute; left: 14px; top: 12px; pointer-events: none; text-shadow: 0 1px 12px #000a; }
.cs3d-date { font-size: 14px; font-weight: 600; color: #e7e0ff; letter-spacing: .01em; text-transform: capitalize; }
/* CIEL-SKY3D-MINORS-V1 : case « astres mineurs » (coin haut-droit) */
.cs3d-minors { position: absolute; z-index: 4; right: 12px; top: 10px;
  display: flex; align-items: center; gap: 7px; cursor: pointer; user-select: none;
  padding: 7px 11px; border-radius: 11px; color: #e7e0ff; font-size: 12px; font-weight: 600;
  background: rgba(20,14,48,.55); border: 1px solid rgba(143,127,255,.28);
  box-shadow: 0 6px 20px #0007; -webkit-tap-highlight-color: transparent; }
.cs3d-minors input { width: 16px; height: 16px; margin: 0; cursor: pointer; accent-color: #b9acff; flex: 0 0 auto; }
.cs3d-tip { position: absolute; z-index: 4; pointer-events: none; opacity: 0; transition: opacity .12s;
  max-width: 200px; padding: 8px 11px; border-radius: 11px; color: #e7e0ff; font-size: 12px; line-height: 1.45;
  background: rgba(20,14,48,.85); border: 1px solid rgba(143,127,255,.28); box-shadow: 0 8px 26px #0009; }
.cs3d-panel { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 11px; width: min(560px, 90%);
  padding: 9px 13px; border-radius: 14px; background: rgba(20,14,48,.5);
  border: 1px solid rgba(143,127,255,.18); box-shadow: 0 8px 30px #0007; }
.cs3d-play { flex: 0 0 auto; width: 36px; height: 36px; min-width: 36px; padding: 0; border-radius: 50%;
  cursor: pointer; color: #e7e0ff; border: 1px solid rgba(143,127,255,.35);
  background: rgba(143,127,255,.16); font-size: 14px; line-height: 1; }
.cs3d-slider { -webkit-appearance: none; appearance: none; flex: 1 1 auto; width: auto; min-width: 60px;
  height: 6px; padding: 0; border: none; border-radius: 3px; background: rgba(143,127,255,.28); cursor: pointer; }
.cs3d-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px;
  border-radius: 50%; background: #b9acff; border: 2px solid rgba(255,255,255,.5); margin-top: 0; }
.cs3d-slider::-moz-range-thumb { width: 16px; height: 16px; border: none; border-radius: 50%; background: #b9acff; }
.cs3d-slider::-moz-range-track { height: 6px; border-radius: 3px; background: rgba(143,127,255,.28); }
.cs3d-speed { flex: 0 0 auto; width: auto; min-width: 74px; max-width: 104px;
  -webkit-appearance: none; appearance: none; color: #e7e0ff; line-height: 1.1;
  background-color: rgba(143,127,255,.16); border: 1px solid rgba(143,127,255,.32);
  border-radius: 9px; padding: 7px 24px 7px 10px; font-size: 12px; cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%23cbbcff' stroke-width='1.5'><path d='M1 1l4 4 4-4'/></svg>");
  background-repeat: no-repeat; background-position: right 9px center; }
.cs3d-speed option { color: #1a1340; background: #e7e0ff; }
.cs3d-fs { flex: 0 0 auto; width: 36px; height: 36px; min-width: 36px; padding: 0; border-radius: 50%;
  cursor: pointer; color: #e7e0ff; border: 1px solid rgba(143,127,255,.35);
  background: rgba(143,127,255,.16); font-size: 15px; line-height: 1; }
.cs3d:fullscreen { width: 100vw; height: 100vh; border-radius: 0; }
.cs3d:-webkit-full-screen { width: 100vw; height: 100vh; border-radius: 0; }
.cs3d-load { position: absolute; inset: 0; display: grid; place-items: center;
  color: #cbbcff; font-size: 13px; pointer-events: none; }
.cs3d-tt { font-weight: 600; font-size: 13px; }
.cs3d-ts { opacity: .7; margin-top: 1px; }
.cs3d-tm { margin-top: 3px; font-size: 11px; color: #cbbcff; }
@media (max-width: 640px) {
  .cs3d { height: min(86vw, 440px); }   /* quasi-carré : la roue ronde rentre */
  .cs3d-panel { width: calc(100% - 20px); gap: 8px; padding: 8px 10px; }
}
`;

// CIEL-SKY3D-V1 CielSky3D applied
// CIEL-SKY3D-MINORS-V1 applied
// CIEL-SKY3D-DIRECTION-V1 applied

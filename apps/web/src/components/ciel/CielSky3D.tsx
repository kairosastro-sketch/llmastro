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

// ── métadonnées d'affichage (reprises de ZodiacWheel) ──
const GLYPH: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};
const COLOR: Record<string, number> = {
  sun: 0xffd27f, moon: 0xcfd8ff, mercury: 0xb6f0ff, venus: 0xffc8e6, mars: 0xff9b8a,
  jupiter: 0xffe1a8, saturn: 0xd8c9a8, uranus: 0x9ff0e0, neptune: 0xa8c4ff, pluto: 0xd0a8ff,
};
const PMETA: Record<string, [string, string]> = {
  sun: ["Soleil", "identité · vitalité"], moon: ["Lune", "émotions · intuition"],
  mercury: ["Mercure", "pensée · communication"], venus: ["Vénus", "amour · esthétique"],
  mars: ["Mars", "action · désir"], jupiter: ["Jupiter", "expansion · confiance"],
  saturn: ["Saturne", "structure · responsabilité"], uranus: ["Uranus", "rupture · liberté"],
  neptune: ["Neptune", "rêve · idéal"], pluto: ["Pluton", "transformation · pouvoir"],
};
const SIGN_GLYPH = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
const SIGN_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge",
                 "Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
const SIGN_COLOR = [0xff8a6b,0x9fd08a,0xfff0a8,0x8fd0ff,0xff8a6b,0x9fd08a,
                    0xfff0a8,0x8fd0ff,0xff8a6b,0x9fd08a,0xfff0a8,0x8fd0ff];
const ASPECTS = [
  { angle: 0,   orb: 8, color: 0xffffff },
  { angle: 60,  orb: 4, color: 0x8fffd0 },
  { angle: 90,  orb: 6, color: 0xff7a7a },
  { angle: 120, orb: 6, color: 0x9fd0ff },
  { angle: 180, orb: 8, color: 0xff5fa0 },
];

interface SkyFrame { t: string; lon: Record<string, number>; }
interface FramesPayload {
  cadence: "day" | "week" | "month" | "year";
  periodStart: string; periodEnd: string;
  bodies: string[]; frames: SkyFrame[];
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch { return false; }
}

// interpolation de longitude par l'arc le plus court
function lerpLon(a: number, b: number, t: number): number {
  const d = (((b - a) % 360) + 540) % 360 - 180;
  return ((a + d * t) % 360 + 360) % 360;
}
function sep(a: number, b: number): number { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

export function CielSky3D({ cadence }: { cadence: FramesPayload["cadence"] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const playRef = useRef<HTMLButtonElement | null>(null);
  const speedRef = useRef<HTMLSelectElement | null>(null);

  const [state, setState] = useState<"loading" | "ready" | "skip">("loading");
  const framesRef = useRef<FramesPayload | null>(null);

  // 1) WebGL + fetch des frames
  useEffect(() => {
    if (!hasWebGL()) { setState("skip"); return; }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API}/public/sky/${cadence}/frames`);
        const json = await res.json();
        if (!alive) return;
        if (!json?.success || !json.data?.frames?.length) { setState("skip"); return; }
        framesRef.current = json.data as FramesPayload;
        setState("ready");
      } catch { if (alive) setState("skip"); }
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
      // three same-origin — caché du bundler (webpack + turbopack).
      // Littéral inline volontaire : les magic comments ne s'appliquent
      // de façon fiable que sur une chaîne littérale dans import().
      const THREE: any = await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */
        "/vendor/three-0.160.0.module.min.js"
      );
      if (disposed) return;

      const bodies = payload.bodies.filter((b) => payload.frames[0].lon[b] !== undefined);
      const N = payload.frames.length - 1;                 // segments
      const d2r = THREE.MathUtils.degToRad;
      const R = 60, R_RING = 80;

      const ecl = (lon: number, r: number) => new THREE.Vector3(
        r * Math.cos(d2r(lon)), 0, r * Math.sin(d2r(lon)),
      );
      const posAt = (b: string, u: number): number => {
        const i = Math.min(Math.floor(u), N - 1), f = u - i;
        const a = payload.frames[i].lon[b], c = payload.frames[i + 1].lon[b];
        if (a === undefined) return c ?? 0;
        if (c === undefined) return a;
        return lerpLon(a, c, f);
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

      // anneau zodiacal + signes
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(R_RING, R_RING + 14, 128),
        new THREE.MeshBasicMaterial({ color: 0x8f7fff, transparent: true, opacity: .10,
          side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; sky.add(ring);
      for (let i = 0; i < 12; i++) {
        const a = ecl(i * 30, R_RING), b = ecl(i * 30, R_RING + 14);
        sky.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]),
          new THREE.LineBasicMaterial({ color: 0x8f7fff, transparent: true, opacity: .22 })));
        const s2 = sprite(glyphTex(SIGN_GLYPH[i], SIGN_COLOR[i], "s" + i), 9, THREE.NormalBlending, .9);
        s2.position.copy(ecl(i * 30 + 15, R_RING + 28)); sky.add(s2);
      }
      sky.add(sprite(haloTex(0x6f5ad0), 24, THREE.AdditiveBlending, .3)); // noyau

      // planètes (sprites mobiles) + cibles tooltip
      const pickables: any[] = [];
      const planetSprites = bodies.map((b) => {
        const halo = sprite(haloTex(COLOR[b] ?? 0xffffff), 15, THREE.AdditiveBlending, .9);
        const gl = sprite(glyphTex(GLYPH[b] ?? "•", COLOR[b] ?? 0xffffff, "p" + b), 7.5, THREE.NormalBlending);
        halo.userData = { body: b }; pickables.push(halo);
        sky.add(halo, gl); return { b, halo, gl };
      });

      // pool de lignes d'aspect
      const pool = bodies.length * bodies.length;
      const aspectLines = Array.from({ length: pool }, () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        l.frustumCulled = false; sky.add(l); return l;
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

      // ── resize ──
      const resize = () => {
        const w = wrap.clientWidth, h = wrap.clientHeight;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize); ro.observe(wrap); resize();

      // ── tooltips (raycast) ──
      const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
      let active: string | null = null;
      const tip = tipRef.current!;
      const fmtDeg = (lon: number) => {
        const L = ((lon % 360) + 360) % 360, di = L % 30;
        const deg = Math.floor(di), min = Math.floor((di - deg) * 60).toString().padStart(2, "0");
        return { deg, min, si: Math.floor(L / 30) % 12 };
      };
      const tipHtml = (b: string, u: number) => {
        const [name, kw] = PMETA[b] ?? [b, ""];
        const f = fmtDeg(posAt(b, u));
        return `<div class="cs3d-tt">${GLYPH[b] ?? ""} ${name}</div>`
          + (kw ? `<div class="cs3d-ts">${kw}</div>` : "")
          + `<div class="cs3d-tm">${SIGN_GLYPH[f.si]} ${f.deg}°${f.min}' ${SIGN_FR[f.si]}</div>`;
      };
      const pickAt = (cx: number, cy: number) => {
        const rect = wrap.getBoundingClientRect();
        ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
        scene.updateMatrixWorld();
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObjects(pickables, false)[0];
        return hit ? (hit.object.userData.body as string) : null;
      };
      const showTip = (b: string, cx: number, cy: number) => {
        const rect = wrap.getBoundingClientRect();
        active = b; tip.innerHTML = tipHtml(b, idx);
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
        if (e.pointerType === "touch") {                        // tap = tooltip
          if (!moved) { const b = pickAt(downX, downY); if (b) showTip(b, downX, downY); else hideTip(); }
        }
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault(); radius = Math.max(95, Math.min(360, radius + e.deltaY * 0.12));
      };
      // pinch (2 doigts)
      const touchMove = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          if (pinchD) radius = Math.max(95, Math.min(360, radius - (d - pinchD) * 0.4));
          pinchD = d; e.preventDefault();
        }
      };
      const touchEnd = () => { pinchD = 0; };

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("touchmove", touchMove, { passive: false });
      canvas.addEventListener("touchend", touchEnd);

      // ── timeline ──
      let idx = 0, playing = true;
      const SPS = () => N / parseFloat(speedRef.current?.value || "14"); // frames/sec
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
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (playing) { idx += SPS() * dt; if (idx >= N) idx = 0; slider.value = String(idx); }

        for (const ps of planetSprites) {
          const p = ecl(posAt(ps.b, idx), R); ps.halo.position.copy(p); ps.gl.position.copy(p);
        }
        // aspects ciel-interne
        let k = 0;
        for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
          const s = sep(posAt(bodies[i], idx), posAt(bodies[j], idx));
          const asp = ASPECTS.find((a) => Math.abs(s - a.angle) <= a.orb);
          const line = aspectLines[k++];
          if (!asp) { line.material.opacity = 0; continue; }
          const exact = 1 - Math.abs(s - asp.angle) / asp.orb;
          const pa = line.geometry.attributes.position;
          const A = ecl(posAt(bodies[i], idx), R), B = ecl(posAt(bodies[j], idx), R);
          pa.setXYZ(0, A.x, A.y, A.z); pa.setXYZ(1, B.x, B.y, B.z); pa.needsUpdate = true;
          line.material.color.setHex(asp.color); line.material.opacity = 0.12 + 0.45 * exact;
        }
        for (; k < aspectLines.length; k++) aspectLines[k].material.opacity = 0;

        if (active) tip.innerHTML = tipHtml(active, idx);
        updateDate(); updateCam();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("touchmove", touchMove);
        canvas.removeEventListener("touchend", touchEnd);
        renderer.dispose();
        scene.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose?.()); }
        });
        Object.values(texCache).forEach((t: any) => t.dispose?.());
      };
    })();

    return () => { disposed = true; cleanup?.(); };
  }, [state]);

  if (state === "skip") return null;

  return (
    <div className="cs3d" ref={wrapRef} aria-hidden>
      <canvas ref={canvasRef} className="cs3d-canvas" />
      <div className="cs3d-hud"><div className="cs3d-date" ref={dateRef} /></div>
      <div className="cs3d-tip" ref={tipRef} />
      <div className="cs3d-panel">
        <button className="cs3d-play" ref={playRef} type="button" aria-label="lecture / pause">⏸</button>
        <input className="cs3d-slider" ref={sliderRef} type="range" aria-label="date" />
        <select className="cs3d-speed" ref={speedRef} defaultValue="14" aria-label="vitesse">
          <option value="24">lent</option>
          <option value="14">normal</option>
          <option value="7">rapide</option>
        </select>
      </div>
      {state === "loading" && <div className="cs3d-load">Chargement du ciel…</div>}

      <style dangerouslySetInnerHTML={{ __html: CS3D_CSS }} />
    </div>
  );
}

const CS3D_CSS = `
.cs3d { position: relative; width: 100%; height: clamp(360px, 62vh, 560px);
  border-radius: 16px; overflow: hidden; touch-action: none;
  background: radial-gradient(120% 120% at 50% 28%, #241a52 0%, #120c33 45%, #06040f 100%); }
.cs3d-canvas { display: block; width: 100%; height: 100%; }
.cs3d-hud { position: absolute; left: 14px; top: 12px; pointer-events: none; text-shadow: 0 1px 12px #000a; }
.cs3d-date { font-size: 14px; font-weight: 600; color: #e7e0ff; letter-spacing: .01em; text-transform: capitalize; }
.cs3d-tip { position: absolute; z-index: 4; pointer-events: none; opacity: 0; transition: opacity .12s;
  max-width: 200px; padding: 8px 11px; border-radius: 11px; color: #e7e0ff; font-size: 12px; line-height: 1.45;
  background: rgba(20,14,48,.85); border: 1px solid rgba(143,127,255,.28); box-shadow: 0 8px 26px #0009; }
.cs3d-panel { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 11px; width: min(560px, 90%);
  padding: 9px 13px; border-radius: 14px; background: rgba(20,14,48,.5);
  border: 1px solid rgba(143,127,255,.18); box-shadow: 0 8px 30px #0007; }
.cs3d-play { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; color: #e7e0ff;
  border: 1px solid rgba(143,127,255,.35); background: rgba(143,127,255,.14); font-size: 14px; }
.cs3d-slider { flex: 1 1 auto; height: 26px; accent-color: #a99bff; cursor: pointer; }
.cs3d-speed { flex: 0 0 auto; color: #e7e0ff; background: rgba(143,127,255,.14);
  border: 1px solid rgba(143,127,255,.25); border-radius: 9px; padding: 6px 8px; font-size: 12px; cursor: pointer; }
.cs3d-load { position: absolute; inset: 0; display: grid; place-items: center;
  color: #cbbcff; font-size: 13px; pointer-events: none; }
.cs3d-tt { font-weight: 600; font-size: 13px; }
.cs3d-ts { opacity: .7; margin-top: 1px; }
.cs3d-tm { margin-top: 3px; font-size: 11px; color: #cbbcff; }
`;

// CIEL-SKY3D-V1 CielSky3D applied

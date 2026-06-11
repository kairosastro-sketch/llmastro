// SOCIAL-DAILY-POST-V1
//
// Génère le post « Le ciel du jour » prêt à publier :
//   out/YYYY-MM-DD/ciel-<cadence>-YYYY-MM-DD.png   (1080×1350, format portrait Instagram)
//   out/YYYY-MM-DD/caption-<cadence>.txt           (caption FR avec hashtags)
//
// Source : GET https://llmastro.com/api/public/sky/{cadence} (public, sans auth).
// La roue reprend la géométrie de apps/web/src/components/ui/ZodiacWheel.tsx
// (Bélier 0° à 9 h, sens antihoraire) en variante sombre « Céleste ».
//
// Usage :
//   node daily-post.mjs                 # cadence day
//   node daily-post.mjs --cadence week
//   node daily-post.mjs --api-url https://llmastro.com/api --out ./out

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── CLI ─────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const CADENCE = arg("cadence", "day"); // day | week | month
const API_URL = arg("api-url", "https://llmastro.com/api");
const OUT_ROOT = arg("out", join(HERE, "out"));

if (!["day", "week", "month"].includes(CADENCE)) {
  console.error(`Cadence inconnue: ${CADENCE} (attendu: day | week | month)`);
  process.exit(1);
}

// ── Tokens Céleste (dark) — cf. apps/web/src/app/globals.css ──
const C = {
  bg: "#14102e",
  bg2: "#1d1747",
  bg3: "#2a2168",
  gold: "#e6cb8e",
  goldL: "#f3e2b4",
  violet: "#a896e0",
  violetD: "#7c68c4",
  text: "#f3f0fb",
  textMuted: "#b0adc8",
  peach: "#eaa98a",
  harmony: "#3ecf8e",
  tension: "#e54545",
  neutral: "#d4a017",
};

// Variantes éclaircies des couleurs planètes de ZodiacWheel.tsx (lisibles sur fond sombre)
const PLANETS_DARK = {
  sun:       { fr: "Soleil",    glyph: "☉", color: "#e8a84c" },
  moon:      { fr: "Lune",      glyph: "☽", color: "#b8b3d1" },
  mercury:   { fr: "Mercure",   glyph: "☿", color: "#6ea8f0" },
  venus:     { fr: "Vénus",     glyph: "♀", color: "#ef82b4" },
  mars:      { fr: "Mars",      glyph: "♂", color: "#f87171" },
  jupiter:   { fr: "Jupiter",   glyph: "♃", color: "#54c08a" },
  saturn:    { fr: "Saturne",   glyph: "♄", color: "#a78bfa" },
  uranus:    { fr: "Uranus",    glyph: "♅", color: "#4cc3e0" },
  neptune:   { fr: "Neptune",   glyph: "♆", color: "#7d8cf0" },
  pluto:     { fr: "Pluton",    glyph: "♇", color: "#b48ad6" },
  northNode: { fr: "Nœud Nord", glyph: "☊", color: "#d4b06a" },
};
// Points non dessinés sur la roue mais nommables dans la caption (aspects)
const POINT_NAMES = {
  ...Object.fromEntries(Object.entries(PLANETS_DARK).map(([k, v]) => [k, v.fr])),
  southNode: "Nœud Sud",
  lilith: "Lilith",
  fortune: "Part de Fortune",
  chiron: "Chiron",
};

const SIGNS = [
  { fr: "Bélier",     glyph: "♈", element: "fire"  },
  { fr: "Taureau",    glyph: "♉", element: "earth" },
  { fr: "Gémeaux",    glyph: "♊", element: "air"   },
  { fr: "Cancer",     glyph: "♋", element: "water" },
  { fr: "Lion",       glyph: "♌", element: "fire"  },
  { fr: "Vierge",     glyph: "♍", element: "earth" },
  { fr: "Balance",    glyph: "♎", element: "air"   },
  { fr: "Scorpion",   glyph: "♏", element: "water" },
  { fr: "Sagittaire", glyph: "♐", element: "fire"  },
  { fr: "Capricorne", glyph: "♑", element: "earth" },
  { fr: "Verseau",    glyph: "♒", element: "air"   },
  { fr: "Poissons",   glyph: "♓", element: "water" },
];
const ELEMENT_FILL_DARK = {
  fire:  "rgba(228, 90, 70, 0.10)",
  earth: "rgba(62, 207, 142, 0.07)",
  air:   "rgba(110, 168, 240, 0.09)",
  water: "rgba(125, 140, 240, 0.11)",
};

// ── Géométrie (reprise de ZodiacWheel.tsx, mise à l'échelle) ──
const W = 1080, H = 1350;
const CX = 540, CY = 625;
const R_OUTER = 400, R_SIGN_IN = 338, R_GLYPH = 369, R_PLANET = 278, R_ASPECT = 200;

// Bélier 0° ancré à gauche (9 h), séquence antihoraire — identique à lonToXY du composant web.
function lonToXY(lon, r, cx = CX, cy = CY) {
  const theta = ((180 + lon) * Math.PI) / 180;
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

// Écarte angulairement les planètes trop proches (port de spreadPlanets du composant web).
function spreadPlanets(planets, minDeg = 11) {
  const sorted = planets
    .map((p) => ({ ...p, displayLongitude: p.longitude }))
    .sort((a, b) => a.displayLongitude - b.displayLongitude);
  let changed = true, iter = 0;
  while (changed && iter < 30) {
    changed = false; iter++;
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length];
      const curr = sorted[i];
      const diff = ((next.displayLongitude - curr.displayLongitude) + 360) % 360;
      if (diff < minDeg) {
        const push = (minDeg - diff) / 2;
        curr.displayLongitude = ((curr.displayLongitude - push) + 360) % 360;
        next.displayLongitude = (next.displayLongitude + push) % 360;
        changed = true;
      }
    }
  }
  return sorted;
}

// PRNG déterministe (seedé par la date) pour le champ d'étoiles — même image si on relance le même jour.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const deg = (lon) => `${Math.floor(lon % 30)}°`;

// ── Fetch ───────────────────────────────────────────────────
async function fetchSky() {
  const url = `${API_URL}/public/sky/${CADENCE}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${url} → HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.success || !json?.data?.data) throw new Error(`Réponse inattendue de ${url}`);
  return json.data;
}

// ── Construction du SVG ─────────────────────────────────────
function buildSVG(sky) {
  const d = sky.data;
  const parts = [];

  // Fond + étoiles
  const dateKey = (sky.periodStart || "").slice(0, 10);
  const rng = mulberry32([...dateKey].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
  let stars = "";
  for (let i = 0; i < 90; i++) {
    const x = (rng() * W).toFixed(1), y = (rng() * H).toFixed(1);
    const r = (0.6 + rng() * 1.4).toFixed(2), o = (0.15 + rng() * 0.5).toFixed(2);
    stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.text}" opacity="${o}"/>`;
  }
  parts.push(`
    <defs>
      <radialGradient id="bgGrad" cx="50%" cy="46%" r="75%">
        <stop offset="0%" stop-color="${C.bg2}"/>
        <stop offset="100%" stop-color="${C.bg}"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
    ${stars}`);

  // En-tête
  const dateObj = new Date(sky.periodStart);
  const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const dateLabel = fmt.format(dateObj).replace(/^./, (c) => c.toUpperCase());
  const headerLabel = { day: "LE CIEL DU JOUR", week: "LE CIEL DE LA SEMAINE", month: "LE CIEL DU MOIS" }[CADENCE];
  parts.push(`
    <text x="${CX}" y="92" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="26" letter-spacing="10" fill="${C.gold}">${headerLabel}</text>
    <text x="${CX}" y="152" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="46" font-weight="600" fill="${C.text}">${esc(dateLabel)}</text>`);

  // Bande des signes : secteurs teintés par élément + séparateurs + glyphes
  for (let i = 0; i < 12; i++) {
    const a0 = i * 30, a1 = (i + 1) * 30;
    const p1 = lonToXY(a0, R_OUTER), p2 = lonToXY(a1, R_OUTER);
    const p3 = lonToXY(a1, R_SIGN_IN), p4 = lonToXY(a0, R_SIGN_IN);
    parts.push(`<path d="M ${p1.x} ${p1.y} A ${R_OUTER} ${R_OUTER} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${R_SIGN_IN} ${R_SIGN_IN} 0 0 0 ${p4.x} ${p4.y} Z" fill="${ELEMENT_FILL_DARK[SIGNS[i].element]}"/>`);
    const s1 = lonToXY(a0, R_SIGN_IN), s2 = lonToXY(a0, R_OUTER);
    parts.push(`<line x1="${s1.x}" y1="${s1.y}" x2="${s2.x}" y2="${s2.y}" stroke="rgba(168,150,224,0.35)" stroke-width="1"/>`);
    const g = lonToXY(a0 + 15, R_GLYPH);
    parts.push(`<text x="${g.x}" y="${g.y}" text-anchor="middle" dominant-baseline="central" font-family="Segoe UI Symbol" font-size="34" fill="${C.gold}">${SIGNS[i].glyph}</text>`);
  }
  parts.push(`
    <circle cx="${CX}" cy="${CY}" r="${R_OUTER}" fill="none" stroke="${C.violetD}" stroke-width="2"/>
    <circle cx="${CX}" cy="${CY}" r="${R_SIGN_IN}" fill="none" stroke="rgba(168,150,224,0.45)" stroke-width="1.2"/>
    <circle cx="${CX}" cy="${CY}" r="${R_ASPECT}" fill="none" stroke="rgba(168,150,224,0.18)" stroke-width="1"/>`);

  // Planètes (longitudes vraies pour ticks/aspects, écartées pour l'affichage)
  const drawn = Object.entries(PLANETS_DARK)
    .filter(([key]) => d.planets[key])
    .map(([key, meta]) => ({ key, ...meta, longitude: d.planets[key].longitude, retrograde: !!d.planets[key].retrograde }));
  const spread = spreadPlanets(drawn);

  // Aspects : uniquement serrés, entre planètes dessinées, top 10 par priorité
  const drawnKeys = new Set(drawn.map((p) => p.key));
  const toneColor = { harmony: C.harmony, tension: C.tension, neutral: C.neutral };
  const wheelAspects = (d.aspects || [])
    .filter((a) => a.tight && drawnKeys.has(a.transitPlanet) && drawnKeys.has(a.natalPlanet))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
  const lonOf = (key) => drawn.find((p) => p.key === key).longitude;
  for (const a of wheelAspects) {
    const p1 = lonToXY(lonOf(a.transitPlanet), R_ASPECT);
    const p2 = lonToXY(lonOf(a.natalPlanet), R_ASPECT);
    const color = toneColor[a.tone] || C.neutral;
    const sw = a.exact ? 2.2 : 1.3;
    parts.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="${sw}" opacity="${a.exact ? 0.9 : 0.55}"/>
      <circle cx="${p1.x}" cy="${p1.y}" r="3" fill="${color}"/><circle cx="${p2.x}" cy="${p2.y}" r="3" fill="${color}"/>`);
  }

  // Pastilles planètes + tick sur la longitude vraie
  for (const p of spread) {
    const t1 = lonToXY(p.longitude, R_SIGN_IN - 12), t2 = lonToXY(p.longitude, R_SIGN_IN);
    parts.push(`<line x1="${t1.x}" y1="${t1.y}" x2="${t2.x}" y2="${t2.y}" stroke="${p.color}" stroke-width="2.5"/>`);
    const pos = lonToXY(p.displayLongitude, R_PLANET);
    parts.push(`
      <circle cx="${pos.x}" cy="${pos.y}" r="27" fill="${C.bg2}" stroke="${p.color}" stroke-width="2"/>
      <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" font-family="Segoe UI Symbol" font-size="30" fill="${C.text}">${p.glyph}</text>`);
    if (p.retrograde) {
      parts.push(`<text x="${pos.x + 21}" y="${pos.y - 17}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" font-weight="600" fill="${C.peach}">R</text>`);
    }
  }

  // Pied : phase de lune (icône dessinée — pas d'emoji, resvg ne les rend pas) + aspect du jour + URL
  const mp = d.moonPhase || {};
  const illum = Math.round((mp.illumination ?? 0) * 100);
  const moonIcon = buildMoonIcon(150, 1106, 17, mp);
  const moonLabel = `${mp.phase || "Lune"} · ${illum} % d'illumination`;
  parts.push(moonIcon);
  parts.push(`<text x="186" y="1106" dominant-baseline="central" font-family="Segoe UI, sans-serif" font-size="27" fill="${C.textMuted}">${esc(moonLabel)}</text>`);

  const top = pickTopAspects(d.aspects, 1)[0];
  if (top) {
    const label = `${POINT_NAMES[top.transitPlanet] || top.transitPlanet}  ${top.symbol}  ${POINT_NAMES[top.natalPlanet] || top.natalPlanet}`;
    const detail = `${top.typeFr}${top.exact ? " exact" : ""} · orbe ${top.orb.toFixed(1)}°`;
    parts.push(`
      <text x="150" y="1163" font-family="Segoe UI, Segoe UI Symbol, sans-serif" font-size="31" font-weight="600" fill="${C.text}">${esc(label)}</text>
      <text x="150" y="1202" font-family="Segoe UI, sans-serif" font-size="24" fill="${toneColor[top.tone] || C.neutral}">${esc(detail)}</text>`);
  }

  parts.push(`
    <line x1="150" y1="1244" x2="930" y2="1244" stroke="rgba(168,150,224,0.3)" stroke-width="1"/>
    <text x="150" y="1296" font-family="Segoe UI, sans-serif" font-size="33" font-weight="600" fill="${C.gold}">llmastro.com/ciel</text>
    <text x="930" y="1296" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="21" fill="${C.textMuted}">Positions calculées au degré près</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("\n")}</svg>`;
}

// Icône de phase lunaire en SVG pur : disque sombre + portion éclairée.
// Le sens (croissant/décroissant) est déduit de la clé API (wax/wan).
function buildMoonIcon(cx, cy, r, mp) {
  const illum = Math.max(0, Math.min(1, mp.illumination ?? 0));
  const waning = /wan/i.test(mp.key || "");
  const dark = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.bg3}" stroke="${C.violetD}" stroke-width="1.2"/>`;
  if (illum < 0.02) return dark;
  if (illum > 0.98) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.goldL}" stroke="${C.violetD}" stroke-width="1.2"/>`;
  // Terminateur : demi-disque éclairé + ellipse qui bombe (gibbeuse) ou creuse (croissant)
  const lightOnRight = !waning; // croissante : lumière à droite (hémisphère nord)
  const sweep = lightOnRight ? 1 : 0;
  const half = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweep} ${cx} ${cy + r}`;
  const rx = Math.abs(2 * illum - 1) * r;
  const bulge = illum >= 0.5 ? (lightOnRight ? 0 : 1) : (lightOnRight ? 1 : 0);
  const term = ` A ${rx} ${r} 0 0 ${bulge} ${cx} ${cy - r} Z`;
  return dark + `<path d="${half}${term}" fill="${C.goldL}"/>`;
}

// Aspects "phares" pour la caption et le bandeau : serrés, priorité décroissante,
// avec un bonus aux aspects impliquant une planète rapide — les configurations
// lentes (Neptune ⚹ Pluton…) durent des mois et donneraient le même post chaque jour.
// On écarte l'opposition Nœud Nord/Sud (toujours présente, zéro information).
const FAST_PLANETS = new Set(["sun", "moon", "mercury", "venus", "mars"]);
function pickTopAspects(aspects, n) {
  const score = (a) =>
    a.priority + (FAST_PLANETS.has(a.transitPlanet) || FAST_PLANETS.has(a.natalPlanet) ? 100 : 0);
  return (aspects || [])
    .filter((a) => a.tight)
    .filter((a) => !(/[nN]ode$/.test(a.transitPlanet) && /[nN]ode$/.test(a.natalPlanet)))
    .sort((a, b) => score(b) - score(a))
    .slice(0, n);
}

// ── Caption ─────────────────────────────────────────────────
function buildCaption(sky) {
  const d = sky.data;
  const dateObj = new Date(sky.periodStart);
  const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const intro = { day: `✨ Le ciel du ${fmt.format(dateObj)}`, week: `✨ Le ciel de la semaine du ${fmt.format(dateObj)}`, month: `✨ Le ciel du mois` }[CADENCE];

  const lines = [intro, ""];

  const mp = d.moonPhase || {};
  if (mp.phase) {
    const illum = Math.round((mp.illumination ?? 0) * 100);
    const descr = mp.description ? ` — ${mp.description.toLowerCase()}` : "";
    lines.push(`${mp.emoji || "🌙"} ${mp.phase} (${illum} %)${descr}`, "");
  }

  const sunMoon = ["sun", "moon", "mercury", "venus", "mars"]
    .filter((k) => d.planets[k])
    .map((k) => {
      const p = d.planets[k];
      const retro = p.retrograde ? " ℞" : "";
      return `${PLANETS_DARK[k].glyph} ${SIGNS[p.signIdx]?.fr ?? "?"} ${deg(p.longitude)}${retro}`;
    });
  lines.push(sunMoon.join(" · "), "");

  const tops = pickTopAspects(d.aspects, 3);
  if (tops.length) {
    lines.push("Aspects du moment :");
    for (const a of tops) {
      const exact = a.exact ? " (exact)" : "";
      lines.push(`${a.symbol} ${POINT_NAMES[a.transitPlanet] || a.transitPlanet} ${a.typeFr.toLowerCase()} ${POINT_NAMES[a.natalPlanet] || a.natalPlanet}${exact}`);
    }
    lines.push("");
  }

  if (sky.llmText) {
    lines.push(trimAtSentence(sky.llmText, 600), "");
  }

  lines.push("Lecture complète, calculée au degré près → llmastro.com/ciel", "");
  const cadenceTag = { day: "#cieldujour", week: "#cieldelasemaine", month: "#cieldumois" }[CADENCE];
  lines.push(`#astrologie ${cadenceTag} #astro #transits #lune #horoscope #astrologiefrancaise #zodiaque`);
  return lines.join("\n");
}

function trimAtSentence(text, maxLen) {
  if (text.length <= maxLen) return text.trim();
  const cut = text.slice(0, maxLen);
  const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastDot > maxLen * 0.4 ? cut.slice(0, lastDot + 1) : cut + "…").trim();
}

// ── Rendu PNG ───────────────────────────────────────────────
function renderPNG(svg) {
  const fontFiles = [
    "C:\\Windows\\Fonts\\segoeui.ttf",
    "C:\\Windows\\Fonts\\segoeuib.ttf",
    "C:\\Windows\\Fonts\\seguisym.ttf", // Segoe UI Symbol — glyphes planétaires et zodiacaux
  ].filter((f) => existsSync(f));
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { loadSystemFonts: true, fontFiles, defaultFontFamily: "Segoe UI" },
    background: C.bg,
  });
  return resvg.render().asPng();
}

// ── Main ────────────────────────────────────────────────────
const sky = await fetchSky();
const dateKey = (sky.periodStart || new Date().toISOString()).slice(0, 10);
const outDir = join(OUT_ROOT, dateKey);
mkdirSync(outDir, { recursive: true });

const svg = buildSVG(sky);
const png = renderPNG(svg);
const caption = buildCaption(sky);

const pngPath = join(outDir, `ciel-${CADENCE}-${dateKey}.png`);
const captionPath = join(outDir, `caption-${CADENCE}.txt`);
writeFileSync(pngPath, png);
writeFileSync(join(outDir, `ciel-${CADENCE}-${dateKey}.svg`), svg, "utf8");
writeFileSync(captionPath, caption, "utf8");
writeFileSync(join(outDir, `sky-${CADENCE}.json`), JSON.stringify(sky, null, 2), "utf8");

if (!sky.llmText) console.warn("⚠ llmText absent de la réponse API — caption générée sans la lecture IA.");
console.log(`✓ ${pngPath}`);
console.log(`✓ ${captionPath}`);

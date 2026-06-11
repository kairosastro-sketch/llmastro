// ============================================================
// ADMIN-SOCIAL-POST-V1
// apps/web/src/lib/social-post.ts
// ------------------------------------------------------------
// Builder du post « Le ciel du jour » (SVG 1080×1350 + caption FR),
// porté de scripts/social/daily-post.mjs (SOCIAL-DAILY-POST-V1) pour
// la page /admin/social. Même géométrie que ZodiacWheel.tsx (Bélier
// 0° à 9 h, sens antihoraire), variante sombre « Céleste ».
//
// Le script CLI reste la référence pour l'automatisation Windows
// (tâche planifiée) ; ce module est son équivalent navigateur — le
// rendu PNG se fait côté client via <canvas>, sans resvg.
// ============================================================

export type SocialCadence = "day" | "week" | "month";

export interface SkyPayload {
  periodStart?: string;
  llmText?: string;
  data: {
    planets: Record<string, { longitude: number; signIdx?: number; retrograde?: boolean }>;
    aspects?: SkyAspect[];
    moonPhase?: {
      key?: string; phase?: string; emoji?: string;
      illumination?: number; description?: string;
    };
  };
}

export interface SkyAspect {
  transitPlanet: string;
  natalPlanet: string;
  type: string;
  typeFr: string;
  symbol: string;
  tone: "harmony" | "tension" | "neutral";
  orb: number;
  exact: boolean;
  tight: boolean;
  priority: number;
}

export const SOCIAL_W = 1080;
export const SOCIAL_H = 1350;

// ── Tokens Céleste (dark) — cf. globals.css ─────────────────
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

const PLANETS_DARK: Record<string, { fr: string; glyph: string; color: string }> = {
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

const POINT_NAMES: Record<string, string> = {
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
] as const;

const ELEMENT_FILL_DARK: Record<string, string> = {
  fire:  "rgba(228, 90, 70, 0.10)",
  earth: "rgba(62, 207, 142, 0.07)",
  air:   "rgba(110, 168, 240, 0.09)",
  water: "rgba(125, 140, 240, 0.11)",
};

// ── Géométrie ───────────────────────────────────────────────
const W = SOCIAL_W, H = SOCIAL_H;
const CX = 540, CY = 625;
const R_OUTER = 400, R_SIGN_IN = 338, R_GLYPH = 369, R_PLANET = 278, R_ASPECT = 200;

const FONT_SANS = "Segoe UI, system-ui, sans-serif";
const FONT_SYM  = "Segoe UI Symbol, Segoe UI, system-ui, sans-serif";

function lonToXY(lon: number, r: number, cx = CX, cy = CY): { x: number; y: number } {
  const theta = ((180 + lon) * Math.PI) / 180;
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

interface DrawnPlanet {
  key: string; fr: string; glyph: string; color: string;
  longitude: number; retrograde: boolean; displayLongitude: number;
}

function spreadPlanets(planets: Omit<DrawnPlanet, "displayLongitude">[], minDeg = 11): DrawnPlanet[] {
  const sorted: DrawnPlanet[] = planets
    .map((p) => ({ ...p, displayLongitude: p.longitude }))
    .sort((a, b) => a.displayLongitude - b.displayLongitude);
  let changed = true, iter = 0;
  while (changed && iter < 30) {
    changed = false; iter++;
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length]!;
      const curr = sorted[i]!;
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

// PRNG déterministe (seedé par la date) — même image si on régénère le même jour.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s: unknown) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const degInSign = (lon: number) => `${Math.floor(lon % 30)}°`;

// Aspects « phares » : serrés, priorité décroissante, bonus planètes rapides ;
// l'opposition Nœud Nord/Sud (permanente) est exclue.
const FAST_PLANETS = new Set(["sun", "moon", "mercury", "venus", "mars"]);
function pickTopAspects(aspects: SkyAspect[] | undefined, n: number): SkyAspect[] {
  const score = (a: SkyAspect) =>
    a.priority + (FAST_PLANETS.has(a.transitPlanet) || FAST_PLANETS.has(a.natalPlanet) ? 100 : 0);
  return (aspects || [])
    .filter((a) => a.tight)
    .filter((a) => !(/[nN]ode$/.test(a.transitPlanet) && /[nN]ode$/.test(a.natalPlanet)))
    .sort((a, b) => score(b) - score(a))
    .slice(0, n);
}

// Icône de phase lunaire en SVG pur (croissant/gibbeuse selon wax/wan).
function buildMoonIcon(cx: number, cy: number, r: number, mp: NonNullable<SkyPayload["data"]["moonPhase"]>): string {
  const illum = Math.max(0, Math.min(1, mp.illumination ?? 0));
  const waning = /wan/i.test(mp.key || "");
  const dark = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.bg3}" stroke="${C.violetD}" stroke-width="1.2"/>`;
  if (illum < 0.02) return dark;
  if (illum > 0.98) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.goldL}" stroke="${C.violetD}" stroke-width="1.2"/>`;
  const lightOnRight = !waning;
  const sweep = lightOnRight ? 1 : 0;
  const half = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweep} ${cx} ${cy + r}`;
  const rx = Math.abs(2 * illum - 1) * r;
  const bulge = illum >= 0.5 ? (lightOnRight ? 0 : 1) : (lightOnRight ? 1 : 0);
  const term = ` A ${rx} ${r} 0 0 ${bulge} ${cx} ${cy - r} Z`;
  return dark + `<path d="${half}${term}" fill="${C.goldL}"/>`;
}

function frDate(iso: string | undefined, opts: Intl.DateTimeFormatOptions): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "Europe/Paris" });
  return fmt.format(new Date(iso ?? Date.now()));
}

// ── SVG ─────────────────────────────────────────────────────
export function buildSocialSVG(sky: SkyPayload, cadence: SocialCadence): string {
  const d = sky.data;
  const parts: string[] = [];

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

  const dateLabel = frDate(sky.periodStart, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
  const headerLabel = { day: "LE CIEL DU JOUR", week: "LE CIEL DE LA SEMAINE", month: "LE CIEL DU MOIS" }[cadence];
  parts.push(`
    <text x="${CX}" y="92" text-anchor="middle" font-family="${FONT_SANS}" font-size="26" letter-spacing="10" fill="${C.gold}">${headerLabel}</text>
    <text x="${CX}" y="152" text-anchor="middle" font-family="${FONT_SANS}" font-size="46" font-weight="600" fill="${C.text}">${esc(dateLabel)}</text>`);

  for (let i = 0; i < 12; i++) {
    const a0 = i * 30, a1 = (i + 1) * 30;
    const p1 = lonToXY(a0, R_OUTER), p2 = lonToXY(a1, R_OUTER);
    const p3 = lonToXY(a1, R_SIGN_IN), p4 = lonToXY(a0, R_SIGN_IN);
    parts.push(`<path d="M ${p1.x} ${p1.y} A ${R_OUTER} ${R_OUTER} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${R_SIGN_IN} ${R_SIGN_IN} 0 0 0 ${p4.x} ${p4.y} Z" fill="${ELEMENT_FILL_DARK[SIGNS[i]!.element]}"/>`);
    const s1 = lonToXY(a0, R_SIGN_IN), s2 = lonToXY(a0, R_OUTER);
    parts.push(`<line x1="${s1.x}" y1="${s1.y}" x2="${s2.x}" y2="${s2.y}" stroke="rgba(168,150,224,0.35)" stroke-width="1"/>`);
    const g = lonToXY(a0 + 15, R_GLYPH);
    parts.push(`<text x="${g.x}" y="${g.y}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_SYM}" font-size="34" fill="${C.gold}">${SIGNS[i]!.glyph}</text>`);
  }
  parts.push(`
    <circle cx="${CX}" cy="${CY}" r="${R_OUTER}" fill="none" stroke="${C.violetD}" stroke-width="2"/>
    <circle cx="${CX}" cy="${CY}" r="${R_SIGN_IN}" fill="none" stroke="rgba(168,150,224,0.45)" stroke-width="1.2"/>
    <circle cx="${CX}" cy="${CY}" r="${R_ASPECT}" fill="none" stroke="rgba(168,150,224,0.18)" stroke-width="1"/>`);

  const drawn = Object.entries(PLANETS_DARK)
    .filter(([key]) => d.planets[key])
    .map(([key, meta]) => ({
      key, ...meta,
      longitude: d.planets[key]!.longitude,
      retrograde: !!d.planets[key]!.retrograde,
    }));
  const spread = spreadPlanets(drawn);

  const drawnKeys = new Set(drawn.map((p) => p.key));
  const toneColor: Record<string, string> = { harmony: C.harmony, tension: C.tension, neutral: C.neutral };
  const wheelAspects = (d.aspects || [])
    .filter((a) => a.tight && drawnKeys.has(a.transitPlanet) && drawnKeys.has(a.natalPlanet))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
  const lonOf = (key: string) => drawn.find((p) => p.key === key)!.longitude;
  for (const a of wheelAspects) {
    const p1 = lonToXY(lonOf(a.transitPlanet), R_ASPECT);
    const p2 = lonToXY(lonOf(a.natalPlanet), R_ASPECT);
    const color = toneColor[a.tone] || C.neutral;
    const sw = a.exact ? 2.2 : 1.3;
    parts.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="${sw}" opacity="${a.exact ? 0.9 : 0.55}"/>
      <circle cx="${p1.x}" cy="${p1.y}" r="3" fill="${color}"/><circle cx="${p2.x}" cy="${p2.y}" r="3" fill="${color}"/>`);
  }

  for (const p of spread) {
    const t1 = lonToXY(p.longitude, R_SIGN_IN - 12), t2 = lonToXY(p.longitude, R_SIGN_IN);
    parts.push(`<line x1="${t1.x}" y1="${t1.y}" x2="${t2.x}" y2="${t2.y}" stroke="${p.color}" stroke-width="2.5"/>`);
    const pos = lonToXY(p.displayLongitude, R_PLANET);
    parts.push(`
      <circle cx="${pos.x}" cy="${pos.y}" r="27" fill="${C.bg2}" stroke="${p.color}" stroke-width="2"/>
      <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_SYM}" font-size="30" fill="${C.text}">${p.glyph}</text>`);
    if (p.retrograde) {
      parts.push(`<text x="${pos.x + 21}" y="${pos.y - 17}" text-anchor="middle" font-family="${FONT_SANS}" font-size="16" font-weight="600" fill="${C.peach}">R</text>`);
    }
  }

  const mp = d.moonPhase || {};
  const illum = Math.round((mp.illumination ?? 0) * 100);
  parts.push(buildMoonIcon(150, 1106, 17, mp));
  parts.push(`<text x="186" y="1106" dominant-baseline="central" font-family="${FONT_SANS}" font-size="27" fill="${C.textMuted}">${esc(`${mp.phase || "Lune"} · ${illum} % d'illumination`)}</text>`);

  const top = pickTopAspects(d.aspects, 1)[0];
  if (top) {
    const label = `${POINT_NAMES[top.transitPlanet] || top.transitPlanet}  ${top.symbol}  ${POINT_NAMES[top.natalPlanet] || top.natalPlanet}`;
    const detail = `${top.typeFr}${top.exact ? " exact" : ""} · orbe ${top.orb.toFixed(1)}°`;
    parts.push(`
      <text x="150" y="1163" font-family="${FONT_SYM}" font-size="31" font-weight="600" fill="${C.text}">${esc(label)}</text>
      <text x="150" y="1202" font-family="${FONT_SANS}" font-size="24" fill="${toneColor[top.tone] || C.neutral}">${esc(detail)}</text>`);
  }

  parts.push(`
    <line x1="150" y1="1244" x2="930" y2="1244" stroke="rgba(168,150,224,0.3)" stroke-width="1"/>
    <text x="150" y="1296" font-family="${FONT_SANS}" font-size="33" font-weight="600" fill="${C.gold}">llmastro.com/ciel</text>
    <text x="930" y="1296" text-anchor="end" font-family="${FONT_SANS}" font-size="21" fill="${C.textMuted}">Positions calculées au degré près</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("\n")}</svg>`;
}

// ── Caption ─────────────────────────────────────────────────
function trimAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text.trim();
  const cut = text.slice(0, maxLen);
  const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastDot > maxLen * 0.4 ? cut.slice(0, lastDot + 1) : cut + "…").trim();
}

export function buildSocialCaption(sky: SkyPayload, cadence: SocialCadence): string {
  const d = sky.data;
  const dateStr = frDate(sky.periodStart, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const intro = {
    day: `✨ Le ciel du ${dateStr}`,
    week: `✨ Le ciel de la semaine du ${dateStr}`,
    month: `✨ Le ciel du mois`,
  }[cadence];

  const lines: string[] = [intro, ""];

  const mp = d.moonPhase || {};
  if (mp.phase) {
    const illum = Math.round((mp.illumination ?? 0) * 100);
    const descr = mp.description ? ` — ${mp.description.toLowerCase()}` : "";
    lines.push(`${mp.emoji || "🌙"} ${mp.phase} (${illum} %)${descr}`, "");
  }

  const sunMoon = ["sun", "moon", "mercury", "venus", "mars"]
    .filter((k) => d.planets[k])
    .map((k) => {
      const p = d.planets[k]!;
      const retro = p.retrograde ? " ℞" : "";
      return `${PLANETS_DARK[k]!.glyph} ${SIGNS[p.signIdx ?? Math.floor(p.longitude / 30)]?.fr ?? "?"} ${degInSign(p.longitude)}${retro}`;
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
  const cadenceTag = { day: "#cieldujour", week: "#cieldelasemaine", month: "#cieldumois" }[cadence];
  lines.push(`#astrologie ${cadenceTag} #astro #transits #lune #horoscope #astrologiefrancaise #zodiaque`);
  return lines.join("\n");
}

// ADMIN-SOCIAL-POST-V1 applied

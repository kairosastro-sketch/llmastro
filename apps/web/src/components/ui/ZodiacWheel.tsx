"use client";

// ARCHIVE-2-ZODIAC-WHEEL-V1
//
// Refonte visuelle — fond clair parchemin, pastilles crème, aspects ring-based,
// tooltips enrichis (planètes / signes / maisons), maisons en chiffres romains,
// ticks radiaux pour stelliums, prénom au centre, responsive compact automatique.
// API publique inchangée (back-compat avec /dashboard/wheel et /dashboard/transits).

import React, {
  useRef, useState, useEffect, useCallback, useMemo,
} from "react";
import { useT, useApp } from "@/lib/i18n";
import "./ZodiacWheel.css";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────
export interface WheelPlanet {
  name:       string;
  glyph:      string;
  longitude:  number;
  retrograde?: boolean;
  color?:     string;
}

export interface WheelHouse {
  number:    number;
  longitude: number;
}

export interface ZodiacWheelProps {
  planets?:        WheelPlanet[];
  transitPlanets?: WheelPlanet[];
  houses?:         WheelHouse[];
  ascendant?:      number;
  mc?:             number;
  showHouses?:        boolean;
  showAspects?:       boolean;
  showPlanets?:       boolean;
  /** ARCHIVE-LANDING-EPHEMERIDES-POLISH-V2 : cache la barre de toggles UI (default true) */
  showLayerToggles?:  boolean;
  /** ARCHIVE-LANDING-EPHEMERIDES-POLISH-V2 : cache les boutons zoom/export (default true) */
  showControls?:      boolean;
  /** ARCHIVE-LANDING-HERO-IMMERSIVE-V1 : enlève le fond parchemin du SVG (default false) */
  transparentBackground?: boolean;
  chartName?:      string;
  /** Prénom affiché au centre en mode natal. Fallback : premier mot de chartName. */
  firstName?:      string;
  /** Force le mode compact (responsive). Sinon détecté via ResizeObserver. */
  compact?:        boolean;
  className?:      string;
}

// ──────────────────────────────────────────────────────────
// Constantes — signes, éléments, planètes, maisons, aspects
// ──────────────────────────────────────────────────────────
type Element = "fire" | "earth" | "air" | "water";

interface SignMeta {
  fr: string; en: string; short: string; shortEn: string;
  glyph: string; element: Element;
  kwFr: string; kwEn: string;
}

const SIGNS: SignMeta[] = [
  { fr: "Bélier",     en: "Aries",       short: "Bél",  shortEn: "ARI", glyph: "♈", element: "fire",  kwFr: "initiative",  kwEn: "initiative"  },
  { fr: "Taureau",    en: "Taurus",      short: "Tau",  shortEn: "TAU", glyph: "♉", element: "earth", kwFr: "sensualité",  kwEn: "sensuality"  },
  { fr: "Gémeaux",    en: "Gemini",      short: "Gém",  shortEn: "GEM", glyph: "♊", element: "air",   kwFr: "curiosité",   kwEn: "curiosity"   },
  { fr: "Cancer",     en: "Cancer",      short: "Can",  shortEn: "CAN", glyph: "♋", element: "water", kwFr: "sensibilité", kwEn: "sensitivity" },
  { fr: "Lion",       en: "Leo",         short: "Lion", shortEn: "LEO", glyph: "♌", element: "fire",  kwFr: "rayonnement", kwEn: "radiance"    },
  { fr: "Vierge",     en: "Virgo",       short: "Vier", shortEn: "VIR", glyph: "♍", element: "earth", kwFr: "analyse",     kwEn: "analysis"    },
  { fr: "Balance",    en: "Libra",       short: "Bal",  shortEn: "LIB", glyph: "♎", element: "air",   kwFr: "harmonie",    kwEn: "harmony"     },
  { fr: "Scorpion",   en: "Scorpio",     short: "Scor", shortEn: "SCO", glyph: "♏", element: "water", kwFr: "intensité",   kwEn: "intensity"   },
  { fr: "Sagittaire", en: "Sagittarius", short: "Sag",  shortEn: "SAG", glyph: "♐", element: "fire",  kwFr: "aventure",    kwEn: "adventure"   },
  { fr: "Capricorne", en: "Capricorn",   short: "Cap",  shortEn: "CAP", glyph: "♑", element: "earth", kwFr: "ambition",    kwEn: "ambition"    },
  { fr: "Verseau",    en: "Aquarius",    short: "Vers", shortEn: "AQU", glyph: "♒", element: "air",   kwFr: "innovation",  kwEn: "innovation"  },
  { fr: "Poissons",   en: "Pisces",      short: "Poi",  shortEn: "PIS", glyph: "♓", element: "water", kwFr: "imagination", kwEn: "imagination" },
];

const ELEMENT_LABEL_FR: Record<Element, string> = { fire: "Feu", earth: "Terre", air: "Air", water: "Eau" };
const ELEMENT_LABEL_EN: Record<Element, string> = { fire: "Fire", earth: "Earth", air: "Air", water: "Water" };

const ELEMENT_SECTOR_FILL: Record<Element, string> = {
  fire:  "rgba(200,50,40,0.09)",
  earth: "rgba(40,120,70,0.09)",
  air:   "rgba(45,110,196,0.09)",
  water: "rgba(80,88,181,0.11)",
};

const ELEMENT_COLOR: Record<Element, string> = {
  fire:  "#c43318",
  earth: "#2a8f5e",
  air:   "#2d6ec4",
  water: "#4050a8",
};

interface PlanetMeta {
  fr: string; en: string; frShort: string; enShort: string;
  kwFr: string; kwEn: string;
  defaultColor: string;
}

const PLANET_META: Record<string, PlanetMeta> = {
  sun:     { fr: "Soleil",  en: "Sun",     frShort: "Sol", enShort: "Sun", kwFr: "identité · vitalité",        kwEn: "identity · vitality",        defaultColor: "#b86b10" },
  moon:    { fr: "Lune",    en: "Moon",    frShort: "Lun", enShort: "Moo", kwFr: "émotions · intuition",       kwEn: "emotions · intuition",       defaultColor: "#5e5a75" },
  mercury: { fr: "Mercure", en: "Mercury", frShort: "Mer", enShort: "Mer", kwFr: "pensée · communication",     kwEn: "mind · communication",       defaultColor: "#2d6ec4" },
  venus:   { fr: "Vénus",   en: "Venus",   frShort: "Vén", enShort: "Ven", kwFr: "amour · esthétique",         kwEn: "love · aesthetics",          defaultColor: "#c4457a" },
  mars:    { fr: "Mars",    en: "Mars",    frShort: "Mar", enShort: "Mar", kwFr: "action · désir",             kwEn: "action · desire",            defaultColor: "#c43318" },
  jupiter: { fr: "Jupiter", en: "Jupiter", frShort: "Jup", enShort: "Jup", kwFr: "expansion · confiance",      kwEn: "expansion · confidence",     defaultColor: "#2a8f5e" },
  saturn:  { fr: "Saturne", en: "Saturn",  frShort: "Sat", enShort: "Sat", kwFr: "structure · responsabilité", kwEn: "structure · responsibility", defaultColor: "#6740a8" },
  uranus:  { fr: "Uranus",  en: "Uranus",  frShort: "Ura", enShort: "Ura", kwFr: "rupture · liberté",          kwEn: "rupture · freedom",          defaultColor: "#1a8eb0" },
  neptune: { fr: "Neptune", en: "Neptune", frShort: "Nep", enShort: "Nep", kwFr: "rêve · idéal",               kwEn: "dream · ideal",              defaultColor: "#4050a8" },
  pluto:   { fr: "Pluton",  en: "Pluto",   frShort: "Plu", enShort: "Plu", kwFr: "transformation · pouvoir",   kwEn: "transformation · power",     defaultColor: "#5e3e7a" },
  // LILITH-V1 : Mean Apogee. Disponible uniquement en mode swisseph
  // (ASTRO_ENGINE=swisseph). En mode astracore, chart.planets["lilith"]
  // sera absent → le wheel ne le rendra pas, pas de crash.
  lilith:  { fr: "Lilith",  en: "Lilith",  frShort: "Lil", enShort: "Lil", kwFr: "ombre · liberté brute",      kwEn: "shadow · raw freedom",       defaultColor: "#3a1a3a" },
  // PLANET-META-NODES-FIX : Nœuds lunaires + Part de Fortune. Ce sont des
  // points calculés (pas des astres) mais ils apparaissent dans la roue —
  // sans entrée ici, le nom brut ("northnode"…) s'affichait tel quel.
  northnode: { fr: "Nœud Nord",       en: "North Node",      frShort: "NNo", enShort: "NNo", kwFr: "chemin de vie · évolution", kwEn: "life path · growth",  defaultColor: "#9c7d3c" },
  southnode: { fr: "Nœud Sud",        en: "South Node",      frShort: "NSu", enShort: "SNo", kwFr: "acquis · mémoire du passé", kwEn: "past · innate gifts", defaultColor: "#8c8784" },
  fortune:   { fr: "Part de Fortune", en: "Part of Fortune", frShort: "For", enShort: "For", kwFr: "corps · prospérité",        kwEn: "body · prosperity",   defaultColor: "#9a8550" },
  chiron:    { fr: "Chiron",          en: "Chiron",          frShort: "Chi", enShort: "Chi", kwFr: "blessure · guérison",       kwEn: "wound · healing",     defaultColor: "#6b7a5e" },
  // ASTEROIDS-V1 : Cérès, Pallas, Junon, Vesta + Lilith vraie. Comme Chiron
  // et la Lilith moyenne, présents uniquement en mode swisseph (fichiers .se1).
  ceres:      { fr: "Cérès",       en: "Ceres",       frShort: "Cér", enShort: "Cer", kwFr: "soin · cycles · nourriture", kwEn: "nurture · cycles · food",   defaultColor: "#5e7a4a" },
  pallas:     { fr: "Pallas",      en: "Pallas",      frShort: "Pal", enShort: "Pal", kwFr: "stratégie · sagesse",        kwEn: "strategy · wisdom",         defaultColor: "#3a7a78" },
  juno:       { fr: "Junon",       en: "Juno",        frShort: "Jun", enShort: "Jun", kwFr: "engagement · partenariat",   kwEn: "commitment · partnership",  defaultColor: "#a8497c" },
  vesta:      { fr: "Vesta",       en: "Vesta",       frShort: "Ves", enShort: "Ves", kwFr: "feu sacré · dévotion",       kwEn: "sacred flame · devotion",   defaultColor: "#b87a2a" },
  lilithtrue: { fr: "Lilith vraie", en: "True Lilith", frShort: "LiV", enShort: "TLi", kwFr: "ombre · autonomie brute",   kwEn: "shadow · raw autonomy",     defaultColor: "#4a2a5a" },
};

// MINOR-BODIES-TOGGLE-V1 : tout ce qui n'est PAS une des 10 planètes classiques
// (Chiron + astéroïdes + Lilith(s) + Nœuds + Part de Fortune) forme le groupe
// « Astres mineurs », masquable d'un clic pour désencombrer la roue.
const MAJOR_PLANETS = new Set([
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
]);
const isMinorBody = (name: string) => !MAJOR_PLANETS.has(name.toLowerCase());

const HOUSE_NAMES_FR = [
  "Soi", "Ressources", "Communication", "Foyer",
  "Créativité", "Santé", "Relations", "Transformation",
  "Philosophie", "Carrière", "Amitiés", "Intériorité",
];
const HOUSE_NAMES_EN = [
  "Self", "Resources", "Communication", "Home",
  "Creativity", "Health", "Partnerships", "Transformation",
  "Philosophy", "Career", "Friendships", "Inner life",
];
const HOUSE_KEYWORDS_FR = [
  "Identité et apparence",
  "Biens, argent, valeurs",
  "Pensée, fratrie, voisinage",
  "Origines, foyer, intimité",
  "Créations, enfants, plaisir",
  "Travail quotidien, santé",
  "Couple, contrats, autres",
  "Crises, ressources partagées",
  "Voyages, sens, études",
  "Vocation, image publique",
  "Amis, projets, communauté",
  "Retrait, inconscient, rêves",
];
const HOUSE_KEYWORDS_EN = [
  "Identity, appearance",
  "Assets, money, values",
  "Mind, siblings, neighbors",
  "Roots, home, intimacy",
  "Creations, children, pleasure",
  "Daily work, health",
  "Partnership, contracts",
  "Crises, shared resources",
  "Travel, meaning, studies",
  "Vocation, public image",
  "Friends, projects, community",
  "Seclusion, unconscious, dreams",
];

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

interface AspectRule {
  name: string; nameEn: string;
  angle: number; orb: number;
  color: string; sw: number; dash: string;
  symbol: string;
  kind: "harmony" | "tension" | "neutral";
}

const ASPECT_RULES: AspectRule[] = [
  { name: "Conjonction", nameEn: "Conjunction", angle:   0, orb: 8, color: "#8a5e10", sw: 1.6, dash: "",    symbol: "☌", kind: "neutral" },
  { name: "Sextile",     nameEn: "Sextile",     angle:  60, orb: 5, color: "#0f7a4a", sw: 1.0, dash: "3,3", symbol: "⚹", kind: "harmony" },
  { name: "Carré",       nameEn: "Square",      angle:  90, orb: 7, color: "#b01818", sw: 1.3, dash: "4,3", symbol: "□", kind: "tension" },
  { name: "Trigone",     nameEn: "Trine",       angle: 120, orb: 7, color: "#0f7a4a", sw: 1.4, dash: "",    symbol: "△", kind: "harmony" },
  { name: "Opposition",  nameEn: "Opposition",  angle: 180, orb: 8, color: "#b01818", sw: 1.4, dash: "6,3", symbol: "☍", kind: "tension" },
  { name: "Quinconce",   nameEn: "Quincunx",    angle: 150, orb: 3, color: "#6740a8", sw: 0.7, dash: "2,4", symbol: "⚻", kind: "neutral" },
];

const DEFAULT_PLANETS: WheelPlanet[] = [
  { name: "sun",     glyph: "☉", longitude:  45 },
  { name: "moon",    glyph: "☽", longitude: 132 },
  { name: "mercury", glyph: "☿", longitude:  28 },
  { name: "venus",   glyph: "♀", longitude:  68 },
  { name: "mars",    glyph: "♂", longitude: 195 },
  { name: "jupiter", glyph: "♃", longitude: 312 },
  { name: "saturn",  glyph: "♄", longitude: 271 },
  { name: "uranus",  glyph: "♅", longitude: 315 },
  { name: "neptune", glyph: "♆", longitude: 355 },
  { name: "pluto",   glyph: "♇", longitude: 300 },
];

// ──────────────────────────────────────────────────────────
// Géométrie
// ──────────────────────────────────────────────────────────
const CX = 340, CY = 340, SVG_SIZE = 680;

// Projection « brute » : longitude écliptique → point cartésien.
// Bélier 0° ancré à gauche (9 h) ; séquence antihoraire (Taureau dessous, etc.).
// FIX-WHEEL-DIRECTION-V1 : (180 + lon) au lieu de (180 - lon) pour inverser le sens.
// WHEEL-ANCHOR-ASC-V1 : la rotation sur l'Ascendant se fait en amont via le
// wrapper `lonToXY` interne au composant (qui soustrait l'ascendant) — cette
// fonction reste la projection de référence (offset = 0 ⇒ Bélier à gauche).
function lonToXYBase(lon: number, r: number, cx = CX, cy = CY) {
  const theta = ((180 + lon) * Math.PI) / 180;
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

type PlanetWithDisplay = WheelPlanet & { displayLongitude: number };

/** Écarte angulairement les planètes trop proches, en gardant la vraie longitude. */
function spreadPlanets(planets: WheelPlanet[], minDeg = 10): PlanetWithDisplay[] {
  const sorted: PlanetWithDisplay[] = planets
    .map(p => ({ ...p, displayLongitude: p.longitude }))
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

function computeNatalAspects(planets: WheelPlanet[], excludeQuincunx = false) {
  const rules = excludeQuincunx
    ? ASPECT_RULES.filter(r => r.name !== "Quinconce")
    : ASPECT_RULES;
  const aspects: Array<{ p1: WheelPlanet; p2: WheelPlanet; rule: AspectRule }> = [];
  for (let i = 0; i < planets.length - 1; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const diff = Math.abs(planets[i]!.longitude - planets[j]!.longitude);
      const angle = Math.min(diff, 360 - diff);
      for (const rule of rules) {
        if (Math.abs(angle - rule.angle) <= rule.orb) {
          aspects.push({ p1: planets[i]!, p2: planets[j]!, rule });
          break;
        }
      }
    }
  }
  return aspects;
}

function computeCrossAspects(transits: WheelPlanet[], natal: WheelPlanet[]) {
  const aspects: Array<{ p1: WheelPlanet; p2: WheelPlanet; rule: AspectRule }> = [];
  for (const t of transits) {
    for (const n of natal) {
      const diff = Math.abs(t.longitude - n.longitude);
      const angle = Math.min(diff, 360 - diff);
      for (const rule of ASPECT_RULES) {
        if (Math.abs(angle - rule.angle) <= rule.orb) {
          aspects.push({ p1: t, p2: n, rule });
          break;
        }
      }
    }
  }
  return aspects;
}

function formatLongitude(lon: number, locale: string): string {
  const signIdx = Math.floor(lon / 30) % 12;
  const degInSign = lon % 30;
  const deg = Math.floor(degInSign);
  const min = Math.floor((degInSign - deg) * 60);
  const sign = SIGNS[signIdx]!;
  const name = locale === "en" ? sign.en : sign.fr;
  return `${deg}°${min.toString().padStart(2, "0")}' ${name}`;
}

/** Retourne l'index 0..11 de la maison contenant la longitude donnée. */
function houseIndexFromLongitude(
  lon: number,
  houses: WheelHouse[] | undefined,
  ascendant: number,
): number {
  const cusps = (houses && houses.length === 12)
    ? houses.map(h => h.longitude)
    : Array.from({ length: 12 }, (_, i) => (ascendant + i * 30) % 360);
  const base = cusps[0]!;
  const normalized = ((lon - base) + 360) % 360;
  const offsets = cusps.map((c, i) => ({ off: ((c - base) + 360) % 360, idx: i }));
  offsets.sort((a, b) => a.off - b.off);
  for (let i = 0; i < offsets.length; i++) {
    const curr = offsets[i]!.off;
    const next = i < offsets.length - 1 ? offsets[i + 1]!.off : 360;
    if (normalized >= curr && normalized < next) return offsets[i]!.idx;
  }
  return 0;
}

function firstWord(s: string | undefined | null): string {
  if (!s) return "";
  return s.trim().split(/\s+/)[0] || "";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] || c));
}

// ──────────────────────────────────────────────────────────
// Composant
// ──────────────────────────────────────────────────────────
export function ZodiacWheel({
  planets        = DEFAULT_PLANETS,
  transitPlanets,
  houses,
  ascendant      = 0,
  mc,
  showHouses        = true,
  showAspects       = true,
  showPlanets       = true,
  showLayerToggles  = true,
  showControls      = true,
  transparentBackground = false,
  chartName      = "",
  firstName,
  compact,
  className      = "",
}: ZodiacWheelProps) {
  const t = useT();
  const { locale } = useApp();
  const isFr = locale !== "en";

  // WHEEL-ANCHOR-ASC-V1 : toute la roue est pivotée pour amener l'Ascendant à
  // gauche (9 h), comme une carte du ciel professionnelle (cf. astrotheme).
  // On soustrait simplement l'ascendant à chaque longitude avant projection :
  // signes, maisons, planètes, aspects et axes AC/DC/MC/IC suivent automatiquement.
  // Fallback : ascendant=0 (ciel sans thème, harmoniques) ⇒ Bélier à gauche,
  // soit le comportement historique, sans rotation parasite.
  const lonToXY = useCallback(
    (lon: number, r: number) => lonToXYBase(lon - ascendant, r),
    [ascendant],
  );

  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isBiWheel = !!(transitPlanets && transitPlanets.length > 0);

  // ─── State ───
  const [zoom,  setZoom]  = useState(1);
  const [pan,   setPan]   = useState({ x: 0, y: 0 });
  const [drag,  setDrag]  = useState<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [pinch, setPinch] = useState<{ dist: number; zoom: number } | null>(null);

  const [layerHouses,  setLayerHouses]  = useState(showHouses);
  const [layerAspects, setLayerAspects] = useState(showAspects);
  const [layerPlanets, setLayerPlanets] = useState(showPlanets);
  // MINOR-BODIES-TOGGLE-V1 : visibles par défaut (préserve l'affichage existant) ;
  // l'utilisateur peut les masquer pour alléger la roue.
  const [layerMinors,  setLayerMinors]  = useState(true);
  const [showLabels,   setShowLabels]   = useState(false);

  const [tooltipHtml, setTooltipHtml] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos]   = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // WHEEL-ASPECT-HOVER-V1 : astre actuellement survolé (clé `t_…`/`n_…`, alignée
  // sur celle de renderPlanetGroup). Quand renseignée, seuls les aspects qui le
  // concernent restent visibles ; les autres s'estompent presque entièrement.
  const [hoverPlanet, setHoverPlanet] = useState<string | null>(null);

  // ─── Responsive compact ───
  const [autoCompact, setAutoCompact] = useState(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setAutoCompact(e.contentRect.width < 520);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const isCompact = compact ?? autoCompact;

  // ─── Computations ───
  // MINOR-BODIES-TOGGLE-V1 : le toggle filtre à la source (roue, aspects ET card).
  const hasMinors = useMemo(
    () => planets.some(p => isMinorBody(p.name))
       || (transitPlanets?.some(p => isMinorBody(p.name)) ?? false),
    [planets, transitPlanets],
  );
  const visiblePlanets = useMemo(
    () => layerMinors ? planets : planets.filter(p => !isMinorBody(p.name)),
    [planets, layerMinors],
  );
  const visibleTransits = useMemo(
    () => {
      const tp = transitPlanets ?? [];
      return layerMinors ? tp : tp.filter(p => !isMinorBody(p.name));
    },
    [transitPlanets, layerMinors],
  );

  const spreadNatal = useMemo(
    () => layerPlanets
      ? spreadPlanets(visiblePlanets.map(p => ({ ...p })), isCompact ? 12 : 10)
      : [],
    [visiblePlanets, layerPlanets, isCompact],
  );
  const spreadTransits = useMemo(
    () => (layerPlanets && isBiWheel)
      ? spreadPlanets(visibleTransits.map(p => ({ ...p })), isCompact ? 12 : 10)
      : [],
    [visibleTransits, layerPlanets, isBiWheel, isCompact],
  );

  // WHEEL-ASPECT-CONNECT-V2 : les extrémités des traits d'aspect doivent viser
  // la position AFFICHÉE du glyphe (nudgée par spreadPlanets), pas la vraie
  // longitude — sinon, pour des astres resserrés puis écartés, le bout flotte à
  // côté du symbole. Maps nom → displayLongitude (repli sur la vraie longitude
  // si le calque planètes est masqué : aucun glyphe à rejoindre).
  const natalDisplayLon = useMemo(
    () => new Map(spreadNatal.map(p => [p.name, p.displayLongitude])),
    [spreadNatal],
  );
  const transitDisplayLon = useMemo(
    () => new Map(spreadTransits.map(p => [p.name, p.displayLongitude])),
    [spreadTransits],
  );

  const aspects = useMemo(() => {
    if (!layerAspects) return [];
    if (isBiWheel) return computeCrossAspects(visibleTransits, visiblePlanets);
    return computeNatalAspects(visiblePlanets, isCompact);
  }, [visiblePlanets, visibleTransits, isBiWheel, layerAspects, isCompact]);

  const houseLines = useMemo(() => {
    if (!layerHouses) return [];
    if (houses && houses.length === 12) return houses.map(h => h.longitude);
    return Array.from({ length: 12 }, (_, i) => (ascendant + i * 30) % 360);
  }, [houses, ascendant, layerHouses]);

  // ─── Zoom / pan ───
  const clampZoom = (z: number) => Math.min(4, Math.max(0.5, z));
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom(z => clampZoom(z - e.deltaY * 0.001));
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const onMouseDown = (e: React.MouseEvent) => {
    setDrag({ startX: e.clientX, startY: e.clientY, ox: pan.x, oy: pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    setPan({ x: drag.ox + e.clientX - drag.startX, y: drag.oy + e.clientY - drag.startY });
  };
  const onMouseUp = () => setDrag(null);

  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setPinch({ dist: getTouchDist(e.touches[0]!, e.touches[1]!), zoom });
      setDrag(null);
    } else if (e.touches.length === 1) {
      const tt = e.touches[0]!;
      setDrag({ startX: tt.clientX, startY: tt.clientY, ox: pan.x, oy: pan.y });
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinch) {
      const newDist = getTouchDist(e.touches[0]!, e.touches[1]!);
      setZoom(clampZoom(pinch.zoom * (newDist / pinch.dist)));
    } else if (e.touches.length === 1 && drag) {
      const tt = e.touches[0]!;
      setPan({ x: drag.ox + tt.clientX - drag.startX, y: drag.oy + tt.clientY - drag.startY });
    }
  };
  const onTouchEnd = () => { setDrag(null); setPinch(null); };

  // ─── Tooltip ───
  const positionTooltip = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let x = clientX - rect.left + 14;
    let y = clientY - rect.top - 12;
    if (x > rect.width - 270) x = clientX - rect.left - 280;
    if (y < 8) y = clientY - rect.top + 22;
    setTooltipPos({ x, y });
  }, []);

  const showTooltip = (html: string, ev: React.MouseEvent | React.TouchEvent) => {
    setTooltipHtml(html);
    if ("clientX" in ev) positionTooltip(ev.clientX, ev.clientY);
    else if (ev.touches.length > 0) positionTooltip(ev.touches[0]!.clientX, ev.touches[0]!.clientY);
  };
  const moveTooltip = (ev: React.MouseEvent) => positionTooltip(ev.clientX, ev.clientY);
  const hideTooltip = () => setTooltipHtml(null);
  const showTooltipTouch = (html: string, ev: React.TouchEvent) => {
    showTooltip(html, ev);
    setTimeout(() => setTooltipHtml(null), 2500);
  };

  // ─── Tooltip builders ───
  const buildSignTooltip = (signIdx: number): string => {
    const s = SIGNS[signIdx]!;
    const elemColor = ELEMENT_COLOR[s.element];
    const elemLabel = (isFr ? ELEMENT_LABEL_FR : ELEMENT_LABEL_EN)[s.element];
    const name = escapeHtml(isFr ? s.fr : s.en);
    const kw = escapeHtml(isFr ? s.kwFr : s.kwEn);
    return `<div class="zw-tip-title" style="color:${elemColor}">${s.glyph} ${name}</div>`
         + `<div class="zw-tip-sub">${elemLabel} · ${kw}</div>`;
  };

  const buildPlanetTooltip = (planet: WheelPlanet, isTransit: boolean): string => {
    const meta = PLANET_META[planet.name.toLowerCase()];
    const pname = escapeHtml(meta ? (isFr ? meta.fr : meta.en) : planet.name);
    const kw = meta ? escapeHtml(isFr ? meta.kwFr : meta.kwEn) : "";
    const signIdx = Math.floor(planet.longitude / 30) % 12;
    const s = SIGNS[signIdx]!;
    const signName = escapeHtml(isFr ? s.fr : s.en);
    const degInSign = planet.longitude % 30;
    const deg = Math.floor(degInSign);
    const min = Math.floor((degInSign - deg) * 60).toString().padStart(2, "0");
    const hIdx = houseIndexFromLongitude(planet.longitude, houses, ascendant);
    const hRoman = ROMAN[hIdx];
    const transitTag = isTransit ? `<span class="zw-tip-tag">${isFr ? "Transit" : "Transit"}</span>` : "";
    const retroTag = planet.retrograde ? ` <span class="zw-tip-retro">℞</span>` : "";
    return `<div class="zw-tip-title">${transitTag}${planet.glyph} ${pname}${retroTag}</div>`
         + (kw ? `<div class="zw-tip-sub">${kw}</div>` : "")
         + `<div class="zw-tip-meta">${s.glyph} ${deg}°${min}' ${signName} · ${isFr ? "Maison" : "House"} ${hRoman}</div>`;
  };

  const buildHouseTooltip = (houseIdx: number): string => {
    const name = escapeHtml((isFr ? HOUSE_NAMES_FR : HOUSE_NAMES_EN)[houseIdx]!);
    const kw = escapeHtml((isFr ? HOUSE_KEYWORDS_FR : HOUSE_KEYWORDS_EN)[houseIdx]!);
    return `<div class="zw-tip-title">${isFr ? "Maison" : "House"} ${ROMAN[houseIdx]} · ${name}</div>`
         + `<div class="zw-tip-sub">${kw}</div>`;
  };

  // MINOR-BODIES-TOGGLE-V1 / ASPECT-LINE-TOOLTIP-V1 : tooltip d'une ligne d'aspect.
  const buildAspectTooltip = (p1: WheelPlanet, p2: WheelPlanet, rule: AspectRule): string => {
    const nameOf = (p: WheelPlanet) => {
      const m = PLANET_META[p.name.toLowerCase()];
      return escapeHtml(m ? (isFr ? m.fr : m.en) : p.name);
    };
    const aspectName = escapeHtml(isFr ? rule.name : rule.nameEn);
    const kindLabel = rule.kind === "harmony"
      ? (isFr ? "Aspect harmonique · énergie fluide" : "Harmonious · flowing energy")
      : rule.kind === "tension"
        ? (isFr ? "Aspect tendu · friction motrice" : "Tense · driving friction")
        : (isFr ? "Énergies mêlées" : "Blended energies");
    const diff = Math.abs(p1.longitude - p2.longitude);
    const angle = Math.min(diff, 360 - diff);
    const orb = Math.abs(angle - rule.angle);
    const orbDeg = Math.floor(orb);
    const orbMin = Math.floor((orb - orbDeg) * 60).toString().padStart(2, "0");
    return `<div class="zw-tip-title">${p1.glyph} ${nameOf(p1)} <span class="zw-tip-aspect-sym">${rule.symbol}</span> ${p2.glyph} ${nameOf(p2)}</div>`
         + `<div class="zw-tip-sub">${aspectName} · ${kindLabel}</div>`
         + `<div class="zw-tip-meta">${isFr ? "Orbe" : "Orb"} ${orbDeg}°${orbMin}'</div>`;
  };

  // ─── Export SVG / PDF ───
  const downloadSVG = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.style.transform = "";
    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(chartName || "wheel").replace(/\s+/g, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!svgRef.current) return;
    const svgStr = new XMLSerializer().serializeToString(svgRef.current);
    const svgDataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><title>${escapeHtml(chartName || "Zodiac Wheel")}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { margin: 0; display: flex; flex-direction: column; align-items: center; font-family: Georgia, serif; color: #3d2f0f; background: #fdfaf0; }
  h1 { font-size: 22px; margin: 14px 0 6px; }
  .sub { font-size: 11px; color: #6b5d3a; margin-bottom: 16px; }
  img { width: 100%; max-width: 540px; }
  button { margin-top: 20px; padding: 10px 24px; background: #8a5e10; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
  @media print { button { display: none; } }
</style></head>
<body>
  <h1>${escapeHtml(chartName || "")}</h1>
  <p class="sub">Astro Platform · ${new Date().toLocaleDateString(locale)}</p>
  <img src="${svgDataUrl}" alt="Zodiac Wheel" />
  <button onclick="window.print()">${isFr ? "Imprimer / Sauvegarder en PDF" : "Print / Save as PDF"}</button>
</body></html>`);
    win.document.close();
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ─── Rayons (géométrie) ───
  const R_OUTER     = 330;
  const R_SIGN_IN   = isCompact ? 282 : 278;
  const R_GLYPH     = isCompact ? 306 : 304;

  const R_HOUSE_O   = isBiWheel ? 210 : (isCompact ? 278 : 273);
  const R_HOUSE_I   = isBiWheel ? 175 : (isCompact ? 240 : 233);
  const R_HOUSE_NUM = (R_HOUSE_O + R_HOUSE_I) / 2;

  const R_TRANSIT   = isBiWheel ? 248 : 0;
  const R_NATAL     = isBiWheel ? 150 : (isCompact ? 215 : 208);

  const R_TICK_O    = R_NATAL + 22;
  const R_TICK_I    = R_NATAL + 14;

  // WHEEL-ASPECT-REACH-V1 : disque central supprimé en bi-wheel (transits) — il
  // masquait les aspects ; en natal, réduit à un simple fond pour le prénom.
  const R_CENTER    = isBiWheel ? 0 : (isCompact ? 56 : 60);

  const NATAL_GLYPH_SIZE   = isCompact ? 22 : 24;
  const NATAL_DISC_R       = isCompact ? 15 : 16;
  const NATAL_HALO_R       = isCompact ? 20 : 22;
  const TRANSIT_GLYPH_SIZE = isBiWheel ? 20 : 0;
  const TRANSIT_DISC_R     = isBiWheel ? 13 : 0;
  const TRANSIT_HALO_R     = isBiWheel ? 18 : 0;

  // ─── Rendu planète ───
  const renderPlanetGroup = (
    p: PlanetWithDisplay,
    r: number,
    isTransit: boolean,
    glyphSize: number,
    discR: number,
    haloR: number,
  ) => {
    const meta = PLANET_META[p.name.toLowerCase()];
    const color = p.color ?? meta?.defaultColor ?? "#8a5e10";
    const pos = lonToXY(p.displayLongitude, r);
    const showTick = Math.abs(p.displayLongitude - p.longitude) > 0.5;
    const tipHtml = buildPlanetTooltip(p, isTransit);
    const key = `${isTransit ? "t" : "n"}_${p.name}`;

    return (
      <g key={key}>
        {showTick && (() => {
          const tickO = lonToXY(p.longitude, R_TICK_O);
          const tickI = lonToXY(p.longitude, R_TICK_I);
          return (
            <g pointerEvents="none">
              <line
                x1={tickO.x} y1={tickO.y} x2={tickI.x} y2={tickI.y}
                stroke={color} strokeWidth="1.6" opacity="0.75"
              />
              <line
                x1={tickI.x} y1={tickI.y} x2={pos.x} y2={pos.y}
                stroke={color} strokeWidth="0.8"
                strokeDasharray="2,2" opacity="0.55"
              />
            </g>
          );
        })()}
        <circle
          cx={pos.x} cy={pos.y} r={haloR}
          fill={color} opacity={isTransit ? 0.10 : 0.15}
          pointerEvents="none"
        />
        <g
          className="zw-planet"
          onMouseEnter={(e) => { showTooltip(tipHtml, e); setHoverPlanet(key); }}
          onMouseMove={moveTooltip}
          onMouseLeave={() => { hideTooltip(); setHoverPlanet(null); }}
          onTouchStart={(e) => { showTooltipTouch(tipHtml, e); setHoverPlanet(key); window.setTimeout(() => setHoverPlanet(null), 2500); }}
        >
          <circle
            cx={pos.x} cy={pos.y} r={discR}
            fill="#fdfaf0"
            stroke={color}
            strokeWidth={isTransit ? 1 : 1.2}
            strokeDasharray={isTransit ? "2,1.5" : ""}
          />
          <text
            x={pos.x} y={pos.y}
            textAnchor="middle" dominantBaseline="central"
            fontSize={glyphSize}
            fill={color} fontWeight="500"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {p.glyph}
          </text>
          {/* PATCH-UX-RETROGRADE-VISIBILITY-V1 : rétrograde plus visible sur la roue SVG */}
          {p.retrograde && (
            <g style={{ pointerEvents: "auto", cursor: "help" }}>
              <title>Rétrograde — énergie tournée vers l'intérieur, introspection sur le domaine de cette planète</title>
              <circle
                cx={pos.x + discR - 2} cy={pos.y - discR + 2}
                r={5.5}
                fill="#e54545"
                opacity={0.9}
              />
              <text
                x={pos.x + discR - 2} y={pos.y - discR + 4.5}
                fontSize="8"
                fill="#ffffff" fontWeight="700"
                textAnchor="middle"
                style={{ userSelect: "none" }}
              >
                ℞
              </text>
            </g>
          )}
        </g>
      </g>
    );
  };

  // ─── Axes ───
  // WHEEL-TRUE-MC-V1 : le MC est un angle calculé (cuspide 10), PAS
  // ascendant+270° — cette égalité n'est vraie qu'en maisons égales.
  // Priorité : prop `mc` (vrai MC du thème) > cuspide 10 des maisons
  // fournies > repli égal asc+270 (roues sans données de maisons).
  const mcLon =
    typeof mc === "number"           ? mc
    : (houses && houses.length === 12) ? houses[9]!.longitude
    : (ascendant + 270) % 360;
  const axes = [
    { lon: ascendant,             lb: "AC" },
    { lon: (ascendant + 180) % 360, lb: "DC" },
    { lon: mcLon,                 lb: "MC" },
    { lon: (mcLon + 180) % 360,   lb: "IC" },
  ];

  // ─── Rendu principal ───
  return (
    <div className={`zodiac-wheel-root ${className}`}>
      {/* Toggles */}
      {showLayerToggles && (
        <div className="zw-toggles no-print">
          {[
            { key: "houses",  label: t("wheel_toggle_houses"),  val: layerHouses,  set: setLayerHouses  },
            { key: "aspects", label: t("wheel_toggle_aspects"), val: layerAspects, set: setLayerAspects },
            { key: "planets", label: t("wheel_toggle_planets"), val: layerPlanets, set: setLayerPlanets },
            // MINOR-BODIES-TOGGLE-V1 : n'apparaît que si le thème contient des astres
            // mineurs (Chiron, astéroïdes, Lilith, Nœuds, Part de Fortune).
            ...(hasMinors
              ? [{ key: "minors", label: isFr ? "Astres mineurs" : "Minor bodies", val: layerMinors, set: setLayerMinors }]
              : []),
            { key: "labels",  label: isFr ? "Noms" : "Labels",  val: showLabels,   set: setShowLabels   },
          ].map(({ key, label, val, set }) => (
            <button
              key={key}
              className={`zw-toggle ${val ? "zw-toggle-on" : "zw-toggle-off"}`}
              onClick={() => set(v => !v)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Legend bi-wheel */}
      {isBiWheel && (
        <div className="zw-biwheel-legend">
          <div className="zw-biwheel-item">
            <span className="zw-biwheel-dot zw-biwheel-natal" />
            {isFr ? "Natal (intérieur)" : "Natal (inner)"}
          </div>
          <div className="zw-biwheel-item">
            <span className="zw-biwheel-dot zw-biwheel-transit" />
            {isFr ? "Transit (extérieur)" : "Transit (outer)"}
          </div>
        </div>
      )}

      {/* SVG */}
      <div
        ref={wrapRef}
        className={`zw-svg-wrap ${drag ? "zw-dragging" : ""}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          width="100%"
          className="zw-svg"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: drag || pinch ? "none" : "transform .2s ease-out",
          }}
          aria-label={chartName || "Zodiac wheel"}
        >
          {/* Fond parchemin (caché si transparentBackground=true pour mode immersif) */}
          {!transparentBackground && (
            <circle cx={CX} cy={CY} r={R_OUTER} fill="#f9f3e0" />
          )}

          {/* 12 secteurs signes */}
          {SIGNS.map((sign, i) => {
            const lonStart = i * 30, lonEnd = lonStart + 30, lonMid = lonStart + 15;
            const fill = ELEMENT_SECTOR_FILL[sign.element];
            const p1o = lonToXY(lonStart, R_OUTER);
            const p1i = lonToXY(lonStart, R_SIGN_IN);
            const p2o = lonToXY(lonEnd,   R_OUTER);
            const p2i = lonToXY(lonEnd,   R_SIGN_IN);
            const glyphPos = lonToXY(lonMid, R_GLYPH);
            const namePos  = lonToXY(lonMid, R_GLYPH - 18);
            const tipHtml = buildSignTooltip(i);
            return (
              <g key={sign.en}>
                <path
                  d={`M ${p1i.x} ${p1i.y} L ${p1o.x} ${p1o.y} A ${R_OUTER} ${R_OUTER} 0 0 0 ${p2o.x} ${p2o.y} L ${p2i.x} ${p2i.y} A ${R_SIGN_IN} ${R_SIGN_IN} 0 0 1 ${p1i.x} ${p1i.y} Z`}
                  className="zw-sign-sector"
                  fill={fill}
                  stroke="rgba(138,94,16,0.18)"
                  strokeWidth="0.5"
                  onMouseEnter={(e) => showTooltip(tipHtml, e)}
                  onMouseMove={moveTooltip}
                  onMouseLeave={hideTooltip}
                  onTouchStart={(e) => showTooltipTouch(tipHtml, e)}
                />
                <line
                  x1={p1i.x} y1={p1i.y} x2={p1o.x} y2={p1o.y}
                  stroke="rgba(138,94,16,0.28)" strokeWidth="0.6"
                  pointerEvents="none"
                />
                <text
                  x={glyphPos.x} y={glyphPos.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={isCompact ? 22 : 26}
                  fill={ELEMENT_COLOR[sign.element]}
                  opacity="0.95"
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {sign.glyph}
                </text>
                {showLabels && !isCompact && (
                  <text
                    x={namePos.x} y={namePos.y}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize="9"
                    fill="#6d4a0d" fontWeight="500"
                    opacity="0.85"
                    style={{ userSelect: "none", pointerEvents: "none", letterSpacing: "0.04em" }}
                  >
                    {isFr ? sign.short : sign.shortEn}
                  </text>
                )}
              </g>
            );
          })}

          {/* Bordures bande signes */}
          <circle cx={CX} cy={CY} r={R_OUTER}   fill="none" stroke="#8a5e10"              strokeWidth="1.5" pointerEvents="none" />
          <circle cx={CX} cy={CY} r={R_SIGN_IN} fill="none" stroke="rgba(138,94,16,0.4)"  strokeWidth="1"   pointerEvents="none" />

          {/* Maisons */}
          {layerHouses && houseLines.map((lon, i) => {
            const outer = lonToXY(lon, R_HOUSE_O);
            const inner = lonToXY(lon, R_HOUSE_I);
            const isAngular = i % 3 === 0;
            const nextLon = houseLines[(i + 1) % 12]!;
            const diff = (nextLon - lon + 360) % 360;
            const midLon = lon + diff / 2;
            const numPos = lonToXY(midLon, R_HOUSE_NUM);
            const tipHtml = buildHouseTooltip(i);
            // Zone de hover sur le secteur de la maison
            const arcO1 = lonToXY(lon,     R_HOUSE_O);
            const arcI1 = lonToXY(lon,     R_HOUSE_I);
            const arcO2 = lonToXY(nextLon, R_HOUSE_O);
            const arcI2 = lonToXY(nextLon, R_HOUSE_I);
            const arcD =
              `M ${arcI1.x} ${arcI1.y} L ${arcO1.x} ${arcO1.y} ` +
              `A ${R_HOUSE_O} ${R_HOUSE_O} 0 0 0 ${arcO2.x} ${arcO2.y} ` +
              `L ${arcI2.x} ${arcI2.y} ` +
              `A ${R_HOUSE_I} ${R_HOUSE_I} 0 0 1 ${arcI1.x} ${arcI1.y} Z`;
            return (
              <g key={`h${i}`}>
                <path
                  d={arcD}
                  fill="transparent"
                  className="zw-house-sector"
                  onMouseEnter={(e) => showTooltip(tipHtml, e)}
                  onMouseMove={moveTooltip}
                  onMouseLeave={hideTooltip}
                  onTouchStart={(e) => showTooltipTouch(tipHtml, e)}
                />
                <line
                  x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
                  stroke={isAngular ? "#8a5e10" : "rgba(138,94,16,0.32)"}
                  strokeWidth={isAngular ? 2 : 0.8}
                  strokeDasharray={isAngular ? "" : "3,3"}
                  opacity={isAngular ? 0.95 : 0.6}
                  pointerEvents="none"
                />
                <text
                  x={numPos.x} y={numPos.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={isCompact ? 13 : 14}
                  fill="#8a5e10" fontWeight="500"
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {ROMAN[i]}
                </text>
              </g>
            );
          })}

          {layerHouses && (
            <>
              <circle cx={CX} cy={CY} r={R_HOUSE_O} fill="none" stroke="rgba(138,94,16,0.25)" strokeWidth="0.6" pointerEvents="none" />
              <circle cx={CX} cy={CY} r={R_HOUSE_I} fill="none" stroke="rgba(138,94,16,0.25)" strokeWidth="0.6" pointerEvents="none" />
            </>
          )}

          {/* Axes AC/DC/MC/IC */}
          {axes.map(ax => {
            const pos = lonToXY(ax.lon, R_SIGN_IN - 22);
            return (
              <g key={ax.lb} pointerEvents="none">
                <circle cx={pos.x} cy={pos.y} r="12" fill="#fdfaf0" stroke="#8a5e10" strokeWidth="1.4" />
                <text
                  x={pos.x} y={pos.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize="9" fontWeight="500"
                  fill="#8a5e10"
                  style={{ userSelect: "none", letterSpacing: "0.04em" }}
                >
                  {ax.lb}
                </text>
              </g>
            );
          })}

          {/* Aspects */}
          {/* WHEEL-ASPECT-HOVER-V1 : au survol d'un astre, seuls SES aspects
             restent visibles (les autres s'estompent presque entièrement). */}
          {layerAspects && aspects.map(({ p1, p2, rule }, i) => {
            // WHEEL-ASPECT-CONNECT-V2 : chaque extrémité du trait rejoint le
            // CENTRE de son glyphe — même rayon (transit R_TRANSIT / natal
            // R_NATAL) ET même longitude affichée (displayLongitude) que le
            // symbole. Le bout passe ainsi SOUS le disque opaque (rendu au-
            // dessus) → jonction nette. En natal, on visait avant la vraie
            // longitude sur un moyeu interne (R_ASPECT) : pour des astres
            // resserrés puis écartés (ex. Lilith/Pallas), le trait flottait à
            // côté du glyphe nudgé. Utiliser displayLongitude + R_NATAL le règle.
            const r1 = isBiWheel ? R_TRANSIT : R_NATAL; // p1 = transit en bi-wheel
            const r2 = R_NATAL;                          // p2 = natal
            const lon1 = (isBiWheel ? transitDisplayLon : natalDisplayLon).get(p1.name) ?? p1.longitude;
            const lon2 = natalDisplayLon.get(p2.name) ?? p2.longitude;
            const a1 = lonToXY(lon1, r1);
            const a2 = lonToXY(lon2, r2);
            // Clés alignées sur renderPlanetGroup : en bi-wheel p1=transit, p2=natal ;
            // en natal les deux sont natals.
            const keyA = isBiWheel ? `t_${p1.name}` : `n_${p1.name}`;
            const keyB = `n_${p2.name}`;
            const active = !hoverPlanet || hoverPlanet === keyA || hoverPlanet === keyB;
            const lineOpacity = hoverPlanet ? (active ? 0.95 : 0.05) : 0.55;
            const lineWidth   = hoverPlanet && active ? rule.sw + 0.7 : rule.sw;
            // ASPECT-LINE-TOOLTIP-V1 : ligne fine visible + ligne large invisible
            // pour offrir une zone de survol confortable avec tooltip.
            const tipHtml = buildAspectTooltip(p1, p2, rule);
            return (
              <g key={i} className="zw-aspect">
                <line
                  x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y}
                  stroke={rule.color} strokeWidth={lineWidth}
                  strokeDasharray={rule.dash} opacity={lineOpacity}
                  pointerEvents="none"
                  style={{ transition: "opacity .15s ease, stroke-width .15s ease" }}
                />
                <line
                  x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y}
                  stroke="transparent" strokeWidth="9"
                  pointerEvents={active ? "stroke" : "none"}
                  onMouseEnter={(e) => showTooltip(tipHtml, e)}
                  onMouseMove={moveTooltip}
                  onMouseLeave={hideTooltip}
                  onTouchStart={(e) => showTooltipTouch(tipHtml, e)}
                />
              </g>
            );
          })}

          {/* Planètes natales */}
          {layerPlanets && spreadNatal.map(p => renderPlanetGroup(
            p, R_NATAL, false, NATAL_GLYPH_SIZE, NATAL_DISC_R, NATAL_HALO_R,
          ))}

          {/* Planètes transit (bi-wheel) */}
          {layerPlanets && isBiWheel && spreadTransits.map(p => renderPlanetGroup(
            p, R_TRANSIT, true, TRANSIT_GLYPH_SIZE, TRANSIT_DISC_R, TRANSIT_HALO_R,
          ))}

          {/* Centre — WHEEL-ASPECT-REACH-V1 : plus de disque opaque en bi-wheel
             (transits), il masquait les aspects ; la date est déjà dans l'en-tête
             de page et la légende natal/transit. En natal : petit fond + prénom. */}
          {!isBiWheel && R_CENTER > 0 && (
            <>
              <circle cx={CX} cy={CY} r={R_CENTER} fill="#fdfaf0" pointerEvents="none" />
              <circle cx={CX} cy={CY} r={R_CENTER} fill="none" stroke="rgba(138,94,16,0.35)" strokeWidth="1" pointerEvents="none" />
              <text
                x={CX} y={CY}
                textAnchor="middle" dominantBaseline="central"
                fontSize={isCompact ? 20 : 22}
                fill="#8a5e10" opacity="0.95"
                fontWeight="400"
                style={{ userSelect: "none", pointerEvents: "none", letterSpacing: "0.02em" }}
              >
                {firstName || firstWord(chartName) || (isFr ? "Thème" : "Chart")}
              </text>
            </>
          )}
        </svg>

        {/* Tooltip */}
        {tooltipHtml && (
          <div
            className="zw-tooltip"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
            dangerouslySetInnerHTML={{ __html: tooltipHtml }}
          />
        )}

        {zoom !== 1 && (
          <div className="zw-zoom-indicator">
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>

      {/* Contrôles */}
      {showControls && (
        <div className="zw-controls no-print">
          <button className="wheel-ctrl-btn zw-ctrl"       onClick={() => setZoom(z => clampZoom(z + 0.25))} title={t("wheel_zoom_in")}>+</button>
          <button className="wheel-ctrl-btn zw-ctrl"       onClick={() => setZoom(z => clampZoom(z - 0.25))} title={t("wheel_zoom_out")}>−</button>
          <button className="wheel-ctrl-btn zw-ctrl-reset" onClick={resetView}                                title={t("wheel_reset")}>⊙</button>
          <div className="zw-ctrl-spacer" />
          <button className="wheel-ctrl-btn zw-ctrl-export"           onClick={downloadSVG} title={t("wheel_download")}>↓ SVG</button>
          <button className="wheel-ctrl-btn zw-ctrl-export zw-ctrl-pdf" onClick={exportPDF}   title={t("wheel_pdf")}>↓ PDF</button>
        </div>
      )}

      {/* Légende des aspects */}
      {!isCompact && layerAspects && (
        <div className="zw-legend no-print">
          {/* ASPECT-LEGEND-TOOLTIP-V1 : tooltip explicatif natif sur chaque puce. */}
          <span
            className="zw-legend-item zw-legend-harmony"
            title={isFr
              ? "Sextiles et trigones — énergies fluides entre deux planètes : talents naturels, facilités et opportunités."
              : "Sextiles and trines — flowing energy between two planets: natural talents, ease and opportunities."}
          >
            <svg width="18" height="5" aria-hidden="true"><line x1="0" y1="2.5" x2="18" y2="2.5" stroke="#0f7a4a" strokeWidth="1.5"/></svg>
            {isFr ? "Aspect harmonique" : "Harmonious"}
          </span>
          <span
            className="zw-legend-item zw-legend-tension"
            title={isFr
              ? "Carrés et oppositions — tensions et frictions entre deux planètes : défis qui poussent à l'effort et à la croissance."
              : "Squares and oppositions — tension and friction between two planets: challenges that drive effort and growth."}
          >
            <svg width="18" height="5" aria-hidden="true"><line x1="0" y1="2.5" x2="18" y2="2.5" stroke="#b01818" strokeWidth="1.5" strokeDasharray="3,2"/></svg>
            {isFr ? "Aspect tendu" : "Tense"}
          </span>
          <span
            className="zw-legend-item zw-legend-conj"
            title={isFr
              ? "Deux planètes quasi au même degré — leurs énergies fusionnent et s'amplifient mutuellement."
              : "Two planets at nearly the same degree — their energies merge and amplify each other."}
          >
            <svg width="18" height="5" aria-hidden="true"><line x1="0" y1="2.5" x2="18" y2="2.5" stroke="#8a5e10" strokeWidth="1.8"/></svg>
            {isFr ? "Conjonction" : "Conjunction"}
          </span>
          <span
            className="zw-legend-item zw-legend-tick"
            title={isFr
              ? "Petit trait radial reliant une planète à sa position réelle : elle a été légèrement écartée pour rester lisible quand plusieurs astres sont serrés (amas / stellium)."
              : "Small radial tick linking a planet to its true position: it was nudged apart to stay legible when several bodies cluster together (stellium)."}
          >
            <svg width="18" height="5" aria-hidden="true"><line x1="0" y1="2.5" x2="18" y2="2.5" stroke="#50401f" strokeWidth="1" strokeDasharray="2,2"/></svg>
            {isFr ? "Tick (stellium)" : "Tick (stellium)"}
          </span>
        </div>
      )}

      {/* Card légende planètes — natal seul, hors compact */}
      {!isBiWheel && !isCompact && (
        <div className="zw-planets-card">
          <div className="zw-planets-card-header">
            <span className="zw-planets-card-icon">☉</span>
            <h3>{t("wheel_planets")}</h3>
          </div>
          <div className="zw-planets-grid">
            {spreadNatal.length === 0 ? (
              <p className="zw-empty">—</p>
            ) : spreadNatal.map(p => {
              const meta = PLANET_META[p.name.toLowerCase()];
              const color = p.color ?? meta?.defaultColor ?? "#8a5e10";
              const fullName = meta ? (isFr ? meta.fr : meta.en) : p.name;
              return (
                <div key={p.name} className="zw-planet-row">
                  <div
                    className="zw-planet-row-icon"
                    style={{
                      background: `${color}1a`,
                      border: `1px solid ${color}55`,
                      color,
                    }}
                  >
                    {p.glyph}
                  </div>
                  <div className="zw-planet-row-body">
                    <div className="zw-planet-row-name">
                      {fullName}
                      {/* PATCH-UX-RETROGRADE-VISIBILITY-V1 : badge rétrograde visible + tooltip pédagogique */}
                      {p.retrograde && (
                        <span
                          className="zw-planet-retro"
                          title="Rétrograde — énergie tournée vers l\'intérieur, introspection sur le domaine de cette planète"
                          style={{
                            marginLeft: 6,
                            fontSize: 9,
                            fontWeight: 600,
                            color: "#e54545",
                            background: "rgba(229,69,69,.1)",
                            border: "1px solid rgba(229,69,69,.25)",
                            padding: "1px 5px",
                            borderRadius: 999,
                            letterSpacing: ".3px",
                            cursor: "help",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ℞ Rétro
                        </span>
                      )}
                    </div>
                    <div className="zw-planet-row-pos">
                      {formatLongitude(p.longitude, locale)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ZodiacWheel;

// ARCHIVE-LANDING-EPHEMERIDES-POLISH-V2 applied

// ARCHIVE-LANDING-HERO-IMMERSIVE-V1 applied

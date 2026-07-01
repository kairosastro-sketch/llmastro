// ============================================================
// apps/web/src/components/ciel/CielMoonCard.tsx
// CIEL-EDITORIAL-V1 — carte « Phase Lunaire » du rail droit.
// Lune rendue en CSS (terminateur selon l'illumination réelle +
// sens croissant/décroissant), signe courant de la Lune, et ingrès
// à venir dans la période. Composant serveur, localisé via getT(lang).
// ============================================================

import type { MoonPhase } from "@/lib/server/sky-fetch";
import { getT, type Locale } from "@/lib/i18n/translations";
import { getLocalizedMoonPhase } from "@/lib/i18n/moon-phase";
import styles from "./ciel.module.css";

const SIGN_NAMES: Record<Locale, string[]> = {
  fr: ["Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
       "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons"],
  en: ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
       "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"],
};

// Sens de la lunaison : lit à droite (croissant) vs à gauche (décroissant).
const WAXING: Record<string, boolean> = {
  moon_new: true, moon_waxc: true, moon_firstq: true, moon_waxg: true,
  moon_full: true, moon_wang: false, moon_lastq: false, moon_wanc: false,
};

// Prose par phase (avec {sign}), localisée inline (précédent : CielHousesNote).
// Fallback = description courte de moon-phase.ts si la clé/le signe manquent.
const PHASE_PROSE: Record<Locale, Record<string, string>> = {
  fr: {
    moon_new:    "La Lune s'efface en {sign} : moment des intentions nouvelles et des semences discrètes.",
    moon_waxc:   "La Lune croît en {sign} : l'élan se construit, les projets prennent forme.",
    moon_firstq: "Premier quartier de Lune en {sign} : temps de décisions et de dépassement des obstacles.",
    moon_waxg:   "La Lune s'arrondit en {sign} : ajustements, patience et perfectionnement.",
    moon_full:   "Pleine Lune en {sign} : culmination et clarté, les émotions à leur pleine intensité.",
    moon_wang:   "La Lune décline en {sign} : temps de gratitude, de partage et de diffusion de ce qui a mûri.",
    moon_lastq:  "Dernier quartier de Lune en {sign} : lâcher-prise, révisions et ajustements.",
    moon_wanc:   "La Lune s'amenuise en {sign} : repos, introspection et purification avant le renouveau.",
  },
  en: {
    moon_new:    "The Moon fades into {sign}: a time for new intentions and quiet seeds.",
    moon_waxc:   "The Moon waxes in {sign}: momentum builds, projects take shape.",
    moon_firstq: "First quarter Moon in {sign}: decisions and pushing past obstacles.",
    moon_waxg:   "The Moon swells in {sign}: adjustments, patience and refinement.",
    moon_full:   "Full Moon in {sign}: culmination and clarity, emotions at their peak.",
    moon_wang:   "The Moon wanes in {sign}: a time for gratitude, sharing and releasing what has ripened.",
    moon_lastq:  "Last quarter Moon in {sign}: letting go, revisions and adjustments.",
    moon_wanc:   "The Moon dwindles in {sign}: rest, introspection and purification before renewal.",
  },
};

function moonProse(key: string | undefined, sign: string | null, lang: Locale, fallback: string): string {
  if (key && sign) {
    const tpl = PHASE_PROSE[lang][key];
    if (tpl) return tpl.replace("{sign}", sign);
  }
  return fallback;
}

function signName(longitude: number, lang: Locale): string {
  const idx = ((Math.floor(longitude / 30) % 12) + 12) % 12;
  return SIGN_NAMES[lang][idx] ?? "";
}

// Dégradé CSS de la lune : terminateur vertical au % d'illumination,
// côté éclairé selon croissant/décroissant, + reflet sphérique.
function moonBackground(illum: number, waxing: boolean): string {
  const lit = "#eef0f8";
  const dark = "#0c0b1c";
  const p = Math.round(Math.max(0, Math.min(1, illum)) * 100);
  const phase = waxing
    ? `${dark} 0%, ${dark} ${100 - p}%, ${lit} ${100 - p}%, ${lit} 100%`  // éclairée à droite
    : `${lit} 0%, ${lit} ${p}%, ${dark} ${p}%, ${dark} 100%`;             // éclairée à gauche
  const glowX = waxing ? "66%" : "34%";
  return `radial-gradient(circle at ${glowX} 32%, rgba(255,255,255,.22), rgba(255,255,255,0) 55%), linear-gradient(90deg, ${phase})`;
}

function fmtIngress(iso: string, lang: Locale): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", {
    day: "numeric", month: "long", timeZone: "UTC",
  });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return lang === "en" ? `${date}, ${hh}:${mm} UTC` : `${date}, ${hh}h${mm} UTC`;
}

export function CielMoonCard({
  moonPhase,
  moonLongitude,
  ingress,
  lang,
}: {
  moonPhase: MoonPhase | null;
  moonLongitude?: number;
  ingress?: { toSign: number; date: string } | null;
  lang: Locale;
}) {
  const t = getT(lang);
  if (!moonPhase || !moonPhase.phase) return null;

  const loc = moonPhase.key ? getLocalizedMoonPhase(moonPhase.key, lang) : null;
  const phaseLabel = loc?.phase ?? moonPhase.phase;
  const description = loc?.description ?? moonPhase.description ?? "";
  const illum = typeof moonPhase.illumination === "number" ? moonPhase.illumination : 0.5;
  const waxing = moonPhase.key ? (WAXING[moonPhase.key] ?? true) : true;
  const sign = typeof moonLongitude === "number" ? signName(moonLongitude, lang) : null;

  return (
    <section className={styles.moonCard} aria-label={t("ciel_moon_title")}>
      <div className={styles.moonHead}>
        <h2 className={styles.moonTitle}>{t("ciel_moon_title")}</h2>
        <div className={styles.moonPhaseLabel}>
          {phaseLabel} · {Math.round(illum * 100)}%
        </div>
      </div>

      <div className={styles.moonBody}>
        <div
          className={styles.moon}
          style={{ background: moonBackground(illum, waxing) }}
          aria-hidden
        />
        <div className={styles.moonText}>
          <p className={styles.moonDesc}>{moonProse(moonPhase.key, sign, lang, description)}</p>
          {ingress && (
            <p className={styles.moonIngress}>
              {t("ciel_moon_ingress")} {SIGN_NAMES[lang][((ingress.toSign % 12) + 12) % 12]} · {fmtIngress(ingress.date, lang)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// CIEL-EDITORIAL-V1 CielMoonCard applied

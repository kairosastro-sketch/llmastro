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
          <p className={styles.moonDesc}>
            {sign && (
              <>
                <span className={styles.moonSign}>{t("ciel_moon_in")} {sign}</span>
                {" — "}
              </>
            )}
            {description}
          </p>
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

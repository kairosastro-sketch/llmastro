// ============================================================
// apps/web/src/components/ciel/CielPositions.tsx
// CIEL-EDITORIAL-V1 — table « Positions planétaires » (Astre · Position ·
// Mouvement), repliée par défaut au top 2 (Soleil + Lune) avec bouton
// « voir plus ». Composant client (état d'ouverture), getT(lang).
// ============================================================

"use client";

import { useState } from "react";
import { getT, type Locale } from "@/lib/i18n/translations";
import styles from "./ciel.module.css";

const PLANET_KEYS = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
] as const;

const GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};

const NAMES: Record<Locale, Record<string, string>> = {
  fr: {
    sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus", mars: "Mars",
    jupiter: "Jupiter", saturn: "Saturne", uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
  },
  en: {
    sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
    jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
  },
};

const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const SIGN_NAMES: Record<Locale, string[]> = {
  fr: ["Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
       "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons"],
  en: ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
       "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"],
};

const COLLAPSED = 2;

function fmt(longitude: number) {
  const idx = ((Math.floor(longitude / 30) % 12) + 12) % 12;
  const inSign = longitude % 30;
  const deg = Math.floor(inSign);
  const min = Math.floor((inSign - deg) * 60);
  return { idx, deg: `${deg}°${String(min).padStart(2, "0")}'` };
}

interface PlanetData { longitude: number; retrograde?: boolean }

export function CielPositions({
  planets,
  date,
  lang,
}: {
  planets: Record<string, PlanetData>;
  date: string;
  lang: Locale;
}) {
  const t = getT(lang);
  const [open, setOpen] = useState(false);

  const rows = PLANET_KEYS.filter((k) => planets[k]);
  const shown = open ? rows : rows.slice(0, COLLAPSED);

  return (
    <section aria-label={t("ciel_positions_title")}>
      <h2 className={styles.dataTitle}>{t("ciel_positions_title")}</h2>
      <p className={styles.dataSub}>
        {t("ciel_positions_geocentric")} {t("ciel_positions_asof")} {date}.
      </p>

      <div className={styles.posTable} role="table">
        <div className={styles.posHead} role="row">
          <span>{t("ciel_col_body")}</span>
          <span>{t("ciel_col_position")}</span>
          <span style={{ textAlign: "right" }}>{t("ciel_col_movement")}</span>
        </div>

        {shown.map((k) => {
          const p = planets[k]!;
          const { idx, deg } = fmt(p.longitude);
          return (
            <div key={k} className={styles.posRow} role="row">
              <span className={styles.posName}>
                <span className={styles.posGlyph} aria-hidden>{GLYPHS[k]}</span>
                {NAMES[lang][k] ?? k}
              </span>
              <span className={styles.posPos}>
                {deg} <span aria-hidden style={{ color: "var(--violet)" }}>{SIGN_GLYPHS[idx]}</span>{" "}
                <span className={styles.posSign}>{SIGN_NAMES[lang][idx]}</span>
              </span>
              <span className={styles.posMove}>
                {p.retrograde
                  ? <span className={styles.posRetro} aria-hidden>℞ {t("ciel_retro")}</span>
                  : t("ciel_direct")}
              </span>
            </div>
          );
        })}
      </div>

      {rows.length > COLLAPSED && (
        <button type="button" className={styles.moreBtn} onClick={() => setOpen((o) => !o)}>
          {open ? t("ciel_show_less") : `${t("ciel_show_more")} (${rows.length - COLLAPSED})`}
        </button>
      )}
    </section>
  );
}

// CIEL-EDITORIAL-V1 CielPositions applied

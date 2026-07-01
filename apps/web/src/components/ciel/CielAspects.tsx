// ============================================================
// apps/web/src/components/ciel/CielAspects.tsx
// CIEL-EDITORIAL-V1 — « Aspects mutuels » en cartes, repliés par défaut
// au top 2 avec bouton « voir plus » (déplie jusqu'au top 8). Indicateur
// de serrage (barres) par exactitude. Composant client, getT(lang).
// ============================================================

"use client";

import { useState } from "react";
import type { TransitAspect } from "@/lib/server/sky-fetch";
import { getT, type Locale } from "@/lib/i18n/translations";
import styles from "./ciel.module.css";

const GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
  northNode: "☊", southNode: "☋",
};

const NAMES: Record<Locale, Record<string, string>> = {
  fr: {
    sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus", mars: "Mars",
    jupiter: "Jupiter", saturn: "Saturne", uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
    northNode: "Nœud Nord", southNode: "Nœud Sud",
  },
  en: {
    sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
    jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
    northNode: "North Node", southNode: "South Node",
  },
};

const TONE: Record<TransitAspect["tone"], string> = {
  harmony: "var(--harmony)",
  tension: "var(--tension)",
  neutral: "var(--neutral)",
};

const COLLAPSED = 2;
const MAX = 8;

export function CielAspects({ aspects, lang }: { aspects: TransitAspect[]; lang: Locale }) {
  const t = getT(lang);
  const [open, setOpen] = useState(false);

  const all = aspects ?? [];
  const top = all.slice(0, MAX);
  const shown = open ? top : top.slice(0, COLLAPSED);

  if (all.length === 0) {
    return (
      <section aria-label={t("ciel_aspects_mutual")}>
        <h2 className={styles.dataTitle}>{t("ciel_aspects_mutual")}</h2>
        <p className={styles.dataSub}>{t("ciel_aspects_none")}</p>
      </section>
    );
  }

  return (
    <section aria-label={t("ciel_aspects_mutual")}>
      <h2 className={styles.dataTitle}>{t("ciel_aspects_mutual")}</h2>
      <p className={styles.dataSub}>
        Top {top.length} {t("ciel_aspects_of")} {all.length} · {t("ciel_aspects_sorted")}
      </p>

      <div className={styles.aspList}>
        {shown.map((a, i) => {
          const tName = NAMES[lang][a.transitPlanet] ?? a.transitPlanet;
          const nName = NAMES[lang][a.natalPlanet] ?? a.natalPlanet;
          const type = (lang === "en" ? a.type : a.typeFr).toLowerCase();
          const lit = a.exact ? 3 : a.tight ? 2 : 1;
          return (
            <article key={`${a.transitPlanet}-${a.natalPlanet}-${a.type}-${i}`} className={styles.aspCard}>
              <span className={styles.aspGlyphs} aria-hidden>
                {GLYPHS[a.transitPlanet] ?? ""} {a.symbol} {GLYPHS[a.natalPlanet] ?? ""}
              </span>
              <div className={styles.aspMain}>
                <p className={styles.aspTitle}>
                  {tName} <span className={styles.aspType}>{type}</span> {nName}
                </p>
                <p className={styles.aspMeta}>
                  {t("ciel_aspects_orb")} {a.orb}°
                  {a.exact
                    ? <> · <span className={styles.aspExact}>{t("ciel_aspects_exact")}</span></>
                    : a.tight
                      ? <> · {t("ciel_aspects_tight")}</>
                      : null}
                </p>
              </div>
              <div className={styles.aspBars} aria-hidden>
                {[0, 1, 2].map((b) => (
                  <span
                    key={b}
                    className={styles.aspBar}
                    style={{
                      height: `${8 + b * 6}px`,
                      background: b < lit ? TONE[a.tone] : "var(--border)",
                      opacity: b < lit ? 0.9 : 0.4,
                    }}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {top.length > COLLAPSED && (
        <button type="button" className={styles.moreBtn} onClick={() => setOpen((o) => !o)}>
          {open ? t("ciel_show_less") : `${t("ciel_show_more")} (${top.length - COLLAPSED})`}
        </button>
      )}
    </section>
  );
}

// CIEL-EDITORIAL-V1 CielAspects applied

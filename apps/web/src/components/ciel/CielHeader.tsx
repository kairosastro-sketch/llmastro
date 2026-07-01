// ============================================================
// apps/web/src/components/ciel/CielHeader.tsx
// CIEL-EDITORIAL-V1 — hero éditorial « Observatoire céleste » :
// eyebrow + titre serif par cadence (conservé pour le SEO) + sous-titre
// descriptif + bloc date à droite + séparateur. La phase de lune est
// désormais portée par CielMoonCard (rail droit), plus par l'en-tête.
// Composant serveur, localisé via getT(lang).
// ============================================================

import type { Cadence } from "@/lib/server/sky-fetch";
import { getT, type Locale, type TranslationKey } from "@/lib/i18n/translations";
import styles from "./ciel.module.css";

const TITLE_KEYS: Record<Cadence, TranslationKey> = {
  day:   "ciel_head_day_title",
  week:  "ciel_head_week_title",
  month: "ciel_head_month_title",
  year:  "ciel_head_year_title",
};

function fmtDate(iso: string, lang: Locale, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", opts);
  } catch {
    return iso.slice(0, 10);
  }
}

export function CielHeader({
  cadence,
  periodStart,
  periodEnd,
  lang,
}: {
  cadence: Cadence;
  periodStart: string;
  periodEnd: string;
  lang: Locale;
}) {
  const t = getT(lang);
  const dateOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const dateMain = fmtDate(periodStart, lang, dateOpts);
  const dateEnd = fmtDate(periodEnd, lang, dateOpts);

  return (
    <header className={styles.hero}>
      <div className={styles.heroText}>
        <p className={styles.heroEyebrow}>{t("ciel_hero_eyebrow")}</p>
        <h1 className={styles.heroTitle}>{t(TITLE_KEYS[cadence])}</h1>
        <p className={styles.heroSubtitle}>{t("ciel_hero_subtitle")}</p>
      </div>

      <div className={styles.heroDate}>
        <p className={styles.heroDateMain}>{dateMain}</p>
        <p className={styles.heroDateSub}>00:00 UTC &rarr; {dateEnd}</p>
      </div>

      <hr className={styles.heroSep} />
    </header>
  );
}

// CIEL-EDITORIAL-V1 CielHeader applied

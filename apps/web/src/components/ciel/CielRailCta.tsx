// ============================================================
// apps/web/src/components/ciel/CielRailCta.tsx
// CIEL-EDITORIAL-V1 — bloc de conversion du rail droit (occupe la place
// de « Photo du ciel » de la maquette). Composant serveur, getT(lang).
// ============================================================

import { getT, type Locale } from "@/lib/i18n/translations";
import { TrackedCta } from "./TrackedCta"; // CIEL-CONVERSION-EVENTS-V1
import styles from "./ciel.module.css";

export function CielRailCta({ lang }: { lang: Locale }) {
  const t = getT(lang);

  return (
    <section className={styles.railCta} aria-label={t("ciel_railcta_title")}>
      <h2 className={styles.railCtaTitle}>{t("ciel_railcta_title")}</h2>
      <p className={styles.railCtaBody}>{t("ciel_railcta_body")}</p>
      <TrackedCta
        id="ciel_rail"
        href="/auth/register"
        className="btn-ob"
        style={{ display: "inline-block", width: "auto", padding: "13px 26px", textDecoration: "none" }}
      >
        {t("ciel_cta_button")}
      </TrackedCta>
    </section>
  );
}

// CIEL-EDITORIAL-V1 CielRailCta applied

// ============================================================
// LANDING-V1 — Section Manifeste (texte éditorial sous le hero)
// Ajoutée via LANDING-MANIFESTE-V1.
// ============================================================

import { useT } from "@/lib/i18n";
import { RevealOnScroll } from "./RevealOnScroll";
import styles from "./landing.module.css";

export function Manifeste() {
  const t = useT();

  return (
    <section className={`${styles.section} ${styles.manifeste}`}>
      <RevealOnScroll>
        <div className={styles.manifesteInner}>
          <h2 className={styles.manifesteTitle}>
            {t("landing_manifeste_title" as any)}
          </h2>
          <p className={styles.manifesteText}>
            {t("landing_manifeste_p1" as any)}
          </p>
          <p className={styles.manifesteText}>
            {t("landing_manifeste_p2" as any)}
          </p>
          <p className={styles.manifesteText}>
            {t("landing_manifeste_p3" as any)}
          </p>
        </div>
      </RevealOnScroll>
    </section>
  );
}

// LANDING-MANIFESTE-V1 applied

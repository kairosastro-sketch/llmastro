// ============================================================
// LANDING-V1 — Section Manifeste (texte éditorial sous le hero)
// Ajoutée via LANDING-MANIFESTE-V1.
// ============================================================

import Link from "next/link";
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

          <div className={styles.manifesteLinks}>
            <Link href="/histoire" className={styles.manifesteLink}>
              {t("landing_nav_history" as any)}
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/le-ciel-et-l-ia" className={styles.manifesteLink}>
              {t("landing_nav_cielia" as any)}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}

// LANDING-MANIFESTE-V1 applied

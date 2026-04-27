// ============================================================
// LANDING-V1 — Section Trust (signaux sérieux)
// ============================================================

import { useT } from "@/lib/i18n";
import { RevealOnScroll } from "./RevealOnScroll";
import styles from "./landing.module.css";

export function Trust() {
  const t = useT();

  return (
    <section className={`${styles.section} ${styles.trust}`}>
      <RevealOnScroll>
        <div className={styles.trustLines}>
          <p className={styles.trustEyebrow}>
            {t("landing_trust_eyebrow" as any)}
          </p>
          <p className={styles.trustMain}>
            {t("landing_trust_line1" as any)}
            <br />
            {t("landing_trust_line2" as any)}
          </p>
          <p className={styles.trustNote}>
            {t("landing_trust_note" as any)}
          </p>
        </div>
      </RevealOnScroll>
    </section>
  );
}

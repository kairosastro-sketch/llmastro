// ============================================================
// LANDING-V1 — Section Promesse (3 différenciants)
// ============================================================

import { useT } from "@/lib/i18n";
import { RevealOnScroll } from "./RevealOnScroll";
import styles from "./landing.module.css";

export function Promesse() {
  const t = useT();

  const cols = [
    {
      glyph: "✦",
      tKeyTitle: "landing_promesse_col1_title",
      tKeyText: "landing_promesse_col1_text",
    },
    {
      glyph: "❀",
      tKeyTitle: "landing_promesse_col2_title",
      tKeyText: "landing_promesse_col2_text",
    },
    {
      glyph: "◐",
      tKeyTitle: "landing_promesse_col3_title",
      tKeyText: "landing_promesse_col3_text",
    },
  ];

  return (
    <section className={`${styles.section} ${styles.promesse}`}>
      <RevealOnScroll>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>
            {t("landing_promesse_eyebrow" as any)}
          </p>
          <h2 className={styles.sectionTitle}>
            {t("landing_promesse_title" as any)}
          </h2>
        </div>
      </RevealOnScroll>

      <div className={styles.promesseGrid}>
        {cols.map((c, i) => (
          <RevealOnScroll key={i} delay={i * 100}>
            <div className={styles.promesseCol}>
              <span className={styles.promesseGlyph} aria-hidden="true">
                {c.glyph}
              </span>
              <h3 className={styles.promesseTitle}>
                {t(c.tKeyTitle as any)}
              </h3>
              <p className={styles.promesseText}>
                {t(c.tKeyText as any)}
              </p>
            </div>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}

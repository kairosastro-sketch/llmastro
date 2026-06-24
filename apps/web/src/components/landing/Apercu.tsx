// ============================================================
// LANDING-V1 — Section Aperçu (mockup + texte)
// ============================================================

import { useT } from "@/lib/i18n";
import { RevealOnScroll } from "./RevealOnScroll";
import styles from "./landing.module.css";

export function Apercu() {
  const t = useT();

  const bulletPoints = [
    "landing_apercu_bullet1",
    "landing_apercu_bullet2",
    "landing_apercu_bullet3",
  ];

  return (
    <section className={`${styles.section} ${styles.apercu}`}>
      <div className={styles.apercuGrid}>
        <RevealOnScroll>
          <div className={styles.apercuMockup}>
            <p className={styles.apercuMockupHeader}>
              {t("landing_apercu_mockup_header" as any)}
            </p>
            <div className={styles.apercuMockupBody}>
              <p>{t("landing_apercu_mockup_p1" as any)}</p>
              <p>{t("landing_apercu_mockup_p2" as any)}</p>
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={150}>
          <div className={styles.apercuText}>
            <div>
              <p className={styles.sectionEyebrow}>
                {t("landing_apercu_eyebrow" as any)}
              </p>
              <h2 className={styles.sectionTitle} style={{ textAlign: "left" }}>
                {t("landing_apercu_title" as any)}
              </h2>
            </div>

            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "1.05rem",
                lineHeight: 1.6,
                color: "var(--muted)",
                margin: 0,
              }}
            >
              {t("landing_apercu_paragraph" as any)}
            </p>

            <ul className={styles.apercuList}>
              {bulletPoints.map((key, i) => (
                <li key={i} className={styles.apercuListItem}>
                  <span className={styles.apercuListDot} aria-hidden="true">
                    ·
                  </span>
                  <span>{t(key as any)}</span>
                </li>
              ))}
            </ul>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

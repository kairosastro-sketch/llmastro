// ============================================================
// LANDING-V1 — Hero
// Titre, sous-titre, CTAs, wheel zodiacale animée.
// ============================================================

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { ZodiacWheel } from "./ZodiacWheel";
import styles from "./landing.module.css";

export function Hero() {
  const t = useT();

  return (
    <section className={`${styles.section} ${styles.hero}`}>
      <div className={styles.heroInner}>
        <div className={styles.heroText}>
          <p className={styles.heroEyebrow}>
            {t("landing_hero_eyebrow" as any)}
          </p>

          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleLine}>
              {t("landing_hero_title_part1" as any)}
            </span>
            <span className={styles.heroTitleLine}>
              {t("landing_hero_title_part2" as any)}{" "}
              <span className={styles.heroTitleAccent}>
                {t("landing_hero_title_part3" as any)}
              </span>
            </span>
          </h1>

          <p className={styles.heroSubtitle}>
            {t("landing_hero_subtitle" as any)}
          </p>

          <div className={styles.heroCtas}>
            <Link href="/auth/register" className={styles.ctaPrimary}>
              {t("landing_hero_cta_primary" as any)}
            </Link>
            <Link href="/methode" className={styles.ctaSecondary}>
              {t("landing_hero_cta_secondary" as any)}
            </Link>
          </div>

          <p className={styles.heroNote}>
            {t("landing_hero_note" as any)}
          </p>
        </div>

        <div className={styles.heroWheelWrap}>
          <ZodiacWheel />
        </div>
      </div>
    </section>
  );
}

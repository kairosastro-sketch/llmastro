// ============================================================
// LANDING-V1 — Section CTA Final
// ============================================================

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { RevealOnScroll } from "./RevealOnScroll";
import styles from "./landing.module.css";

export function CtaFinal() {
  const t = useT();

  return (
    <section className={`${styles.section} ${styles.ctaFinal}`}>
      <RevealOnScroll>
        <h2 className={styles.ctaFinalTitle}>
          {t("landing_ctafinal_title_part1" as any)}
          <br />
          {t("landing_ctafinal_title_part2" as any)}
        </h2>
        <p className={styles.ctaFinalSubtitle}>
          {t("landing_ctafinal_subtitle" as any)}
        </p>
        <Link href="/auth/register" className={styles.ctaFinalPrimary}>
          <span aria-hidden="true">✦</span>
          <span>{t("landing_ctafinal_cta" as any)}</span>
        </Link>
        <Link href="/auth/login" className={styles.ctaFinalLink}>
          {t("landing_ctafinal_login_prefix" as any)}{" "}
          <span>{t("landing_ctafinal_login_link" as any)}</span>
        </Link>
      </RevealOnScroll>
    </section>
  );
}

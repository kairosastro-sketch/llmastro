// ============================================================
// LANDING-V1 — Footer
// ============================================================

import Link from "next/link";
import { useT } from "@/lib/i18n";
import styles from "./landing.module.css";

export function Footer() {
  const t = useT();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <span className={styles.footerBrandTitle}>✦ Llmastro</span>
          <span className={styles.footerBrandTagline}>
            {t("landing_footer_tagline" as any)}
          </span>
        </div>

        <nav className={styles.footerNav}>
          <Link href="/histoire" className={styles.footerLink}>
            {t("landing_nav_history" as any)}
          </Link>
          <Link href="/le-ciel-et-l-ia" className={styles.footerLink}>
            {t("landing_nav_cielia" as any)}
          </Link>
          <Link href="/astrologie-ia" className={styles.footerLink}>
            {t("landing_nav_astroia" as any)}
          </Link>
          <Link href="/methode" className={styles.footerLink}>
            {t("landing_nav_method" as any)}
          </Link>
          <Link href="/limites" className={styles.footerLink}>
            {t("landing_nav_limits" as any)}
          </Link>
          <Link href="/bibliographie" className={styles.footerLink}>
            {t("landing_nav_biblio" as any)}
          </Link>
          <Link href="/pricing" className={styles.footerLink}>
            {t("landing_nav_pricing" as any)}
          </Link>
          <Link href="/mentions-legales" className={styles.footerLink}>
            Mentions légales
          </Link>
          <Link href="/cgu" className={styles.footerLink}>
            CGU / CGV
          </Link>
          <Link href="/cgu-affilies" className={styles.footerLink}>
            CGU Ambassadeurs
          </Link>
          <Link href="/confidentialite" className={styles.footerLink}>
            Confidentialité
          </Link>
          <Link href="/contact" className={styles.footerLink}>
            {t("landing_footer_contact" as any)}
          </Link>
        </nav>
      </div>

      <p className={styles.footerBottom}>
        © 2026 Llmastro · {t("landing_footer_copyright_note" as any)}
      </p>
    </footer>
  );
}

// ARCHIVE-FOOTER-LIMITS-LINK-V1 applied

// ARCHIVE-BIBLIOGRAPHY-V1 applied

// COSMETIC-PASS-V1 applied (liens éditoriaux passés en i18n)

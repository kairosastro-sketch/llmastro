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
          <Link href="/methode" className={styles.footerLink}>
            {t("landing_nav_method" as any)}
          </Link>
          <Link href="/limites" className={styles.footerLink}>
            Limites
          </Link>
          <Link href="/bibliographie" className={styles.footerLink}>
            Bibliographie
          </Link>
          <Link href="/pricing" className={styles.footerLink}>
            {t("landing_nav_pricing" as any)}
          </Link>
          <a
            href="mailto:info@llmastro.com"
            className={styles.footerLink}
          >
            {t("landing_footer_contact" as any)}
          </a>
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

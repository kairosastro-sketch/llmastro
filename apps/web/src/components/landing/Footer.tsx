// ============================================================
// LANDING-V1 — Footer
// ============================================================

// CIEL-CONVERSION-V1 : ce Footer utilise le hook client useT(). Sans cette
// directive il ne fonctionnait que via LandingPage ("use client") ; le layout
// serveur /ciel (CIEL-SITE-CHROME-V1) l'importe directement → useT() côté
// serveur = crash au prerender. La directive le rend explicitement client.
"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { SOCIAL_LINKS, type SocialNetwork } from "@/lib/social-links"; // SOCIAL-LINKS-V1
import styles from "./landing.module.css";

// SOCIAL-LINKS-V1 — glyphes de marque monochromes (currentColor → suit le hover).
function SocialIcon({ network }: { network: SocialNetwork }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;
  switch (network) {
    case "instagram":
      return (
        <svg {...common}>
          <path d="M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 0 1-.9 1.38 3.7 3.7 0 0 1-1.38.9c-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.43-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38a3.7 3.7 0 0 1 1.38-.9c.43-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.5.01-4.74.07-.9.04-1.38.19-1.7.32-.43.16-.74.36-1.06.68-.32.32-.52.63-.68 1.06-.13.32-.28.8-.32 1.7C3.2 8.5 3.2 8.85 3.2 12s.01 3.5.07 4.74c.04.9.19 1.38.32 1.7.16.43.36.74.68 1.06.32.32.63.52 1.06.68.32.13.8.28 1.7.32 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.9-.04 1.38-.19 1.7-.32.43-.16.74-.36 1.06-.68.32-.32.52-.63.68-1.06.13-.32.28-.8.32-1.7.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.9-.19-1.38-.32-1.7a2.85 2.85 0 0 0-.68-1.06 2.85 2.85 0 0 0-1.06-.68c-.32-.13-.8-.28-1.7-.32C15.5 4.01 15.15 4 12 4Zm0 3.06A4.94 4.94 0 1 1 12 16.94 4.94 4.94 0 0 1 12 7.06Zm0 1.8a3.14 3.14 0 1 0 0 6.28 3.14 3.14 0 0 0 0-6.28Zm5.14-.66a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.2v12.2a2.43 2.43 0 1 1-2.43-2.43c.2 0 .4.03.59.08V7.6a5.7 5.7 0 0 0-.59-.03 5.66 5.66 0 1 0 5.66 5.66V8.9a7.46 7.46 0 0 0 4.32 1.38V7.08a4.3 4.3 0 0 1-2.7-1.26Z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.22-6.82-5.97 6.82H1.66l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.04l12.04 15.64Z" />
        </svg>
      );
    case "pinterest":
      return (
        <svg {...common}>
          <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.2 2.6 7.8 6.28 9.25-.09-.78-.16-2 .03-2.86.18-.78 1.15-4.94 1.15-4.94s-.29-.59-.29-1.46c0-1.37.79-2.39 1.78-2.39.84 0 1.25.63 1.25 1.39 0 .85-.54 2.11-.82 3.28-.23.98.49 1.78 1.46 1.78 1.75 0 3.1-1.85 3.1-4.52 0-2.36-1.7-4.01-4.12-4.01-2.81 0-4.46 2.1-4.46 4.28 0 .85.33 1.76.74 2.25.08.1.09.18.07.28-.08.32-.25 1-.28 1.14-.04.18-.15.22-.34.13-1.26-.59-2.05-2.42-2.05-3.9 0-3.17 2.3-6.08 6.64-6.08 3.49 0 6.2 2.48 6.2 5.8 0 3.46-2.18 6.25-5.21 6.25-1.02 0-1.97-.53-2.3-1.16l-.62 2.39c-.23.86-.83 1.94-1.24 2.6.94.29 1.92.44 2.95.44 5.5 0 9.96-4.46 9.96-9.96 0-5.5-4.46-9.96-9.96-9.96Z" />
        </svg>
      );
  }
}

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
          {/* SOCIAL-LINKS-V1 — liens réseaux sociaux (config: lib/social-links.ts) */}
          <nav className={styles.footerSocial} aria-label={t("landing_footer_social" as any)}>
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.network}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className={styles.footerSocialLink}
              >
                <SocialIcon network={s.network} />
              </a>
            ))}
          </nav>
        </div>

        {/* FOOTER-COLUMNS-V1 — liens groupés par thème (Découvrir / Produit / Légal) */}
        <div className={styles.footerCols}>
          <div className={styles.footerCol}>
            <h3 className={styles.footerColTitle}>
              {t("landing_footer_col_explore" as any)}
            </h3>
            <nav className={styles.footerColLinks}>
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
            </nav>
          </div>

          <div className={styles.footerCol}>
            <h3 className={styles.footerColTitle}>
              {t("landing_footer_col_product" as any)}
            </h3>
            <nav className={styles.footerColLinks}>
              <Link href="/pricing" className={styles.footerLink}>
                {t("landing_nav_pricing" as any)}
              </Link>
              <Link href="/contact" className={styles.footerLink}>
                {t("landing_footer_contact" as any)}
              </Link>
            </nav>
          </div>

          <div className={styles.footerCol}>
            <h3 className={styles.footerColTitle}>
              {t("landing_footer_col_legal" as any)}
            </h3>
            <nav className={styles.footerColLinks}>
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
            </nav>
          </div>
        </div>
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

// FOOTER-COLUMNS-V1 applied (liens regroupés en colonnes thématiques Découvrir/Produit/Légal)

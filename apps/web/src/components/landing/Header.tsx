// ============================================================
// LANDING-V1 — Header sticky de la landing
// Apparaît avec backdrop-blur après 80px de scroll.
// ============================================================

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT, useApp } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/AuthContext";
import styles from "./landing.module.css";

export function Header() {
  const t = useT();
  const { theme, setTheme } = useApp();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
      <Link href="/" className={styles.headerBrand} aria-label="Llmastro">
        <span className={styles.headerBrandLogo}>✦</span>
        <span>Llmastro</span>
      </Link>

      <div className={styles.headerActions}>
        <nav className={styles.headerNav}>
          {/* Liens marketing masqués une fois connecté : l'utilisateur
              retrouve tout dans son espace. Seul le sélecteur de thème
              reste accessible. */}
          {!user && (
            <>
              <Link href="/le-ciel-et-l-ia" className={styles.headerLink}>
                {t("landing_nav_cielia" as any)}
              </Link>
              <Link href="/methode" className={styles.headerLink}>
                {t("landing_nav_method" as any)}
              </Link>
              <Link href="/pricing" className={styles.headerLink}>
                {t("landing_nav_pricing" as any)}
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={styles.headerLink}
            aria-label={theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"}
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "1.05rem",
              padding: 0,
              lineHeight: 1,
            }}
          >
            {theme === "dark" ? "☀︎" : "☾"}
          </button>
          {!user && (
            <Link href="/auth/login" className={styles.headerLink}>
              {t("landing_nav_login" as any)}
            </Link>
          )}
        </nav>

        {user ? (
          /* Connecté : un seul CTA vers l'espace */
          <Link href="/dashboard/horoscope" className={styles.headerCta}>
            {t("landing_nav_space" as any)}
          </Link>
        ) : (
          <>
            {/* Sur mobile, on garde au moins login + commencer */}
            <Link href="/auth/login" className={styles.headerMobileLogin}>
              {t("landing_nav_login" as any)}
            </Link>
            <Link href="/auth/register" className={styles.headerCta}>
              {t("landing_nav_start" as any)}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

// ARCHIVE-LANDING-EPHEMERIDES-V2 applied

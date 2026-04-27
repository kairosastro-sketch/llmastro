// ============================================================
// LANDING-V1 — Header sticky de la landing
// Apparaît avec backdrop-blur après 80px de scroll.
// ============================================================

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import styles from "./landing.module.css";

export function Header() {
  const t = useT();
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
          <Link href="/methode" className={styles.headerLink}>
            {t("landing_nav_method" as any)}
          </Link>
          <Link href="/pricing" className={styles.headerLink}>
            {t("landing_nav_pricing" as any)}
          </Link>
          <Link href="/auth/login" className={styles.headerLink}>
            {t("landing_nav_login" as any)}
          </Link>
        </nav>

        {/* Sur mobile, on garde au moins login + commencer */}
        <Link href="/auth/login" className={styles.headerMobileLogin}>
          {t("landing_nav_login" as any)}
        </Link>
        <Link href="/auth/register" className={styles.headerCta}>
          {t("landing_nav_start" as any)}
        </Link>
      </div>
    </header>
  );
}

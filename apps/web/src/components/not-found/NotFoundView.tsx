"use client";

// ============================================================
// 404 — « Perdu dans le cosmos »
// Vue cliente de la page d'erreur (thème « Céleste »).
// Décor : champ d'étoiles + nébuleuse + planète-zéro en orbite.
// ============================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { StarsBackground } from "@/components/ui/StarsBackground";
import styles from "./notFound.module.css";

export function NotFoundView() {
  const t = useT();
  const router = useRouter();

  return (
    <div className={styles.page}>
      <StarsBackground count={140} />
      <div className={styles.nebula} aria-hidden="true" />
      <div className={styles.shootingStar} aria-hidden="true" />

      <div className={styles.inner}>
        <span className={styles.eyebrow}>{t("notfound_eyebrow")}</span>

        {/* 4 — planète-zéro — 4 */}
        <div className={styles.code} aria-label="404">
          <span className={styles.digit} aria-hidden="true">4</span>
          <span className={styles.planetZero} aria-hidden="true">
            <span className={styles.planetRing} />
            <span className={styles.planetBody} />
            <span className={styles.moonOrbit}>
              <span className={styles.moon} />
            </span>
          </span>
          <span className={styles.digit} aria-hidden="true">4</span>
        </div>

        <h1 className={styles.title}>{t("notfound_title")}</h1>
        <p className={styles.lead}>{t("notfound_lead")}</p>
        <span className={styles.divider} aria-hidden="true" />
        <p className={styles.hint}>{t("notfound_hint")}</p>

        <div className={styles.actions}>
          <Link href="/" className={styles.ctaPrimary}>
            {t("notfound_cta_home")}
          </Link>
          <button
            type="button"
            className={styles.ctaSecondary}
            onClick={() => router.back()}
          >
            {t("notfound_cta_back")}
          </button>
        </div>
      </div>
    </div>
  );
}

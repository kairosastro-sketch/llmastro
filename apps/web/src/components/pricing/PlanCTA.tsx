// ARCHIVE-PRICING-PAGE-V2
// CTA contextuel pour une carte de plan.
// Affiche le bon bouton selon : plan code, état logged in, plan actuel, soft-launch.

"use client";

import Link from "next/link";
import styles from "./pricing.module.css";

interface PlanCTAProps {
  planCode: string;
  isCurrent: boolean;
  isLoggedIn: boolean;
}

export function PlanCTA({ planCode, isCurrent, isLoggedIn }: PlanCTAProps) {
  // 1. Plan actuel de l'utilisateur — pastille statique
  if (isCurrent) {
    return (
      <div className={styles.ctaCurrent}>
        <span aria-hidden>✦</span>
        <span>Ton plan actuel</span>
      </div>
    );
  }

  // 2. Plan Découverte (free) — CTA contextuel selon connexion
  if (planCode === "free") {
    return (
      <Link
        href={isLoggedIn ? "/dashboard" : "/auth/register"}
        className={`${styles.ctaBtn} ${styles.ctaBtnGhost}`}
      >
        {isLoggedIn ? "Revenir au gratuit" : "Commencer gratuitement"}
      </Link>
    );
  }

  // 3. Plan Pro (premium, soft-launch) — mailto contact
  if (planCode === "premium") {
    return (
      <a
        href="mailto:pro@llmastro.com?subject=Int%C3%A9r%C3%AAt%20plan%20Pro"
        className={`${styles.ctaBtn} ${styles.ctaBtnGhost}`}
      >
        Nous contacter
      </a>
    );
  }

  // 4. Plan Essentiel — bouton primary "bientôt disponible" (Stripe pas branché)
  return (
    <button
      type="button"
      disabled
      className={`${styles.ctaBtn} ${styles.ctaBtnDisabled}`}
      aria-disabled="true"
    >
      Bientôt disponible
    </button>
  );
}

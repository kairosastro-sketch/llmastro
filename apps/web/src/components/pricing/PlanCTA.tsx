// ARCHIVE-PRICING-PAGE-V2 + STRIPE-MVP-V1
// CTA contextuel pour une carte de plan.
// Affiche le bon bouton selon : plan code, état logged in, plan actuel.

"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { subscriptionsApi } from "@/lib/api/client";
import styles from "./pricing.module.css";

interface PlanCTAProps {
  planCode: string;
  isCurrent: boolean;
  isLoggedIn: boolean;
}

export function PlanCTA({ planCode, isCurrent, isLoggedIn }: PlanCTAProps) {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // 1. Plan actuel — pastille statique
  if (isCurrent) {
    return (
      <div className={styles.ctaCurrent}>
        <span aria-hidden>✦</span>
        <span>Ton plan actuel</span>
      </div>
    );
  }

  // 2. Découverte — CTA contextuel selon connexion
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

  // 3. Pro (premium, soft-launch) — mailto contact
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

  // 4. Essentiel — Checkout Stripe (STRIPE-MVP-V1)
  // Utilisateur non connecté → register (pas de param `next` géré côté
  // register pour l'instant ; le user reviendra naturellement sur /pricing).
  if (!isLoggedIn) {
    return (
      <Link href="/auth/register" className={styles.ctaBtn}>
        S&apos;abonner — 9,90€/mois
      </Link>
    );
  }

  const handleCheckout = async () => {
    if (!accessToken || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await subscriptionsApi.checkout(accessToken, "essential");
      const data = (res as { success: true; data: { url: string } }).data;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError("Impossible d'ouvrir Stripe. Réessaie dans un instant.");
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "STRIPE_NOT_CONFIGURED" || code === "STRIPE_PRICE_MISSING") {
        setError("L'abonnement n'est pas encore activé. Reviens d'ici peu.");
      } else {
        setError("Impossible d'ouvrir Stripe. Réessaie dans un instant.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className={`${styles.ctaBtn} ${loading ? styles.ctaBtnDisabled : ""}`}
        aria-busy={loading}
      >
        {loading ? "Redirection…" : "S’abonner"}
      </button>
      {error && (
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
          {error}
        </p>
      )}
    </>
  );
}

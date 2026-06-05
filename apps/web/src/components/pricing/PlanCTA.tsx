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
  // [PRICING-STRIPE-NOT-LIVE-V1] False = Stripe pas configuré pour ce
  // plan, on grise le CTA Essentiel avec « Bientôt disponible ».
  // Free et Premium ne sont pas affectés (Free purchasable=true,
  // Premium gardé en mailto contact).
  purchasable: boolean;
  // PRICING-ANNUAL-V1 : achetable en annuel (Price ID annuel présent) + période active.
  purchasableYear?: boolean;
  period?: "month" | "year";
}

export function PlanCTA({
  planCode,
  isCurrent,
  isLoggedIn,
  purchasable,
  purchasableYear = false,
  period = "month",
}: PlanCTAProps) {
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

  // 4. Essentiel — Stripe pas encore live → CTA inerte.
  // [PRICING-STRIPE-NOT-LIVE-V1] On évite le 503 STRIPE_NOT_CONFIGURED
  // au clic en désactivant le bouton d'entrée. Le plan reste visible
  // (preview transparent) mais inacheteable.
  // PRICING-ANNUAL-V1 : l'achetabilité dépend de la période choisie.
  const effectivePurchasable = period === "year" ? purchasableYear : purchasable;
  if (!effectivePurchasable) {
    return (
      <>
        <button
          type="button"
          disabled
          className={`${styles.ctaBtn} ${styles.ctaBtnDisabled}`}
          aria-disabled="true"
        >
          Bientôt disponible
        </button>
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
          {period === "year"
            ? "L'abonnement annuel ouvre prochainement. Inscris-toi pour être prévenu·e."
            : "Le paiement en ligne ouvre prochainement. Inscris-toi pour être prévenu·e."}
        </p>
      </>
    );
  }

  // 5. Essentiel — Checkout Stripe (STRIPE-MVP-V1)
  // Utilisateur non connecté → register (pas de param `next` géré côté
  // register pour l'instant ; le user reviendra naturellement sur /pricing).
  if (!isLoggedIn) {
    return (
      <Link href="/auth/register" className={styles.ctaBtn}>
        S&apos;abonner
      </Link>
    );
  }

  const handleCheckout = async () => {
    if (!accessToken || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await subscriptionsApi.checkout(accessToken, "essential", period);
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

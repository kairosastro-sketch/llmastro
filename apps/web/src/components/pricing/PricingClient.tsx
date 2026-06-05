"use client";

// SEO-PRICING-SSR-V1
// Île client de /pricing : tout ce qui dépend de searchParams, du token
// de session et du fetch des plans. Le marketing statique (hero + FAQ)
// est rendu côté serveur par app/pricing/page.tsx ; ce composant ne porte
// que l'interactif. Il est monté sous <Suspense> car il lit useSearchParams.

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { PlanCard, type PlanPayload } from "@/components/pricing/PlanCard";
import styles from "@/components/pricing/pricing.module.css";
import { humanFeatureLabel, recommendedPlanFor } from "@/lib/tiers/feature-labels"; // PAYWALL-FRONT-V1

export function PricingClient() {
  // PAYWALL-FRONT-V1 : entrée depuis le PaywallModal → on highlight la feature
  // qui a déclenché le block, et on suggère le plan minimum requis.
  const searchParams      = useSearchParams();
  const blockedFeature    = searchParams?.get("feature") ?? null;
  const blockedFeatLabel  = humanFeatureLabel(blockedFeature);
  const recommendedCode   = blockedFeature ? recommendedPlanFor(blockedFeature) : null;
  // STRIPE-MVP-V1 : retour depuis Checkout annulé.
  const isCanceledReturn  = searchParams?.get("canceled") === "1";

  // PRICING-ANNUAL-V1 : période de facturation affichée (mensuel par défaut).
  const [period, setPeriod] = useState<"month" | "year">("month");

  // Snapshot the session token once at mount — sessionStorage can't be read
  // during SSR and reading it on every render would break purity.
  const [token] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("astro:access_token")
      : null,
  );
  const isLoggedIn = token !== null;

  const plansQuery = useQuery({
    queryKey: ["pricing", "plans"],
    queryFn: async () => {
      const res = await apiClient.get<{ plans: PlanPayload[] }>("/subscriptions/plans");
      return ((res as { data: { plans: PlanPayload[] } }).data.plans).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
    },
  });

  const meQuery = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me", token!);
      return (res as { data?: { plan?: { code?: string } } }).data?.plan?.code ?? null;
    },
    enabled: !!token,
  });

  const plans       = plansQuery.data ?? null;
  const currentCode = meQuery.data ?? null;
  const error       = plansQuery.error ? "Impossible de charger les plans pour le moment." : null;

  // [PRICING-STRIPE-NOT-LIVE-V1] Au moins un plan payant non achetable ?
  const paidPlansComingSoon =
    plans?.some((p) => p.priceCents > 0 && p.code !== "premium" && p.purchasable === false) ?? false;

  return (
    <>
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {/* [PRICING-STRIPE-NOT-LIVE-V1] Bandeau info quand Stripe n'est
          pas encore configuré pour les plans payants. Les cartes
          restent visibles (preview) mais les CTA sont grisés. */}
      {paidPlansComingSoon && (
        <div className={styles.featureBanner} role="status">
          <span className={styles.featureBannerGlyph} aria-hidden>✦</span>
          <span>
            Les abonnements payants ouvrent <strong>très bientôt</strong>. Tu peux déjà
            explorer le plan Découverte gratuitement et garder une longueur d&apos;avance.
          </span>
        </div>
      )}

      {/* STRIPE-MVP-V1 : retour depuis Checkout annulé */}
      {isCanceledReturn && (
        <div className={styles.featureBanner} role="status">
          <span className={styles.featureBannerGlyph} aria-hidden>✦</span>
          <span>Pas de souci, aucun paiement n&apos;a été pris. Reviens quand tu veux.</span>
        </div>
      )}

      {/* PAYWALL-FRONT-V1 : entrée depuis le modal d'upsell */}
      {blockedFeature && (
        <div className={styles.featureBanner} role="status">
          <span className={styles.featureBannerGlyph} aria-hidden>✦</span>
          <span>
            {blockedFeatLabel
              ? <>Pour débloquer <strong>{blockedFeatLabel}</strong>, passe au plan ci-dessous.</>
              : <>Cette fonctionnalité demande un plan supérieur — voici les options.</>
            }
          </span>
        </div>
      )}

      {/* PRICING-ANNUAL-V1 : bascule mensuel / annuel. */}
      <div className={styles.billingToggle} role="group" aria-label="Période de facturation">
        <button
          type="button"
          className={`${styles.billingOption} ${period === "month" ? styles.billingOptionActive : ""}`}
          aria-pressed={period === "month"}
          onClick={() => setPeriod("month")}
        >
          Mensuel
        </button>
        <button
          type="button"
          className={`${styles.billingOption} ${period === "year" ? styles.billingOptionActive : ""}`}
          aria-pressed={period === "year"}
          onClick={() => setPeriod("year")}
        >
          Annuel
          <span className={styles.billingSave}>2 mois offerts</span>
        </button>
      </div>

      {!plans ? (
        <div className={styles.plansGrid}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.cardSkeleton}>
              <div className="spinner" />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.plansGrid}>
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              isCurrent={currentCode === p.code}
              isLoggedIn={isLoggedIn}
              isRecommended={recommendedCode === p.code}
              period={period}
            />
          ))}
        </div>
      )}
    </>
  );
}

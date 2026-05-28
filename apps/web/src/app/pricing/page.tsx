"use client";

// ARCHIVE-PRICING-PAGE-V2
// Refonte de la page /pricing : header LLMastro + 3 cards plan avec features
// catégorisées + FAQ. La saisie de code promo a déménagé dans
// /dashboard/account (PROMO-CODES-V1) — un code « X jours gratuits »
// à côté d'un bouton « 9,90€/mois » crée de la friction sur le pricing.

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Header as LandingHeader } from "@/components/landing/Header";
import { apiClient } from "@/lib/api/client";
import { PlanCard, type PlanPayload } from "@/components/pricing/PlanCard";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import styles from "@/components/pricing/pricing.module.css";
import { humanFeatureLabel, recommendedPlanFor } from "@/lib/tiers/feature-labels"; // PAYWALL-FRONT-V1

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingPageFallback />}>
      <PricingPageContent />
    </Suspense>
  );
}

function PricingPageFallback() {
  return (
    <main className={styles.page}>
      <LandingHeader />
      <div className={styles.container}>
        <div className={styles.plansGrid}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.cardSkeleton}>
              <div className="spinner" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function PricingPageContent() {
  // PAYWALL-FRONT-V1 : entrée depuis le PaywallModal → on highlight la feature
  // qui a déclenché le block, et on suggère le plan minimum requis.
  const searchParams      = useSearchParams();
  const blockedFeature    = searchParams?.get("feature") ?? null;
  const blockedFeatLabel  = humanFeatureLabel(blockedFeature);
  const recommendedCode   = blockedFeature ? recommendedPlanFor(blockedFeature) : null;
  // STRIPE-MVP-V1 : retour depuis Checkout annulé.
  const isCanceledReturn  = searchParams?.get("canceled") === "1";

  // Snapshot the session token once at mount — sessionStorage can't be read
  // during SSR and reading it on every render would break purity. The page
  // is `force-dynamic`, so this client-only branch is fine.
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
  // On affiche un bandeau d'info en haut de page pour expliquer le « Bientôt
  // disponible » qui apparaîtra sur les cartes.
  const paidPlansComingSoon =
    plans?.some((p) => p.priceCents > 0 && p.code !== "premium" && p.purchasable === false) ?? false;

  return (
    <main className={styles.page}>
      <LandingHeader />

      <div className={styles.container}>
        <header className={styles.hero}>
          <span className={styles.heroEyebrow}>Tarifs · Sans engagement</span>
          <h1 className={styles.heroTitle}>
            Choisis <span className={styles.heroTitleAccent}>ton plan</span>
          </h1>
          <p className={styles.heroLead}>
            Découvre ton ciel à ton rythme. Change ou annule quand tu veux,
            tes données restent intactes.
          </p>
          <p className={styles.heroTrust}>
            Calculs Swiss Ephemeris · tables JPL (NASA) — précision astronomique
          </p>

          <div className={styles.heroOrnament} aria-hidden>
            <span className={styles.heroOrnamentLine} />
            <span>✦</span>
            <span className={styles.heroOrnamentLine} />
          </div>
        </header>

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
              />
            ))}
          </div>
        )}

        <PricingFAQ />

        <p className={styles.pageFooter}>
          Pas encore prêt ? Tu peux continuer à profiter du plan Découverte gratuitement.
        </p>
      </div>
    </main>
  );
}

// ARCHIVE-PRICING-PAGE-V2 applied

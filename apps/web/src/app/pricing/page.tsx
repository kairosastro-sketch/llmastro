"use client";

// ARCHIVE-PRICING-PAGE-V2
// Refonte de la page /pricing : header LLMastro + 3 cards plan avec features
// catégorisées + section codes promo (placeholder) + FAQ.

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header as LandingHeader } from "@/components/landing/Header";
import { apiClient } from "@/lib/api/client";
import { PlanCard, type PlanPayload } from "@/components/pricing/PlanCard";
import { PromoCodeInput } from "@/components/pricing/PromoCodeInput";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import styles from "@/components/pricing/pricing.module.css";
import { humanFeatureLabel, recommendedPlanFor } from "@/lib/tiers/feature-labels"; // PAYWALL-FRONT-V1

export default function PricingPage() {
  const [plans, setPlans]             = useState<PlanPayload[] | null>(null);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // PAYWALL-FRONT-V1 : entrée depuis le PaywallModal → on highlight la feature
  // qui a déclenché le block, et on suggère le plan minimum requis.
  const searchParams      = useSearchParams();
  const blockedFeature    = searchParams?.get("feature") ?? null;
  const blockedFeatLabel  = humanFeatureLabel(blockedFeature);
  const recommendedCode   = blockedFeature ? recommendedPlanFor(blockedFeature) : null;

  useEffect(() => {
    apiClient.get<{ plans: PlanPayload[] }>("/subscriptions/plans")
      .then((res: any) => {
        const sorted = (res.data.plans as PlanPayload[]).sort(
          (a, b) => a.sortOrder - b.sortOrder
        );
        setPlans(sorted);
      })
      .catch(() => setError("Impossible de charger les plans pour le moment."));

    const token = typeof window !== "undefined"
      ? sessionStorage.getItem("astro:access_token")
      : null;
    if (!token) return;
    setIsLoggedIn(true);
    apiClient.get("/auth/me", token)
      .then((res: any) => setCurrentCode(res.data?.plan?.code ?? null))
      .catch(() => { /* silently ignore — page works without */ });
  }, []);

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

        <PromoCodeInput />

        <PricingFAQ />

        <p className={styles.pageFooter}>
          Pas encore prêt ? Tu peux continuer à profiter du plan Découverte gratuitement.
        </p>
      </div>
    </main>
  );
}

// ARCHIVE-PRICING-PAGE-V2 applied

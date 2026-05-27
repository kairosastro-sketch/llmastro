// ARCHIVE-PRICING-PAGE-V2
// Carte de plan complète : header, prix, features groupées par catégorie, CTA.

"use client";

import { useMemo } from "react";
import styles from "./pricing.module.css";
import { PlanFeatureGroup } from "./PlanFeatureGroup";
import { PlanCTA } from "./PlanCTA";
import { FEATURE_GROUPS } from "./featureGroups";

export interface PlanPayload {
  id: string;
  code: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  billingPeriod: string;
  sortOrder: number;
  // [PRICING-STRIPE-NOT-LIVE-V1] Faux pour les plans payants tant que
  // Stripe n'est pas configuré côté serveur. Free reste toujours true.
  purchasable?: boolean;
  entitlements: { featureKey: string; valueType: string; value: unknown }[];
}

interface PlanCardProps {
  plan: PlanPayload;
  isCurrent: boolean;
  isLoggedIn: boolean;
  isRecommended?: boolean; // PAYWALL-FRONT-V1
}

export function PlanCard({ plan, isCurrent, isLoggedIn, isRecommended = false }: PlanCardProps) {
  const isHighlighted = plan.code === "essential";
  const isComingSoon  = plan.code === "premium";

  const valuesMap = useMemo(() => {
    const m = new Map<string, unknown>();
    for (const e of plan.entitlements) m.set(e.featureKey, e.value);
    return m;
  }, [plan.entitlements]);

  return (
    <article
      className={`${styles.planCard} ${isHighlighted ? styles.planCardHighlighted : ""} ${isRecommended ? styles.planCardRecommended : ""}`}
      aria-label={`Plan ${plan.name}${isRecommended ? " (recommandé)" : ""}`}
    >
      {isRecommended ? (
        <div className={`${styles.planBadge} ${styles.planBadgeRecommended}`}>
          ✦ Recommandé pour toi
        </div>
      ) : isHighlighted ? (
        <div className={`${styles.planBadge} ${styles.planBadgePopular}`}>
          Populaire
        </div>
      ) : null}
      {isComingSoon && !isRecommended && (
        <div className={`${styles.planBadge} ${styles.planBadgeSoft}`}>
          Bientôt
        </div>
      )}

      <header className={styles.planHeader}>
        <h2 className={styles.planName}>{plan.name}</h2>
        <p className={styles.planDescription}>{plan.description}</p>
      </header>

      <div className={styles.planPriceRow}>
        <PlanPrice plan={plan} isComingSoon={isComingSoon} />
      </div>

      <div className={styles.featureGroups}>
        {FEATURE_GROUPS.map((group) => (
          <PlanFeatureGroup
            key={group.id}
            glyph={group.glyph}
            title={group.title}
            features={group.features}
            values={valuesMap}
          />
        ))}
      </div>

      <div className={styles.planCta}>
        <PlanCTA
          planCode={plan.code}
          isCurrent={isCurrent}
          isLoggedIn={isLoggedIn}
          purchasable={plan.purchasable !== false}
        />
      </div>
    </article>
  );
}

function PlanPrice({ plan, isComingSoon }: { plan: PlanPayload; isComingSoon: boolean }) {
  // Pro (premium) en soft-launch : "Sur mesure"
  if (isComingSoon) {
    return (
      <>
        <span className={`${styles.planPrice} ${styles.planPriceSubtle}`}>
          Sur mesure
        </span>
        <span className={styles.planPriceAside}>
          Tarif adapté à ton usage. Contacte-nous.
        </span>
      </>
    );
  }

  // Découverte (free) : "Gratuit"
  if (plan.priceCents === 0) {
    return (
      <>
        <span className={styles.planPrice}>Gratuit</span>
        <span className={styles.planPricePeriod}>· pour toujours</span>
      </>
    );
  }

  // Plan payant
  const euros = plan.priceCents / 100;
  const display = plan.priceCents % 100 === 0
    ? `${Math.round(euros)}€`
    : `${euros.toFixed(2).replace(".", ",")}€`;

  return (
    <>
      <span className={styles.planPrice}>{display}</span>
      <span className={styles.planPricePeriod}>/ mois</span>
    </>
  );
}

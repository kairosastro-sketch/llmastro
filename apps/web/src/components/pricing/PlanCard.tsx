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
  // PRICING-ANNUAL-V1 : prix annuel en cents (null = pas d'offre annuelle).
  priceCentsYear?: number | null;
  currency: string;
  billingPeriod: string;
  sortOrder: number;
  // [PRICING-STRIPE-NOT-LIVE-V1] Faux pour les plans payants tant que
  // Stripe n'est pas configuré côté serveur. Free reste toujours true.
  purchasable?: boolean;
  // PRICING-ANNUAL-V1 : achetable en annuel seulement si un Price ID annuel existe.
  purchasableYear?: boolean;
  entitlements: { featureKey: string; valueType: string; value: unknown }[];
}

interface PlanCardProps {
  plan: PlanPayload;
  isCurrent: boolean;
  isLoggedIn: boolean;
  isRecommended?: boolean; // PAYWALL-FRONT-V1
  period?: "month" | "year"; // PRICING-ANNUAL-V1
}

export function PlanCard({ plan, isCurrent, isLoggedIn, isRecommended = false, period = "month" }: PlanCardProps) {
  const isHighlighted = plan.code === "essential";
  // PRICING-ANNUAL-V1 : Pro = offre "sur devis" (contact), pas un plan achetable.
  const isBespoke     = plan.code === "premium";

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

      <header className={styles.planHeader}>
        <h2 className={styles.planName}>{plan.name}</h2>
        <p className={styles.planDescription}>{plan.description}</p>
      </header>

      <div className={styles.planPriceRow}>
        <PlanPrice plan={plan} isBespoke={isBespoke} period={period} />
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

        {/* PRICING-ANNUAL-V1 : ligne sur-mesure du plan Pro. Pas d'entitlement
            associé (offre négociée), d'où un rendu statique distinct. */}
        {isBespoke && (
          <div className={styles.featureGroup}>
            <div className={styles.featureGroupHeader}>
              <span className={styles.featureGroupGlyph} aria-hidden>✧</span>
              <span>Sur mesure</span>
              <span className={styles.featureGroupHeaderLine} aria-hidden />
            </div>
            <div className={styles.featureRow}>
              <div className={styles.featureLabel}>
                <span aria-hidden className={`${styles.featureMark} ${styles.featureMarkPresent}`}>✓</span>
                <span>Intégration à vos propres outils</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.planCta}>
        <PlanCTA
          planCode={plan.code}
          isCurrent={isCurrent}
          isLoggedIn={isLoggedIn}
          purchasable={plan.purchasable !== false}
          purchasableYear={plan.purchasableYear === true}
          period={period}
        />
      </div>
    </article>
  );
}

// PRICING-ANNUAL-V1 : formate un montant en cents → "9,90€" / "99€".
function formatEuros(cents: number): string {
  const euros = cents / 100;
  return cents % 100 === 0
    ? `${Math.round(euros)}€`
    : `${euros.toFixed(2).replace(".", ",")}€`;
}

function PlanPrice({
  plan,
  isBespoke,
  period,
}: {
  plan: PlanPayload;
  isBespoke: boolean;
  period: "month" | "year";
}) {
  // Pro (premium) : offre sur devis — vouvoiement.
  if (isBespoke) {
    return (
      <>
        <span className={`${styles.planPrice} ${styles.planPriceSubtle}`}>
          Sur devis
        </span>
        <span className={styles.planPriceAside}>
          Tarif adapté à vos besoins. Contactez-nous.
        </span>
      </>
    );
  }

  // Découverte (free) : "Gratuit" (insensible à la période)
  if (plan.priceCents === 0) {
    return (
      <>
        <span className={styles.planPrice}>Gratuit</span>
        <span className={styles.planPricePeriod}>· pour toujours</span>
      </>
    );
  }

  // Plan payant en annuel — si une offre annuelle existe.
  if (period === "year" && plan.priceCentsYear != null) {
    const perMonth = plan.priceCentsYear / 12;
    const perMonthLabel = `${(perMonth / 100).toFixed(2).replace(".", ",")}€`;
    return (
      <>
        <span className={styles.planPrice}>{formatEuros(plan.priceCentsYear)}</span>
        <span className={styles.planPricePeriod}>/ an</span>
        <span className={styles.planPriceAside}>soit {perMonthLabel} / mois · 2 mois offerts</span>
      </>
    );
  }

  // Plan payant mensuel (défaut)
  return (
    <>
      <span className={styles.planPrice}>{formatEuros(plan.priceCents)}</span>
      <span className={styles.planPricePeriod}>/ mois</span>
    </>
  );
}

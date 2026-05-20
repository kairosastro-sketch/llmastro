// ARCHIVE-4-TIERS-UI-V1
// Hook principal pour accéder aux infos tiers.
// Lit AuthContext (plan + entitlements) et TiersContext (paywall).
"use client";

import { useState } from "react";
import { useAuth, type UserPlanInfo } from "@/lib/auth/AuthContext";
import { useTiersContext } from "@/contexts/TiersContext";
import type { EntitlementsMap, ResolvedEntitlement } from "@astro-platform/types";

export interface UseTiersReturn {
  plan:          UserPlanInfo | null;
  entitlements:  EntitlementsMap;
  isLoggedIn:    boolean;
  isFree:        boolean;
  isEssential:   boolean;
  isPremium:     boolean;
  isTrial:       boolean;
  trialEndsAt:   Date | null;
  daysLeftInTrial: number | null;

  /** Ouvre le paywall manuellement (ex: clic sur une card "Premium") */
  openPaywall:   (opts?: { feature?: string; message?: string }) => void;

  /** Récupère l'entitlement brut pour une clé */
  getEntitlement: (featureKey: string) => ResolvedEntitlement | null;

  /** Re-fetch les données depuis /auth/me (après upgrade/downgrade) */
  refresh:       () => Promise<void>;
}

export function useTiers(): UseTiersReturn {
  const { plan, entitlements, accessToken, refreshTiers } = useAuth();
  const { openPaywall } = useTiersContext();

  const code = plan?.code ?? null;
  const isTrial = plan?.isTrial === true;

  const trialEndsAt =
    isTrial && plan?.currentPeriodEnd ? new Date(plan.currentPeriodEnd) : null;

  // Snapshot Date.now() at hook mount instead of reading it during render
  // (react-hooks/purity). daysLeftInTrial is only used by status badges
  // (TrialBanner, PlanBadge, DashboardTopbar) — a stable per-session value
  // is acceptable; the next navigation will refresh it.
  const [nowSnapshot] = useState(() => Date.now());

  const daysLeftInTrial = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - nowSnapshot) / (24 * 60 * 60 * 1000)))
    : null;

  return {
    plan,
    entitlements,
    isLoggedIn:  accessToken !== null,
    isFree:      code === "free",
    isEssential: code === "essential",
    isPremium:   code === "premium",
    isTrial,
    trialEndsAt,
    daysLeftInTrial,
    openPaywall: (opts) =>
      openPaywall({ feature: opts?.feature, reason: "manual", message: opts?.message }),
    getEntitlement: (featureKey) => entitlements[featureKey] ?? null,
    refresh: refreshTiers,
  };
}

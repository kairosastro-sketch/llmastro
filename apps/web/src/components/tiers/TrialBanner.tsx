// ARCHIVE-4-TIERS-UI-V1 HOTFIX-4A
// Bandeau trial utilisant la classe .alert-banner du design system.
"use client";

import { useEffect, useState } from "react";
import { useTiers } from "@/hooks/useTiers";
import { UpgradeCTA } from "./UpgradeCTA";

interface TrialBannerProps {
  showBelowDays?: number;
  className?: string;
}

const SESSION_DISMISS_KEY = "astro:trial-banner-dismissed";

export function TrialBanner({ showBelowDays = 3, className = "" }: TrialBannerProps) {
  const { isTrial, daysLeftInTrial, plan } = useTiers();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_DISMISS_KEY);
    setDismissed(stored === "1");
  }, []);

  if (!isTrial) return null;
  if (daysLeftInTrial === null) return null;
  if (daysLeftInTrial > showBelowDays) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setDismissed(true);
  };

  const message =
    daysLeftInTrial === 0
      ? "Ton essai se termine aujourd'hui"
      : daysLeftInTrial === 1
      ? "Il te reste 1 jour d'essai Essentiel"
      : `Il te reste ${daysLeftInTrial} jours d'essai ${plan?.name ?? "Essentiel"}`;

  return (
    <div
      role="status"
      className={`alert-banner ${className}`.trim()}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="ab-ico">⏳</span>
        <span>{message}. Après, tu reviendras en plan Découverte.</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <UpgradeCTA variant="inline" label="Continuer à profiter" />
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Masquer ce message"
          style={{
            padding: 4,
            borderRadius: "var(--r-sm)",
            color: "var(--muted)",
            fontSize: 14,
            lineHeight: 1,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

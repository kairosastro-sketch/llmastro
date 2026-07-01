// ============================================================
// apps/web/src/components/ciel/TrackedCta.tsx
// CIEL-CONVERSION-EVENTS-V1 — lien CTA qui émet un event de conversion
// au clic. Composant client. Migré GTM → Umami (UMAMI-ANALYTICS-V1).
//
// Event émis : umami.track('cta_click', { cta_id, cta_target, cta_page })
// → un seul nom d'event (cta_click) ; les emplacements se distinguent
//   via `cta_id` (ciel_rail | ciel_houses | ciel_footer).
//
// En dev / hors-prod, le tracker Umami n'est pas chargé → window.umami
// absent → appel ignoré (no-op sûr). Umami est cookieless/sans
// consentement, rien à gérer côté consentement.
// ============================================================

"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export function TrackedCta({
  id,
  href,
  className,
  style,
  ariaLabel,
  children,
}: {
  id: string;
  href: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={() => {
        try {
          window.umami?.track("cta_click", {
            cta_id: id,
            cta_target: href,
            cta_page: window.location.pathname,
          });
        } catch {
          /* umami absent (dev / hors-prod) : no-op */
        }
      }}
    >
      {children}
    </Link>
  );
}

// CIEL-CONVERSION-EVENTS-V1 TrackedCta applied

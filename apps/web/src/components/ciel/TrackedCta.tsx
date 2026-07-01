// ============================================================
// apps/web/src/components/ciel/TrackedCta.tsx
// CIEL-CONVERSION-EVENTS-V1 — lien CTA qui pousse un event dataLayer
// au clic (mesure de conversion GTM). Composant client.
//
// Schéma poussé :
//   { event:'cta_click', cta_id, cta_target, cta_page }
// → un seul trigger GTM (event=cta_click) ; les emplacements se
//   distinguent via `cta_id` (ciel_rail | ciel_houses | ciel_footer).
//
// En dev / hors-prod, GTM n'est pas chargé → window.dataLayer absent
// → push ignoré (no-op sûr). GTM (Consent Mode v2) gère le respect du
// consentement côté tags.
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
          window.dataLayer?.push({
            event: "cta_click",
            cta_id: id,
            cta_target: href,
            cta_page: window.location.pathname,
          });
        } catch {
          /* dataLayer absent (dev / hors-prod) : no-op */
        }
      }}
    >
      {children}
    </Link>
  );
}

// CIEL-CONVERSION-EVENTS-V1 TrackedCta applied

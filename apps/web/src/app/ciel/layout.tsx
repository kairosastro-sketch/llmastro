// ============================================================
// apps/web/src/app/ciel/layout.tsx
// CIEL-PUBLIC-V1-PAGES
// ------------------------------------------------------------
// Layout commun aux 4 pages FR /ciel/[cadence].
// Inclut le chrome de site (Header + Footer via CielChrome), le
// subnav (4 onglets) et un wrapper section.
// ============================================================

import { CielSubnav } from "@/components/ciel/CielSubnav";
import { CielChrome } from "@/components/ciel/CielChrome"; // CIEL-SITE-CHROME-V1

export default function CielLayout({ children }: { children: React.ReactNode }) {
  // CIEL-SITE-CHROME-V1 : nav du site + footer global sur /ciel (landing
  // depuis les RS). La page reste exclue du SiteFooter global → pas de doublon.
  return (
    <CielChrome>
      <CielSubnav lang="fr" />
      {children}
    </CielChrome>
  );
}

// CIEL-PUBLIC-V1-PAGES layout applied

// CIEL-I18N-V1 layout applied

// CIEL-SITE-CHROME-V1 layout applied

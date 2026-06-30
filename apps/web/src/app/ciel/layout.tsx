// ============================================================
// apps/web/src/app/ciel/layout.tsx
// CIEL-PUBLIC-V1-PAGES
// ------------------------------------------------------------
// Layout commun aux 4 pages FR /ciel/[cadence].
// Inclut le subnav (4 onglets) et un wrapper section.
// ============================================================

import { CielSubnav } from "@/components/ciel/CielSubnav";
import { Header } from "@/components/landing/Header"; // CIEL-SITE-CHROME-V1
import { Footer } from "@/components/landing/Footer"; // CIEL-SITE-CHROME-V1

export default function CielLayout({ children }: { children: React.ReactNode }) {
  return (
    // CIEL-SITE-CHROME-V1 : nav du site + footer global sur /ciel (landing
    // depuis les RS). Le padding-haut dégage le header fixe (72px desktop /
    // 56px mobile). La page reste exclue du SiteFooter global → pas de doublon.
    <>
      <Header />
      <main
        style={{
          maxWidth: "min(1100px, 96vw)",
          margin: "0 auto",
          padding: "calc(72px + 1.5rem) 1rem 4rem",
        }}
      >
        <CielSubnav lang="fr" />
        {children}
      </main>
      <Footer />
    </>
  );
}

// CIEL-PUBLIC-V1-PAGES layout applied

// CIEL-I18N-V1 layout applied

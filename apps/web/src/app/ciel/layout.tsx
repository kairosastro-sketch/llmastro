// ============================================================
// apps/web/src/app/ciel/layout.tsx
// CIEL-PUBLIC-V1-PAGES
// ------------------------------------------------------------
// Layout commun aux 4 pages /ciel/[cadence].
// Inclut le subnav (4 onglets) et un wrapper section.
// ============================================================

import { CielSubnav } from "@/components/ciel/CielSubnav";

export default function CielLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: "min(1100px, 96vw)",
        margin: "0 auto",
        padding: "2.5rem 1rem 4rem",
      }}
    >
      <CielSubnav />
      {children}
    </main>
  );
}

// CIEL-PUBLIC-V1-PAGES layout applied

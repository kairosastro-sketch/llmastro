// ============================================================
// ARCHIVE-LIMITS-PAGE-V1 — app/limites/page.tsx
// Page publique listant les limites de Llmastro.
// ============================================================

import { LimitsPage } from "@/components/landing/LimitsPage";

export const metadata = {
  title: "Limites",
  alternates: { canonical: "/limites" },
  description:
    "Ce que Llmastro ne fait pas et ne sait pas faire. Astrologie médicale, prédictions précises, statut scientifique : nos limites posées noir sur blanc.",
  // Page publique indexable (transparence assumée)
  robots: {
    index: true,
    follow: true,
  },
};

export default function Limits() {
  return <LimitsPage />;
}

// ARCHIVE-LIMITS-PAGE-V1 applied

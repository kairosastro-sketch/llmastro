// ============================================================
// AUTH-UX-POLISH-V1 — /confidentialite/page.tsx
// LEGAL-PAGES-FIX-V1 applied
// HEADER-LEGAL-PAGES-V2 applied
// ------------------------------------------------------------
// Server Component thin wrapper: delegates rendering to
// ConfidentialiteContent (Client). Same pattern as MethodPage,
// LimitsPage, BibliographyPage.
// ============================================================

import type { Metadata } from "next";
import { ConfidentialiteContent } from "@/components/landing/ConfidentialiteContent";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité et traitement des données personnelles de Llmastro.",
};

export default function ConfidentialitePage() {
  return <ConfidentialiteContent />;
}

// ============================================================
// AUTH-UX-POLISH-V1 — /cgu/page.tsx
// LEGAL-PAGES-FIX-V1 applied
// HEADER-LEGAL-PAGES-V2 applied
// ------------------------------------------------------------
// Server Component thin wrapper: delegates rendering to
// CGUContent (Client). Same pattern as MethodPage, LimitsPage,
// BibliographyPage. Allows the page to declare metadata while
// the interactive shell (Header sticky etc.) lives in a Client
// Component where Context Providers are guaranteed to be in scope.
// ============================================================

import type { Metadata } from "next";
import { CGUContent } from "@/components/landing/CGUContent";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  alternates: { canonical: "/cgu" },
  description: "Conditions générales d'utilisation de Llmastro.",
};

export default function CGUPage() {
  return <CGUContent />;
}

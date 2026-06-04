// ============================================================
// LEGAL-DOCS-V1 — /mentions-legales/page.tsx
// ------------------------------------------------------------
// Server Component thin wrapper: delegates rendering to
// MentionsLegalesContent (Client). Même pattern que /cgu et
// /confidentialite.
// ============================================================

import type { Metadata } from "next";
import { MentionsLegalesContent } from "@/components/landing/MentionsLegalesContent";

export const metadata: Metadata = {
  title: "Mentions légales",
  alternates: { canonical: "/mentions-legales" },
  description:
    "Mentions légales de Llmastro — éditeur KAIROSAST LTD, hébergeur, contact.",
};

export default function MentionsLegalesPage() {
  return <MentionsLegalesContent />;
}

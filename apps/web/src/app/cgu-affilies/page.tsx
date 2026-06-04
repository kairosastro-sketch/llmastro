// ============================================================
// LEGAL-DOCS-AFFILIES-V1 — /cgu-affilies/page.tsx
// Server thin wrapper delegating to CGUAffiliesContent (Client).
// Pattern aligné sur /cgu/page.tsx.
// ============================================================

import type { Metadata } from "next";
import { CGUAffiliesContent } from "@/components/landing/CGUAffiliesContent";

export const metadata: Metadata = {
  title: "Conditions Générales du programme Ambassadeurs — Llmastro",
  alternates: { canonical: "/cgu-affilies" },
  description:
    "Conditions Générales du programme d'affiliation Ambassadeurs Llmastro (KAIROSAST LTD).",
};

export default function CGUAffiliesPage() {
  return <CGUAffiliesContent />;
}

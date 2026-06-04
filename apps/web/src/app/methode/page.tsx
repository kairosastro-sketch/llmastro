// ============================================================
// LANDING-V1 — app/methode/page.tsx
// Page dédiée pour expliquer la méthodologie Llmastro.
// ============================================================

import { MethodPage } from "@/components/landing/MethodPage";

export const metadata = {
  title: "Méthode",
  alternates: { canonical: "/methode" },
  description:
    "Comment Llmastro fonctionne : Swiss Ephemeris, JPL NASA, Kairos, persistance des lectures. Une cartographie astrologique sérieuse, en français.",
  // Cette page DOIT être indexable (contrairement au dashboard)
  robots: {
    index: true,
    follow: true,
  },
};

export default function Method() {
  return <MethodPage />;
}

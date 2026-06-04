// ============================================================
// LANDING-V1 — app/methode/page.tsx
// Page dédiée pour expliquer la méthodologie Llmastro.
// ============================================================

import { MethodPage } from "@/components/landing/MethodPage";
import { articleJsonLd } from "@/lib/seo/jsonld";

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

const jsonLd = articleJsonLd({
  headline: "Méthode — comment Llmastro fonctionne",
  description:
    "Comment Llmastro fonctionne : Swiss Ephemeris, JPL NASA, Kairos, persistance des lectures. Une cartographie astrologique sérieuse, en français.",
  path: "/methode",
  date: "2026-04-30",
});

export default function Method() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MethodPage />
    </>
  );
}

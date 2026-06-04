// ============================================================
// LANDING-V1 — app/histoire/page.tsx
// Page éditoriale : l'histoire de la lecture du ciel.
// ============================================================

import { HistoirePage } from "@/components/landing/HistoirePage";
import { articleJsonLd } from "@/lib/seo/jsonld";

export const metadata = {
  title: "Histoire",
  alternates: { canonical: "/histoire" },
  description:
    "Des premières pierres dressées à l'intelligence artificielle : le long voyage de l'humanité à la recherche de sens dans les étoiles.",
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = articleJsonLd({
  headline: "Histoire — le long voyage de la lecture du ciel",
  description:
    "Des premières pierres dressées à l'intelligence artificielle : le long voyage de l'humanité à la recherche de sens dans les étoiles.",
  path: "/histoire",
  date: "2026-06-04",
});

export default function Histoire() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HistoirePage />
    </>
  );
}

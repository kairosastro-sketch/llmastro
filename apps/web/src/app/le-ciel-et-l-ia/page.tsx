// ============================================================
// LANDING-V1 — app/le-ciel-et-l-ia/page.tsx
// Page éditoriale : « Le ciel & l'IA » — relier les points.
// ============================================================

import { CielIaPage } from "@/components/landing/CielIaPage";
import { articleJsonLd } from "@/lib/seo/jsonld";

export const metadata = {
  title: "Le ciel & l'IA",
  alternates: { canonical: "/le-ciel-et-l-ia" },
  description:
    "Tracer des liens entre les étoiles pour en faire du sens : le geste des constellations, repris aujourd'hui par l'intelligence artificielle.",
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = articleJsonLd({
  headline: "Le ciel & l'IA — relier les points pour faire du sens",
  description:
    "Tracer des liens entre les étoiles pour en faire du sens : le geste des constellations, repris aujourd'hui par l'intelligence artificielle.",
  path: "/le-ciel-et-l-ia",
  date: "2026-06-04",
});

export default function CielIa() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CielIaPage />
    </>
  );
}

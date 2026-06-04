// ============================================================
// LANDING-V1 — app/le-ciel-et-l-ia/page.tsx
// Page éditoriale : « Le ciel & l'IA » — relier les points.
// ============================================================

import { CielIaPage } from "@/components/landing/CielIaPage";

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

export default function CielIa() {
  return <CielIaPage />;
}

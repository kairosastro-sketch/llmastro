// ============================================================
// LANDING-V1 — app/histoire/page.tsx
// Page éditoriale : l'histoire de la lecture du ciel.
// ============================================================

import { HistoirePage } from "@/components/landing/HistoirePage";

export const metadata = {
  title: "Histoire",
  description:
    "Des premières pierres dressées à l'intelligence artificielle : le long voyage de l'humanité à la recherche de sens dans les étoiles.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function Histoire() {
  return <HistoirePage />;
}

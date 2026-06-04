// SEO-CANONICAL-V1
// /pricing/page.tsx est un Client Component (checkout interactif) et ne
// peut donc pas exporter de `metadata`. Ce layout serveur fournit le
// titre/description propres + le canonical de la page tarifs (qui
// héritait sinon du titre générique de la home).

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Les offres Llmastro : thème natal détaillé, horoscopes personnalisés, synastrie et tarot. Astrologie sérieuse en français, sans engagement.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

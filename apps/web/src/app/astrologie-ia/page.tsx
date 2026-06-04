// ============================================================
// GEO-CONTENT-V1 — app/astrologie-ia/page.tsx
// Page GEO ciblée « astrologie IA » : Server Component qui porte la
// metadata + le JSON-LD (FAQPage), et délègue le visuel au Client
// Component AstrologieIaPage (Header/Footer/Stars). Même pattern que
// les pages éditoriales (/methode, /histoire…).
// ============================================================

import type { Metadata } from "next";
import { AstrologieIaPage } from "@/components/landing/AstrologieIaPage";
import { GEO_FAQ } from "@/components/landing/geo-faq-data";

export const metadata: Metadata = {
  title: "Astrologie IA — sérieuse, pas générique",
  description:
    "Llmastro calcule ton thème natal avec les éphémérides Swiss Ephemeris et les tables JPL de la NASA, puis une IA les interprète. Comparatif face à l'horoscope générique et réponses aux questions fréquentes.",
  alternates: { canonical: "/astrologie-ia" },
  robots: { index: true, follow: true },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: GEO_FAQ.map((e) => ({
    "@type": "Question",
    name: e.q,
    acceptedAnswer: { "@type": "Answer", text: e.a },
  })),
};

export default function AstrologieIa() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <AstrologieIaPage />
    </>
  );
}

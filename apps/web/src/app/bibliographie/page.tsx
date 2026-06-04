// ============================================================
// ARCHIVE-BIBLIOGRAPHY-V1 — app/bibliographie/page.tsx
// Route Next.js publique /bibliographie.
// ============================================================

import { BibliographyPage } from "@/components/landing/BibliographyPage";

export const metadata = {
  title: "Bibliographie",
  alternates: { canonical: "/bibliographie" },
  description:
    "Sources astrologiques utilisées par Llmastro : références fondatrices de l'astrologie psychologique, archétypale, humaniste et traditionnelle.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function Bibliographie() {
  return <BibliographyPage />;
}

// ARCHIVE-BIBLIOGRAPHY-V1 applied

// ============================================================
// apps/web/src/components/ciel/CielChrome.tsx
// CIEL-SITE-CHROME-V1
// ------------------------------------------------------------
// Enveloppe « chrome de site » des pages /ciel : la nav du site
// (Header) + le footer global (Footer) autour du contenu.
//
// Pourquoi un wrapper client ? Footer (landing) appelle useT() mais
// n'a pas de directive "use client" propre : il vit d'ordinaire sous
// une frontière client (landing / SiteFooter). Les layouts /ciel sont
// des Server Components → on établit ici la frontière client pour
// pouvoir y rendre Header + Footer sans « useT() from the server ».
//
// Le padding-haut du <main> dégage le header fixe (72px desktop /
// 56px mobile).
// ============================================================

"use client";

import type { ReactNode } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export function CielChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main
        style={{
          // CIEL-POLISH-V1 : largeur alignée sur la landing (max-width 1200px)
          // pour la cohérence avec le reste du site.
          maxWidth: "min(1200px, 94vw)",
          margin: "0 auto",
          padding: "calc(72px + 1.5rem) 1rem 4rem",
        }}
      >
        {children}
      </main>
      <Footer />
    </>
  );
}

// CIEL-SITE-CHROME-V1 CielChrome applied

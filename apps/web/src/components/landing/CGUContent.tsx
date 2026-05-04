// ============================================================
// HEADER-LEGAL-PAGES-V2 — CGUContent (page /cgu)
// Pattern wrapper: cf. MethodPage, LimitsPage, BibliographyPage.
// Server Component (page.tsx) gère metadata; ce composant Client
// gère le rendu interactif (Header sticky avec scroll detect, etc.)
// ============================================================

"use client";

import Link from "next/link";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { StarsBackground } from "@/components/ui/StarsBackground";
import styles from "./landing.module.css";

export function CGUContent() {
  return (
    <>
      <StarsBackground count={80} />
      <div className={styles.page}>
        <Header />
        <main
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "140px 24px 80px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 38,
              fontWeight: 300,
              color: "var(--star)",
              letterSpacing: ".03em",
              marginBottom: 8,
              lineHeight: 1.15,
            }}
          >
            Conditions générales d&apos;utilisation
          </h1>

          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 32 }}>
            Document en cours de rédaction.
          </p>

          <div
            className="card"
            style={{
              padding: "28px 24px",
              boxShadow: "var(--shadow-float)",
              lineHeight: 1.7,
              color: "var(--star)",
              fontSize: 15,
            }}
          >
            <p style={{ marginBottom: 14 }}>
              Les conditions générales d&apos;utilisation (CGU) de Llmastro sont actuellement en
              cours de rédaction. Une version définitive sera publiée prochainement à cette
              adresse.
            </p>
            <p style={{ marginBottom: 14 }}>
              En attendant, l&apos;utilisation de la plateforme implique une acceptation tacite
              des principes généraux suivants&nbsp;: usage personnel et non commercial, respect
              des autres utilisateurs, et interdiction de toute tentative d&apos;altération du
              service.
            </p>
            <p>
              Pour toute question concernant l&apos;usage de la plateforme, l&apos;accès à ton
              compte ou tes données, tu peux nous écrire à{" "}
              <a href="mailto:contact@llmastro.com" style={{ color: "var(--gold)" }}>
                contact@llmastro.com
              </a>
              .
            </p>
          </div>

          <div style={{ marginTop: 32 }}>
            <Link
              href="/"
              style={{ color: "var(--gold)", fontSize: 14, textDecoration: "none" }}
            >
              ← Retour à l&apos;accueil
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

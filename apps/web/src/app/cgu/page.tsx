// ============================================================
// AUTH-UX-POLISH-V1 — /cgu/page.tsx
// ------------------------------------------------------------
// Placeholder pour les Conditions Générales d'Utilisation.
// Page nécessaire car la checkbox CGU au register exige
// qu'un document existe à cette URL — sinon UX cassée
// (lien 404) + risque légal.
//
// Ce placeholder doit être remplacé par un document CGU réel
// dans une session dédiée (rédaction juridique).
// ============================================================

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: "Conditions générales d'utilisation de Llmastro.",
};

export default function CGUPage() {
  return (
    <main style={{
      minHeight: "100dvh",
      maxWidth: 720,
      margin: "0 auto",
      padding: "80px 24px 64px",
      position: "relative",
      zIndex: 1,
    }}>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: 38,
        fontWeight: 300,
        color: "var(--star)",
        letterSpacing: ".03em",
        marginBottom: 8,
        lineHeight: 1.15,
      }}>
        Conditions générales d'utilisation
      </h1>

      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 32 }}>
        Document en cours de rédaction.
      </p>

      <div className="card" style={{
        padding: "28px 24px",
        boxShadow: "var(--shadow-float)",
        lineHeight: 1.7,
        color: "var(--star)",
        fontSize: 15,
      }}>
        <p style={{ marginBottom: 14 }}>
          Les conditions générales d'utilisation (CGU) de Llmastro sont actuellement en cours de
          rédaction. Une version définitive sera publiée prochainement à cette adresse.
        </p>
        <p style={{ marginBottom: 14 }}>
          En attendant, l'utilisation de la plateforme implique une acceptation tacite des
          principes généraux suivants : usage personnel et non commercial, respect des autres
          utilisateurs, et interdiction de toute tentative d'altération du service.
        </p>
        <p>
          Pour toute question concernant l'usage de la plateforme, l'accès à ton compte
          ou tes données, tu peux nous écrire à{" "}
          <a href="mailto:contact@llmastro.com" style={{ color: "var(--gold)" }}>
            contact@llmastro.com
          </a>.
        </p>
      </div>

      <div style={{ marginTop: 32 }}>
        <Link href="/" style={{ color: "var(--gold)", fontSize: 14, textDecoration: "none" }}>
          ← Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}

// AUTH-UX-POLISH-V1 applied

// LEGAL-PAGES-FIX-V1 applied

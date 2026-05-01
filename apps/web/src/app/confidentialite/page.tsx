// ============================================================
// AUTH-UX-POLISH-V1 — /confidentialite/page.tsx
// ------------------------------------------------------------
// Placeholder pour la politique de confidentialité.
// Même justification que /cgu : la checkbox au register exige
// qu'un document existe à cette URL.
//
// Ce placeholder doit être remplacé par une politique de
// confidentialité réelle conforme RGPD dans une session
// dédiée (rédaction juridique).
// ============================================================

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et traitement des données personnelles de Llmastro.",
};

export default function ConfidentialitePage() {
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
        color: "var(--text-primary)",
        letterSpacing: ".03em",
        marginBottom: 8,
        lineHeight: 1.15,
      }}>
        Politique de confidentialité
      </h1>

      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32 }}>
        Document en cours de rédaction.
      </p>

      <div className="glass-strong" style={{
        padding: "28px 24px",
        boxShadow: "var(--shadow-float)",
        lineHeight: 1.7,
        color: "var(--text-primary)",
        fontSize: 15,
      }}>
        <p style={{ marginBottom: 14 }}>
          La politique de confidentialité de Llmastro est actuellement en cours de rédaction.
          Une version définitive conforme au RGPD sera publiée prochainement à cette adresse.
        </p>
        <p style={{ marginBottom: 14 }}>
          En attendant, voici les principes généraux que nous appliquons :
        </p>
        <ul style={{ paddingLeft: 20, marginBottom: 14, listStyle: "disc" }}>
          <li style={{ marginBottom: 8 }}>
            Les données de naissance que tu nous confies (date, heure, lieu) sont stockées
            de manière sécurisée et ne sont jamais partagées avec des tiers.
          </li>
          <li style={{ marginBottom: 8 }}>
            Ton adresse email sert à l'authentification et aux communications strictement
            liées à ton compte (jamais de marketing externe).
          </li>
          <li style={{ marginBottom: 8 }}>
            Tu peux à tout moment demander l'export ou la suppression de tes données.
          </li>
        </ul>
        <p>
          Pour toute question concernant tes données personnelles ou pour exercer tes droits
          (accès, rectification, suppression, portabilité), tu peux nous écrire à{" "}
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

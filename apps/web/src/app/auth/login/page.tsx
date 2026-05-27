// ============================================================
// AUTH-PAGES-DESIGN-V1 — /auth/login/page.tsx
// ------------------------------------------------------------
// Refonte composition A : card centrée + starfield inline.
//
// Changements vs version précédente :
//   1. Suppression des `<div className="orb">` qui n'existaient
//      pas dans globals.css → s'affichaient comme deux blocs
//      gris-mauves dans le vide
//   2. Suppression des classes inventées (.glass-strong)
//   3. Suppression des variables inventées (--gold-glow,
//      --gold-border, --bg-void, --text-primary, --text-muted,
//      --shadow-float, --r-lg, --font-display)
//   4. Utilisation EXCLUSIVE des classes/tokens réels du
//      design system :
//      - var(--bg), var(--star), var(--gold), var(--muted),
//        var(--card-bg), var(--card-border), var(--border)
//      - .card (pour la carte du formulaire)
//      - <Starfield /> composant local pour les étoiles
// ============================================================

import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthStarfield } from "@/components/auth/AuthStarfield";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main style={{
      // [SCROLL-FIX-V1] Même fix que /auth/register : layout en flux
      // normal pour permettre le scroll quand le contenu dépasse 100dvh
      // (Android avec barre de navigation + clavier ouvert).
      minHeight: "100dvh",
      padding: "60px 16px 40px",
      position: "relative",
      background: "var(--bg)",
    }}>
      <AuthStarfield count={70} />

      <div style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        maxWidth: 420,
        margin: "0 auto",
      }}>
        {/* Retour à l'accueil — lien discret */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--muted)",
            textDecoration: "none",
            marginBottom: 18,
          }}
        >
          <span aria-hidden="true">←</span> Retour à l&apos;accueil
        </Link>

        {/* Brand — cliquable vers l'accueil */}
        <Link
          href="/"
          aria-label="Llmastro — retour à l'accueil"
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            marginBottom: 32,
          }}
        >
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "1px solid var(--border-mid)",
            color: "var(--gold)",
            fontSize: 22,
            marginBottom: 14,
          }}>
            ☽
          </div>
          <h1 style={{
            fontFamily: "Georgia, serif",
            fontSize: 32,
            fontWeight: 400,
            color: "var(--star)",
            letterSpacing: "0.04em",
            lineHeight: 1.15,
            margin: "0 0 4px",
          }}>
            Llmastro <span style={{ color: "var(--gold)" }}>✨</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Votre carte du ciel vous attend
          </p>
        </Link>

        {/* Card */}
        <div className="card" style={{
          padding: "26px 22px",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "var(--r-lg)",
        }}>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: 20,
            fontWeight: 400,
            color: "var(--gold)",
            letterSpacing: "0.5px",
            margin: "0 0 18px",
          }}>
            Connexion
          </h2>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

// AUTH-PAGES-DESIGN-V1 applied
// AUTH-HOME-LINK-V1 applied

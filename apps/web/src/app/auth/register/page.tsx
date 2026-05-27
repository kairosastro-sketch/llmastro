// ============================================================
// AUTH-PAGES-DESIGN-V1 — /auth/register/page.tsx
// ------------------------------------------------------------
// Refonte composition A : card centrée + starfield inline.
// Symétrique de /auth/login/page.tsx pour cohérence visuelle.
//
// Cf. justification complète dans login/page.tsx.
// ============================================================

import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthStarfield } from "@/components/auth/AuthStarfield";

export const metadata: Metadata = { title: "Créer un compte" };

export default function RegisterPage() {
  return (
    <main style={{
      // [SCROLL-FIX-V1] Sur certains Android, le contenu register dépasse
      // 100dvh (brand + back link + h1 + caption + 3 champs + 2 OAuth +
      // submit + lien login). Avec `alignItems: center`, l'overflow du
      // haut devenait inaccessible au scroll → submit invisible.
      // Fix : layout en flux normal vertical, centré horizontalement
      // par margin:auto sur le wrapper. Scroll naturel si trop haut.
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
            ✦
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
            Commencez votre voyage astrologique
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
            Créer un compte
          </h2>
          <RegisterForm />
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center",
          marginTop: 18,
          fontSize: 13,
          color: "var(--muted)",
        }}>
          Déjà un compte ?{" "}
          <Link
            href="/auth/login"
            style={{ color: "var(--gold)", textDecoration: "none", fontWeight: 500 }}
          >
            Se connecter
          </Link>
        </div>
      </div>
    </main>
  );
}

// AUTH-PAGES-DESIGN-V1 applied
// AUTH-HOME-LINK-V1 applied

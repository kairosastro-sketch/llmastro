// register-page-redesign-v1 — aligné sur le design de /auth/login
// (inline styles + variables CSS du design system, plus de classes Tailwind custom)

import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Créer un compte" };

export default function RegisterPage() {
  return (
    <main style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px 16px",
      position: "relative",
      zIndex: 1,
    }}>
      {/* Orbes ambiants — mêmes dimensions que login, positions inversées pour variation */}
      <div className="orb" style={{ width: 360, height: 360, background: "var(--gold)", bottom: "15%", right: "-15%", opacity: .07 }} />
      <div className="orb orb-2" style={{ width: 280, height: 280, background: "#8b5cf6", top: "20%", left: "-10%", opacity: .06 }} />

      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp .5s var(--ease-out) both" }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: "var(--r-lg)",
            background: "var(--gold-glow)", border: "1px solid var(--gold-border)",
            marginBottom: 16, fontSize: 24, color: "var(--gold)",
          }}>✦</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 300,
            color: "var(--text-primary)", letterSpacing: ".04em",
            marginBottom: 6, lineHeight: 1.1,
          }}>
            Astro Platform
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Commencez votre voyage astrologique
          </p>
        </div>

        {/* Card */}
        <div className="glass-strong" style={{ padding: "28px 24px", boxShadow: "var(--shadow-float)" }}>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400,
            color: "var(--text-primary)", marginBottom: 22,
          }}>
            Créer un compte
          </h2>
          <RegisterForm />
        </div>

        {/* Footer : lien vers login */}
        <div style={{
          textAlign: "center",
          marginTop: 20,
          fontSize: 13,
          color: "var(--text-muted)",
        }}>
          Déjà un compte ?{" "}
          <Link
            href="/auth/login"
            style={{
              color: "var(--gold)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Se connecter
          </Link>
        </div>
      </div>
    </main>
  );
}

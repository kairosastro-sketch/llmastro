import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
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
      {/* Orbes ambiants */}
      <div className="orb" style={{ width: 360, height: 360, background: "var(--gold)", top: "15%", left: "-15%", opacity: .07 }} />
      <div className="orb orb-2" style={{ width: 280, height: 280, background: "#8b5cf6", bottom: "20%", right: "-10%", opacity: .06 }} />

      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp .5s var(--ease-out) both" }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: "var(--r-lg)",
            background: "var(--gold-glow)", border: "1px solid var(--gold-border)",
            marginBottom: 16, fontSize: 24, color: "var(--gold)",
          }}>☽</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 300,
            color: "var(--text-primary)", letterSpacing: ".04em",
            marginBottom: 6, lineHeight: 1.1,
          }}>
            Astro Platform
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Votre carte du ciel vous attend
          </p>
        </div>

        {/* Card */}
        <div className="glass-strong" style={{ padding: "28px 24px", boxShadow: "var(--shadow-float)" }}>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400,
            color: "var(--text-primary)", marginBottom: 22,
          }}>
            Connexion
          </h2>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

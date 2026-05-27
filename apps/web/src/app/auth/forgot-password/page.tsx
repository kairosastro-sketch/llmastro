// ============================================================
// apps/web/src/app/auth/forgot-password/page.tsx
// AUTH-PASSWORD-RECOVERY-V1
// ------------------------------------------------------------
// Page « mot de passe oublié » : un seul champ email, POST vers
// /auth/request-password-reset, puis affichage d'un message de
// confirmation générique (anti-enum côté backend → on n'affiche
// JAMAIS si l'email existe ou non).
//
// Design aligné sur /auth/login et /auth/verify-email : starfield
// + card centrée, palette « Céleste ».
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { useApp } from "@/lib/i18n";
import { AuthStarfield } from "@/components/auth/AuthStarfield";
import { InputField } from "@/components/ui/InputField";
import { isValidEmail } from "@/components/auth/auth-utils";

export default function ForgotPasswordPage() {
  const { locale } = useApp();
  const fr = locale !== "en";

  const [email, setEmail]       = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);

  const t = TRANSLATIONS[fr ? "fr" : "en"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailErr(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailErr(t.emailRequired);
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailErr(t.emailInvalid);
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/auth/request-password-reset", { email: trimmed });
      // Réponse toujours 200 côté backend (anti-enum). On affiche
      // donc systématiquement le même message générique.
      setSent(true);
    } catch {
      // Même en cas d'erreur réseau / 429, on affiche le message
      // générique pour ne pas révéler l'existence du compte. Un
      // utilisateur qui ne reçoit rien aura le réflexe de retenter.
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
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
        <Link
          href="/auth/login"
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
          <span aria-hidden="true">←</span> {t.backToLogin}
        </Link>

        <Link
          href="/"
          aria-label="Llmastro"
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
        </Link>

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
            margin: "0 0 8px",
          }}>
            {t.title}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px", lineHeight: 1.55 }}>
            {t.subtitle}
          </p>

          {sent ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: "14px 16px",
                borderRadius: "var(--r-md)",
                background: "rgba(201,168,76,.08)",
                border: "1px solid rgba(201,168,76,.22)",
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--star)",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span aria-hidden="true" style={{ color: "var(--gold)", fontSize: 16 }}>✦</span>
                <div>
                  <strong style={{ color: "var(--star)" }}>{t.sentTitle}</strong>
                  <div style={{ marginTop: 4, color: "var(--muted)" }}>{t.sentBody}</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <Link
                  href="/auth/login"
                  className="btn-ob"
                  style={{
                    fontSize: 13,
                    padding: "8px 18px",
                    display: "inline-block",
                    textDecoration: "none",
                    width: "auto",
                  }}
                >
                  {t.backToLogin}
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <InputField
                label={t.emailLabel}
                type="email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  if (emailErr) setEmailErr(null);
                }}
                placeholder={t.emailPlaceholder}
                required
                autoComplete="email"
                autoFocus
                error={emailErr ?? undefined}
              />

              <button
                type="submit"
                disabled={loading}
                className="btn-ob"
                style={{ marginTop: 4 }}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner"
                      style={{
                        width: 16, height: 16, borderWidth: 2,
                        borderTopColor: "var(--bg)",
                        borderColor: "rgba(0,0,0,.25)",
                        display: "inline-block", verticalAlign: "middle",
                        marginRight: 8,
                      }}
                    />
                    {t.sending}
                  </>
                ) : t.submit}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 16 }}>
          {t.rememberPrompt}{" "}
          <Link
            href="/auth/login"
            style={{ color: "var(--gold)", textDecoration: "none", fontWeight: 500 }}
          >
            {t.loginLink}
          </Link>
        </p>
      </div>
    </main>
  );
}

const TRANSLATIONS = {
  fr: {
    title:           "Mot de passe oublié",
    subtitle:        "Indique l'adresse associée à ton compte. Si elle est connue, on t'envoie un lien pour choisir un nouveau mot de passe.",
    emailLabel:      "Email",
    emailPlaceholder: "vous@exemple.fr",
    emailRequired:   "Email requis",
    emailInvalid:    "Format d'email invalide",
    submit:          "Envoyer le lien",
    sending:         "Envoi…",
    sentTitle:       "Si un compte existe, un email est en route.",
    sentBody:        "Vérifie ta boîte de réception (et tes spams). Le lien est valide 1 heure.",
    backToLogin:     "Retour à la connexion",
    rememberPrompt:  "Tu te souviens de ton mot de passe ?",
    loginLink:       "Se connecter",
  },
  en: {
    title:           "Forgot your password",
    subtitle:        "Enter the address linked to your account. If we know it, we'll send a link to choose a new password.",
    emailLabel:      "Email",
    emailPlaceholder: "you@example.com",
    emailRequired:   "Email required",
    emailInvalid:    "Invalid email format",
    submit:          "Send reset link",
    sending:         "Sending…",
    sentTitle:       "If an account exists, an email is on its way.",
    sentBody:        "Check your inbox (and spam folder). The link is valid for 1 hour.",
    backToLogin:     "Back to sign in",
    rememberPrompt:  "Remember your password?",
    loginLink:       "Sign in",
  },
} as const;

// AUTH-PASSWORD-RECOVERY-V1 applied

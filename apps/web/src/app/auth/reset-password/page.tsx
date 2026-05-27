// ============================================================
// apps/web/src/app/auth/reset-password/page.tsx
// AUTH-PASSWORD-RECOVERY-V1
// ------------------------------------------------------------
// Page d'atterrissage du lien envoyé par email :
//   /auth/reset-password?token=<raw>
// → POST /auth/reset-password { token, password }
// → affiche état (formulaire, succès, token manquant, erreur)
//
// Toutes les sessions sont révoquées côté backend après reset.
// Sur succès, on incite l'utilisateur à se reconnecter.
//
// Style « Céleste » aligné sur /auth/login & /auth/verify-email.
// ============================================================

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { useApp } from "@/lib/i18n";
import { AuthStarfield } from "@/components/auth/AuthStarfield";
import { InputField } from "@/components/ui/InputField";
import { passwordStrength } from "@/components/auth/auth-utils";

type FormState =
  | { status: "form" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "missing-token" }
  | { status: "invalid"; message: string };

function ResetPasswordInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { locale } = useApp();
  const fr = locale !== "en";
  const t = TRANSLATIONS[fr ? "fr" : "en"];

  const token = params.get("token");
  const [password, setPassword]     = useState("");
  const [confirm,  setConfirm]      = useState("");
  const [errors,   setErrors]       = useState<{ password?: string; confirm?: string }>({});
  const [global,   setGlobal]       = useState<string | null>(null);
  const [state, setState] = useState<FormState>(
    token ? { status: "form" } : { status: "missing-token" },
  );

  const strength = passwordStrength(password);

  const validate = (): boolean => {
    const next: { password?: string; confirm?: string } = {};
    if (!password)                next.password = t.passwordRequired;
    else if (password.length < 8) next.password = t.passwordTooShort;
    if (!confirm)                 next.confirm = t.confirmRequired;
    else if (confirm !== password) next.confirm = t.confirmMismatch;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobal(null);
    if (!token || !validate()) return;

    setState({ status: "submitting" });
    try {
      await apiClient.post("/auth/reset-password", { token, password });
      setState({ status: "success" });
    } catch (err: unknown) {
      const e2 = err as { code?: string; message?: string };
      if (e2.code === "INVALID_OR_EXPIRED_TOKEN" || e2.code === "INVALID_TOKEN") {
        setState({ status: "invalid", message: t.invalidBody });
      } else if (e2.code === "PASSWORD_TOO_SHORT") {
        setErrors({ password: t.passwordTooShort });
        setState({ status: "form" });
      } else {
        setGlobal(e2.message ?? t.genericError);
        setState({ status: "form" });
      }
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
            ✦
          </div>
          <h1 style={{
            fontFamily: "Georgia, serif",
            fontSize: 28,
            fontWeight: 400,
            color: "var(--star)",
            letterSpacing: "0.04em",
            lineHeight: 1.15,
            margin: 0,
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
          {state.status === "missing-token" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={headingStyle}>{t.missingTitle}</h2>
              <p style={bodyStyle}>{t.missingBody}</p>
              <Link href="/auth/forgot-password" className="btn-ob" style={inlineBtnStyle}>
                {t.requestNew}
              </Link>
            </div>
          )}

          {state.status === "invalid" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={headingStyle}>{t.invalidTitle}</h2>
              <p style={bodyStyle}>{state.message}</p>
              <Link href="/auth/forgot-password" className="btn-ob" style={inlineBtnStyle}>
                {t.requestNew}
              </Link>
            </div>
          )}

          {state.status === "success" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, color: "var(--gold)", marginBottom: 8 }}>✨</div>
              <h2 style={headingStyle}>{t.successTitle}</h2>
              <p style={bodyStyle}>{t.successBody}</p>
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="btn-ob"
                style={{ ...inlineBtnStyle, border: "none" }}
              >
                {t.toLogin}
              </button>
            </div>
          )}

          {(state.status === "form" || state.status === "submitting") && (
            <>
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

              <form
                onSubmit={handleSubmit}
                noValidate
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div>
                  <InputField
                    label={t.newPasswordLabel}
                    type="password"
                    value={password}
                    onChange={(v) => {
                      setPassword(v);
                      if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                    }}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    autoFocus
                    error={errors.password}
                  />
                  {password && (
                    <div style={{ marginTop: 6, fontSize: 12, color: strength.color }}>
                      {t.strength}: {strength.label}
                    </div>
                  )}
                </div>

                <InputField
                  label={t.confirmLabel}
                  type="password"
                  value={confirm}
                  onChange={(v) => {
                    setConfirm(v);
                    if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
                  }}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  error={errors.confirm}
                />

                {global && (
                  <div className="alert-banner" role="alert" aria-live="polite">
                    <span className="ab-ico">⚠</span>
                    <span>{global}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={state.status === "submitting"}
                  className="btn-ob"
                  style={{ marginTop: 4 }}
                >
                  {state.status === "submitting" ? (
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
                      {t.submitting}
                    </>
                  ) : t.submit}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--bg)" }} />}>
      <ResetPasswordInner />
    </Suspense>
  );
}

const headingStyle = {
  fontFamily: "Georgia, serif",
  fontSize:   22,
  fontWeight: 400,
  color:      "var(--gold)",
  letterSpacing: "0.04em",
  margin:     "0 0 12px",
} as const;

const bodyStyle = {
  fontSize:   14,
  lineHeight: 1.6,
  color:      "var(--star)",
  margin:     "0 0 18px",
} as const;

const inlineBtnStyle = {
  display:        "inline-block",
  padding:        "10px 22px",
  fontSize:       13,
  fontWeight:     600,
  marginTop:      8,
  textDecoration: "none",
  width:          "auto",
} as const;

const TRANSLATIONS = {
  fr: {
    title:            "Nouveau mot de passe",
    subtitle:         "Choisis un mot de passe d'au moins 8 caractères. Toutes tes sessions ouvertes seront déconnectées.",
    newPasswordLabel: "Nouveau mot de passe",
    confirmLabel:     "Confirme le mot de passe",
    strength:         "Force",
    submit:           "Réinitialiser",
    submitting:       "Mise à jour…",
    passwordRequired: "Mot de passe requis",
    passwordTooShort: "8 caractères minimum",
    confirmRequired:  "Confirmation requise",
    confirmMismatch:  "Les mots de passe ne correspondent pas",
    genericError:     "Une erreur est survenue. Réessaie.",
    successTitle:     "Mot de passe mis à jour ✦",
    successBody:      "Tu peux maintenant te reconnecter avec ton nouveau mot de passe.",
    toLogin:          "Aller à la connexion",
    missingTitle:     "Lien incomplet",
    missingBody:      "Ce lien n'a pas l'air d'être complet. Demande un nouveau lien depuis « Mot de passe oublié ».",
    invalidTitle:     "Lien invalide ou expiré",
    invalidBody:      "Ce lien n'est plus valide. Demande-en un nouveau pour réinitialiser ton mot de passe.",
    requestNew:       "Demander un nouveau lien",
  },
  en: {
    title:            "New password",
    subtitle:         "Choose a password of at least 8 characters. All your open sessions will be signed out.",
    newPasswordLabel: "New password",
    confirmLabel:     "Confirm password",
    strength:         "Strength",
    submit:           "Reset password",
    submitting:       "Updating…",
    passwordRequired: "Password required",
    passwordTooShort: "Minimum 8 characters",
    confirmRequired:  "Confirmation required",
    confirmMismatch:  "Passwords do not match",
    genericError:     "An error occurred. Please try again.",
    successTitle:     "Password updated ✦",
    successBody:      "You can now sign in with your new password.",
    toLogin:          "Go to sign in",
    missingTitle:     "Incomplete link",
    missingBody:      "This link doesn't look complete. Request a new one from \"Forgot password\".",
    invalidTitle:     "Invalid or expired link",
    invalidBody:      "This link is no longer valid. Request a new one to reset your password.",
    requestNew:       "Request a new link",
  },
} as const;

// AUTH-PASSWORD-RECOVERY-V1 applied

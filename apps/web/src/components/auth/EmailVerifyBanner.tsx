// ============================================================
// apps/web/src/components/auth/EmailVerifyBanner.tsx
// ARCHIVE-AUTH-EMAIL-VERIFY-V1
// ------------------------------------------------------------
// Bandeau dashboard discret quand l'user n'a pas (encore) vérifié
// son email. Bouton "Renvoyer le lien" → POST /auth/resend-verification.
//
// Conditions d'affichage :
//   1) user loggué (useAuth().user)
//   2) user.emailVerified === false
//   3) Pas dismissé pour cette session (sessionStorage — on garde
//      le bandeau au prochain login pour ne pas oublier).
//
// Style aligné sur PushEnableBanner (palette « Céleste »). Aucune
// classe blacklistée par lint-forbidden-classes (input/label/glass/
// btn-primary/etc.) — uniquement inline styles + var(--*).
// ============================================================

"use client";

import { useState } from "react";
import { useApp } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiClient } from "@/lib/api/client";

const DISMISSED_KEY = "llmastro:email-verify-banner-dismissed";

type ResendState = "idle" | "sending" | "sent" | "error";

export function EmailVerifyBanner() {
  const { locale } = useApp();
  const { user, accessToken } = useAuth();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [resend, setResend]       = useState<ResendState>("idle");
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);

  if (!user)              return null;
  if (user.emailVerified) return null;
  if (dismissed)          return null;

  const lang = locale === "en" ? "en" : "fr";
  const t = TRANSLATIONS[lang];

  async function handleResend() {
    if (resend === "sending") return;
    setResend("sending");
    setErrorMsg(null);
    try {
      await apiClient.post("/auth/resend-verification", {}, accessToken ?? undefined);
      setResend("sent");
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      // Rate-limit Fastify renvoie 429 → message générique côté front.
      const friendly = e.code === "FST_ERR_RATE_LIMIT_REACHED"
        ? t.rateLimitedBody
        : (e.message ?? t.errorBody);
      setErrorMsg(friendly);
      setResend("error");
    }
  }

  function handleDismiss() {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore — la bannière reviendra au prochain mount
    }
    setDismissed(true);
  }

  return (
    <aside
      role="region"
      aria-label={t.aria}
      style={{
        position:     "relative",
        margin:       "12px 16px 0",
        padding:      "12px 14px 12px 16px",
        borderRadius: 12,
        background:   "var(--card-bg)",
        border:       "1px solid var(--card-border)",
        boxShadow:    "var(--shadow-soft)",
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        fontSize:     13,
        color:        "var(--star)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          flexShrink:   0,
          width:        32,
          height:       32,
          borderRadius: "50%",
          background:   "radial-gradient(circle, var(--glow-violet) 0%, transparent 70%)",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          color:        "var(--gold)",
          fontSize:     18,
          lineHeight:   1,
        }}
      >
        ✉
      </div>

      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        <div style={{ fontWeight: 500 }}>
          {resend === "sent" ? t.sentTitle : t.title}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
          {resend === "sent" ? t.sentBody.replace("{email}", user.email) : t.body}
        </div>
        {resend === "error" && errorMsg && (
          <div style={{ color: "var(--tension)", fontSize: 11, marginTop: 4 }}>
            {errorMsg}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {resend !== "sent" && (
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resend === "sending"}
            style={{
              background:   "var(--gold)",
              color:        "var(--bg-2)",
              border:       "1px solid var(--gold)",
              borderRadius: 999,
              padding:      "5px 12px",
              fontSize:     12,
              fontWeight:   600,
              cursor:       resend === "sending" ? "default" : "pointer",
              opacity:      resend === "sending" ? 0.6 : 1,
              whiteSpace:   "nowrap",
            }}
          >
            {resend === "sending" ? t.sending : t.resend}
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t.dismissAria}
          style={{
            background:   "transparent",
            color:        "var(--muted)",
            border:       "1px solid var(--border-soft)",
            borderRadius: 999,
            padding:      "5px 10px",
            fontSize:     12,
            cursor:       "pointer",
            whiteSpace:   "nowrap",
          }}
        >
          {t.dismiss}
        </button>
      </div>
    </aside>
  );
}

const TRANSLATIONS = {
  fr: {
    aria:        "Vérifier votre adresse email",
    title:       "Confirme ton email pour activer ton compte",
    body:        "On t'a envoyé un lien à ton adresse. Pense à vérifier les spams.",
    resend:      "Renvoyer le lien",
    sending:     "Envoi…",
    sentTitle:   "Lien renvoyé ✦",
    sentBody:    "Un nouveau lien vient d'être envoyé à {email}.",
    rateLimitedBody: "Trop de tentatives. Réessaie dans une heure.",
    errorBody:   "Envoi impossible pour le moment.",
    dismiss:     "Plus tard",
    dismissAria: "Masquer cette bannière",
  },
  en: {
    aria:        "Verify your email address",
    title:       "Confirm your email to activate your account",
    body:        "We sent a link to your address. Don't forget to check your spam folder.",
    resend:      "Resend link",
    sending:     "Sending…",
    sentTitle:   "Link sent ✦",
    sentBody:    "A new link has just been sent to {email}.",
    rateLimitedBody: "Too many attempts. Please try again in an hour.",
    errorBody:   "Unable to send right now.",
    dismiss:     "Later",
    dismissAria: "Dismiss this banner",
  },
} as const;

// ARCHIVE-AUTH-EMAIL-VERIFY-V1 applied

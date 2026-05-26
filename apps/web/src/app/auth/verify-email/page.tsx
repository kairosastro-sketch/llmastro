// ============================================================
// apps/web/src/app/auth/verify-email/page.tsx
// ARCHIVE-AUTH-EMAIL-VERIFY-V1
// ------------------------------------------------------------
// Page d'atterrissage du lien envoyé par email :
//   /auth/verify-email?token=<raw>
// → POST /auth/verify-email { token } côté API
// → affiche état (succès, déjà vérifié, expiré, invalide)
//
// Client component : on lit le query param et on lance le POST
// au mount. Pas besoin d'être loggué pour cliquer le lien (le
// token est l'auth). Si l'user est loggué dans cet onglet,
// useAuth().refreshTiers() rafraîchit son emailVerified pour
// que le bandeau dashboard disparaisse sans relog.
//
// Style « Céleste » aligné sur les autres pages /auth/* :
// starfield + card centrée, ton soft mystique.
// ============================================================

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { useApp } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/AuthContext";
import { AuthStarfield } from "@/components/auth/AuthStarfield";

type VerifyState =
  | { status: "loading" }
  | { status: "success"; alreadyVerified: boolean }
  | { status: "missing-token" }
  | { status: "invalid"; message: string };

function VerifyEmailInner() {
  const params = useSearchParams();
  const { locale } = useApp();
  const { accessToken, refreshTiers } = useAuth();
  const [state, setState] = useState<VerifyState>({ status: "loading" });
  // Garde anti double-exec : Strict Mode en dev remonte 2× le useEffect,
  // ce qui ferait 2 POST et consommerait un token déjà consommé au 2e
  // (le service est idempotent côté DB, mais on évite l'erreur 400
  // dans l'UI).
  const consumedRef = useRef(false);

  const t = TRANSLATIONS[locale === "en" ? "en" : "fr"];

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState({ status: "missing-token" });
      return;
    }
    if (consumedRef.current) return;
    consumedRef.current = true;

    (async () => {
      try {
        const res = await apiClient.post<{ userId: string; alreadyVerified: boolean }>(
          "/auth/verify-email",
          { token },
        );
        const data = (res as { success: true; data: { userId: string; alreadyVerified: boolean } }).data;
        setState({ status: "success", alreadyVerified: data.alreadyVerified });

        // Si l'user est loggué dans cet onglet, refresh /auth/me pour
        // que `user.emailVerified` passe à true → le bandeau dashboard
        // disparaît tout seul.
        if (accessToken) {
          void refreshTiers();
        }
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        setState({ status: "invalid", message: e.message ?? t.invalidGeneric });
      }
    })();
  }, [params, accessToken, refreshTiers, t.invalidGeneric]);

  return (
    <main style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px",
      position: "relative",
      background: "var(--bg)",
    }}>
      <AuthStarfield count={70} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 460 }}>
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
          padding: "28px 24px",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "var(--r-lg)",
          textAlign: "center",
        }}>
          {state.status === "loading" && (
            <>
              <h2 style={headingStyle}>{t.loadingTitle}</h2>
              <p style={bodyStyle}>{t.loadingBody}</p>
            </>
          )}

          {state.status === "success" && (
            <>
              <div style={{ fontSize: 36, color: "var(--gold)", marginBottom: 8 }}>✨</div>
              <h2 style={headingStyle}>
                {state.alreadyVerified ? t.alreadyTitle : t.successTitle}
              </h2>
              <p style={bodyStyle}>
                {state.alreadyVerified ? t.alreadyBody : t.successBody}
              </p>
              <Link href="/dashboard" style={primaryLinkStyle}>{t.toDashboard}</Link>
            </>
          )}

          {state.status === "missing-token" && (
            <>
              <h2 style={headingStyle}>{t.missingTitle}</h2>
              <p style={bodyStyle}>{t.missingBody}</p>
              <Link href="/dashboard" style={primaryLinkStyle}>{t.toDashboard}</Link>
            </>
          )}

          {state.status === "invalid" && (
            <>
              <h2 style={headingStyle}>{t.invalidTitle}</h2>
              <p style={bodyStyle}>{t.invalidBody}</p>
              <p style={{ ...bodyStyle, fontSize: 12, color: "var(--muted)" }}>{state.message}</p>
              <Link href="/dashboard" style={primaryLinkStyle}>{t.toDashboard}</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  // Suspense requis par useSearchParams en Next 14 App Router (sinon
  // build error en SSG). On affiche un placeholder minimal sans
  // starfield pour éviter le flicker.
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--bg)" }} />}>
      <VerifyEmailInner />
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

const primaryLinkStyle = {
  display:      "inline-block",
  padding:      "10px 22px",
  background:   "var(--gold)",
  color:        "var(--bg-2)",
  textDecoration: "none",
  borderRadius: 999,
  fontSize:     13,
  fontWeight:   600,
  marginTop:    8,
} as const;

const TRANSLATIONS = {
  fr: {
    loadingTitle:  "Vérification en cours…",
    loadingBody:   "On confirme ton adresse, un instant.",
    successTitle:  "Email confirmé ✦",
    successBody:   "Merci ! Ton compte est maintenant pleinement activé.",
    alreadyTitle:  "Déjà confirmé",
    alreadyBody:   "Cet email a déjà été vérifié. Tu peux continuer ton chemin.",
    missingTitle:  "Lien incomplet",
    missingBody:   "Ce lien n'a pas l'air d'être complet. Vérifie l'email que tu as reçu, ou demande un nouveau lien depuis ton tableau de bord.",
    invalidTitle:  "Lien invalide ou expiré",
    invalidBody:   "Ce lien n'est plus valide. Tu peux en demander un nouveau depuis le bandeau de ton tableau de bord.",
    invalidGeneric: "Lien invalide ou expiré.",
    toDashboard:   "Aller au tableau de bord",
  },
  en: {
    loadingTitle:  "Verifying…",
    loadingBody:   "Confirming your address, one moment.",
    successTitle:  "Email confirmed ✦",
    successBody:   "Thank you! Your account is now fully activated.",
    alreadyTitle:  "Already confirmed",
    alreadyBody:   "This email was already verified. You can continue your journey.",
    missingTitle:  "Incomplete link",
    missingBody:   "This link doesn't look complete. Check the email you received, or request a new link from your dashboard.",
    invalidTitle:  "Invalid or expired link",
    invalidBody:   "This link is no longer valid. You can request a new one from your dashboard banner.",
    invalidGeneric: "Invalid or expired link.",
    toDashboard:   "Go to dashboard",
  },
} as const;

// ARCHIVE-AUTH-EMAIL-VERIFY-V1 applied

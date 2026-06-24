"use client";

// ============================================================
// AUTH-PAGES-DESIGN-V1 — LoginForm.tsx (refonte design)
// ------------------------------------------------------------
// Logique métier inchangée par rapport à AUTH-UX-POLISH-V1 :
//   - validation onBlur, mapping erreurs FR via formatAuthError
//   - OAuth visibles mais désactivés (tooltip "Bientôt
//     disponible"), slot 403 EMAIL_NOT_VERIFIED prêt pour V2
//
// Refonte design uniquement :
//   - Suppression des classes inventées (.btn .btn-primary,
//     .alert .alert-warning) déjà fait dans V1-FIXES,
//     conservé ici (.btn-ob, .alert-banner, .ab-ico)
//   - Suppression des variables inventées (--border-faint,
//     --text-muted, --bg-void) → remplacées par les vraies
//     (--border-soft, --muted, --bg)
//   - Plus de classes mixtes "btn btn-ghost" pour les OAuth
//     (le .btn racine n'existe pas) → juste .btn-ghost
//   - Bouton OAuth = texte "Bientôt" car le hover sur un
//     bouton désactivé n'affiche pas toujours le title
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { InputField } from "@/components/ui/InputField";
import { formatAuthError, formatOAuthError, isValidEmail } from "@/components/auth/auth-utils";
import { useOAuthProviders } from "@/components/auth/useOAuthProviders"; // OAUTH-APPLE-V1

// OAUTH-GOOGLE-FACEBOOK-V1 : URL d'origine de l'API pour amorcer le flow OAuth.
// On atterrit côté browser sur /auth/google → redirect 302 vers Google, puis
// /auth/google/callback (API) → redirect vers /auth/callback?token= (web).
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const providers = useOAuthProviders(); // OAUTH-APPLE-V1 : bouton Apple si configuré

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  // [ACCOUNT-DELETE-V1] État spécial : compte programmé pour suppression
  const [deletionPending, setDeletionPending] = useState<{ expiresAt: string } | null>(null);
  const [cancelLoading, setCancelLoading]     = useState(false);
  // [OAUTH-GOOGLE-FACEBOOK-V1] erreur OAuth venant de /auth/login?oauth_error=
  const [oauthError, setOauthError]           = useState<string | null>(null);

  // OAUTH-GOOGLE-FACEBOOK-V1 : lit ?oauth_error=… au mount, l'affiche,
  // puis nettoie l'URL pour qu'un refresh ne réaffiche pas le bandeau.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("oauth_error");
    if (!code) return;
    setOauthError(formatOAuthError(code));
    const url = new URL(window.location.href);
    url.searchParams.delete("oauth_error");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // ------------------------------------------------------
  // Validation par champ
  // ------------------------------------------------------
  const validateField = (field: "email" | "password"): string => {
    if (field === "email") {
      const trimmed = email.trim();
      if (!trimmed) return "Email requis";
      if (!isValidEmail(trimmed)) return "Format d'email invalide";
      return "";
    }
    if (field === "password") {
      if (!password) return "Mot de passe requis";
      return "";
    }
    return "";
  };

  const handleBlur = (field: "email" | "password") => {
    setErrors(prev => ({ ...prev, [field]: validateField(field) }));
  };

  const validateAll = (): boolean => {
    const next = {
      email:    validateField("email"),
      password: validateField("password"),
    };
    setErrors(next);
    return !next.email && !next.password;
  };

  // ------------------------------------------------------
  // Submit
  // ------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    if (!validateAll()) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err: unknown) {
      // [ACCOUNT-DELETE-V1] Cas spécial : compte programmé pour suppression
      const e2 = err as { code?: string; details?: { expiresAt?: string } };
      if (e2.code === "ACCOUNT_DELETION_PENDING") {
        setDeletionPending({ expiresAt: e2.details?.expiresAt ?? "" });
      } else {
        setGlobalError(formatAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // [ACCOUNT-DELETE-V1] Annule la suppression : appelle /auth/cancel-deletion
  const handleCancelDeletion = async () => {
    setGlobalError(null);
    setCancelLoading(true);
    try {
      const { apiClient } = await import("@/lib/api/client");
      await apiClient.post("/auth/cancel-deletion", {
        email:    email.trim(),
        password,
      });
      // Re-login standard pour synchroniser le AuthContext
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setGlobalError(formatAuthError(err));
      setDeletionPending(null);
    } finally {
      setCancelLoading(false);
    }
  };

  // ------------------------------------------------------
  // Render
  // ------------------------------------------------------
  // OAUTH-GOOGLE-FACEBOOK-V1 : boutons actifs, ancres vers l'API qui
  // amorce le flow (state CSRF posé en cookie côté backend).
  const oauthButtonStyle: React.CSSProperties = {
    fontSize: 13,
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };

  // OAUTH-APPLE-V1 : bouton Apple noir (charte Apple : fond noir, logo + texte blancs).
  const appleButtonStyle: React.CSSProperties = {
    fontSize: 13,
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: "var(--r-md)",
    background: "#000",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 500,
    border: "1px solid #000",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Bandeau d'erreur OAuth (depuis ?oauth_error=) */}
      {oauthError && (
        <div className="alert-banner" role="alert" aria-live="polite">
          <span className="ab-ico">⚠</span>
          <span>{oauthError}</span>
        </div>
      )}

      {/* OAuth */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* OAUTH-HIDE-FACEBOOK-V1 — bouton Facebook masqué tant que l'app Meta
            n'est pas configurée (FACEBOOK_CLIENT_ID/SECRET = placeholder en prod
            → flow cassé). Google seul, en pleine largeur. Pour réactiver : remettre
            le <a> Facebook + repasser la grille en "1fr 1fr". */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <a
            href={`${API_BASE}/auth/google`}
            className="btn-ghost"
            style={oauthButtonStyle}
            aria-label="Se connecter avec Google"
          >
            <GoogleIcon /> Google
          </a>
          {/* OAUTH-APPLE-V1 : visible seulement si le backend a les secrets Apple */}
          {providers.apple && (
            <a
              href={`${API_BASE}/auth/apple`}
              style={appleButtonStyle}
              aria-label="Se connecter avec Apple"
            >
              <AppleIcon /> Continuer avec Apple
            </a>
          )}
        </div>
        <p style={{
          fontSize: 11,
          color: "var(--muted-2)",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.5,
        }}>
          En continuant, tu acceptes nos{" "}
          <Link href="/cgu" style={{ color: "var(--muted)", textDecoration: "underline" }}>
            CGU
          </Link>{" "}
          et notre{" "}
          <Link href="/confidentialite" style={{ color: "var(--muted)", textDecoration: "underline" }}>
            politique de confidentialité
          </Link>
          .
        </p>
      </div>

      {/* Séparateur */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
        <span style={{
          fontSize: 11,
          color: "var(--muted-2)",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}>
          ou
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
      </div>

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <InputField
          label="Email"
          type="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (errors["email"]) setErrors(p => ({ ...p, email: "" }));
          }}
          onBlur={() => handleBlur("email")}
          placeholder="marie@exemple.fr"
          required
          autoComplete="email"
          autoFocus
          error={errors["email"] || undefined}
        />
        <div>
          <InputField
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (errors["password"]) setErrors(p => ({ ...p, password: "" }));
            }}
            onBlur={() => handleBlur("password")}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            error={errors["password"] || undefined}
          />
          {/* AUTH-PASSWORD-RECOVERY-V1 : lien discret aligné à droite */}
          <div style={{ textAlign: "right", marginTop: 6 }}>
            <Link
              href="/auth/forgot-password"
              style={{
                fontSize: 12,
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        {deletionPending && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              padding: "14px 16px",
              borderRadius: "var(--r-md)",
              background: "rgba(229, 69, 69, .08)",
              border: "1px solid rgba(229, 69, 69, .25)",
              color: "var(--star)",
              fontSize: 13,
              lineHeight: 1.55,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{ flexShrink: 0 }}>⚠</span>
              <div>
                <strong>Compte programmé pour suppression</strong>
                {deletionPending.expiresAt && (
                  <div style={{ marginTop: 4, color: "var(--muted)" }}>
                    Effacement définitif le{" "}
                    {new Date(deletionPending.expiresAt).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "long", year: "numeric",
                    })}.
                  </div>
                )}
                <div style={{ marginTop: 6, color: "var(--muted)" }}>
                  Tu peux annuler la suppression et te reconnecter.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleCancelDeletion}
                disabled={cancelLoading}
                className="btn-ob"
                style={{ fontSize: 13, padding: "8px 16px", width: "auto" }}
              >
                {cancelLoading ? "Annulation…" : "Annuler la suppression"}
              </button>
              <button
                type="button"
                onClick={() => setDeletionPending(null)}
                disabled={cancelLoading}
                className="btn-ghost"
                style={{ fontSize: 13, padding: "8px 16px", width: "auto" }}
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {globalError && (
          <div className="alert-banner" role="alert" aria-live="polite">
            <span className="ab-ico">⚠</span>
            <span>{globalError}</span>
          </div>
        )}

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
                  width: 16,
                  height: 16,
                  borderWidth: 2,
                  borderTopColor: "var(--bg)",
                  borderColor: "rgba(0,0,0,.25)",
                  display: "inline-block",
                  verticalAlign: "middle",
                  marginRight: 8,
                }}
              />
              Connexion…
            </>
          ) : "Se connecter"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", margin: 0 }}>
        Pas encore de compte ?{" "}
        <Link href="/auth/register" style={{ color: "var(--gold)", textDecoration: "none", fontWeight: 500 }}>
          Créer un compte
        </Link>
      </p>
    </div>
  );
}

// ----------------------------------------------------------
// Icons OAuth
// ----------------------------------------------------------
function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ marginRight: 4, verticalAlign: "middle" }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// OAUTH-APPLE-V1 : logo Apple monochrome (blanc sur fond noir).
function AppleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M17.05 12.53c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.79-3.33.79-.69 0-1.74-.77-2.86-.75-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.14.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5zM14.87 6.2c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.69-.92 2.69.97.08 1.97-.49 2.58-1.22z"/>
    </svg>
  );
}

// AUTH-UX-POLISH-V1 applied
// AUTH-UX-POLISH-V1-FIXES applied
// AUTH-PAGES-DESIGN-V1 applied
// ACCOUNT-DELETE-V1 applied
// OAUTH-GOOGLE-FACEBOOK-V1 applied
// OAUTH-APPLE-V1 applied

// AUTH-PASSWORD-RECOVERY-V1 applied
// OAUTH-HIDE-FACEBOOK-V1 applied

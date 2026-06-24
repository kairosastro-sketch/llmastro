"use client";

// ============================================================
// AUTH-PAGES-DESIGN-V1 — RegisterForm.tsx (refonte design)
// ------------------------------------------------------------
// Logique métier inchangée par rapport à AUTH-UX-POLISH-V1 :
//   - validation onBlur, mapping erreurs FR, password strength
//   - checkbox CGU obligatoire avec liens /cgu et
//     /confidentialite, détection timezone, slot post-register
//
// Refonte design uniquement :
//   - Tokens et classes corrects (cf. LoginForm pour détails)
//   - La checkbox CGU est maintenant juste un <input
//     type="checkbox"> standard. Tout le styling (remplissage
//     or massif quand cochée + ✓ contrasté) vient du CSS posé
//     par le patch globals-css de cette archive.
//     L'inline style accentColor de l'archive précédente est
//     retiré (devenu redondant et conflictuel).
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiClient } from "@/lib/api/client";
import { InputField } from "@/components/ui/InputField";
import {
  formatAuthError,
  isValidEmail,
  passwordStrength,
  detectClientTimezone,
} from "@/components/auth/auth-utils";

// OAUTH-GOOGLE-FACEBOOK-V1 : URL d'origine de l'API pour amorcer le flow OAuth.
// Côté inscription, le backend route le retour vers /auth/callback?token=
// quelle que soit la page de départ — cohérent avec /auth/login.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface RegisterPayload {
  email:     string;
  password:  string;
  name:      string;
  timezone?: string;
}

export function RegisterForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [acceptCgu,   setAcceptCgu]   = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  // ------------------------------------------------------
  // Validation par champ
  // ------------------------------------------------------
  const validateField = (
    field: "name" | "email" | "password" | "confirm" | "cgu"
  ): string => {
    switch (field) {
      case "name": {
        const trimmed = name.trim();
        if (!trimmed) return "Prénom ou pseudo requis";
        if (trimmed.length > 100) return "Prénom ou pseudo trop long (max 100 caractères)";
        return "";
      }
      case "email": {
        const trimmed = email.trim();
        if (!trimmed) return "Email requis";
        if (!isValidEmail(trimmed)) return "Format d'email invalide";
        return "";
      }
      case "password": {
        if (!password) return "Mot de passe requis";
        if (password.length < 8) return "8 caractères minimum";
        return "";
      }
      case "confirm": {
        if (!confirm) return "Confirmation requise";
        if (password !== confirm) return "Les mots de passe ne correspondent pas";
        return "";
      }
      case "cgu": {
        if (!acceptCgu) return "Tu dois accepter les conditions d'utilisation";
        return "";
      }
      default:
        return "";
    }
  };

  const handleBlur = (field: "name" | "email" | "password" | "confirm") => {
    setErrors(prev => ({ ...prev, [field]: validateField(field) }));
  };

  const validateAll = (): boolean => {
    const next: Record<string, string> = {
      name:     validateField("name"),
      email:    validateField("email"),
      password: validateField("password"),
      confirm:  validateField("confirm"),
      cgu:      validateField("cgu"),
    };
    setErrors(next);
    return Object.values(next).every(v => !v);
  };

  // ------------------------------------------------------
  // Mutation register
  // ------------------------------------------------------
  const mutation = useMutation({
    mutationFn: async (data: RegisterPayload) => {
      return apiClient.post("/auth/register", data);
    },
    retry: false,
    onSuccess: async () => {
      await handleRegisterSuccess();
    },
  });

  // ------------------------------------------------------
  // Slot post-register — sera modifié par AUTH-EMAIL-VERIFY-V1
  // pour rediriger vers /auth/verify-pending au lieu de
  // l'auto-login + /dashboard/natal.
  // ------------------------------------------------------
  const handleRegisterSuccess = async (): Promise<void> => {
    await login(email.trim(), password);
    router.push("/dashboard/natal");
  };

  // ------------------------------------------------------
  // Submit
  // ------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    mutation.mutate({
      email:    email.trim(),
      password,
      name:     name.trim(),
      timezone: detectClientTimezone(),
    });
  };

  // ------------------------------------------------------
  // Force password
  // ------------------------------------------------------
  const strength = passwordStrength(password);

  // ------------------------------------------------------
  // Render
  // ------------------------------------------------------
  // OAUTH-GOOGLE-FACEBOOK-V1 : boutons actifs en <a>. La mention CGU
  // sous le bloc OAuth est légalement nécessaire car le flow OAuth
  // bypass la checkbox CGU du formulaire email/password ci-dessous.
  const oauthButtonStyle: React.CSSProperties = {
    fontSize: 13,
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            aria-label="S'inscrire avec Google"
          >
            <GoogleIcon /> Google
          </a>
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
          label="Prénom ou pseudo"
          value={name}
          onChange={(v) => {
            setName(v);
            if (errors["name"]) setErrors(p => ({ ...p, name: "" }));
          }}
          onBlur={() => handleBlur("name")}
          placeholder="Marie"
          required
          autoComplete="name"
          autoFocus
          error={errors["name"] || undefined}
        />
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
          error={errors["email"] || undefined}
        />

        {/* Bloc password + indicateur de force */}
        <div>
          <InputField
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (errors["password"]) setErrors(p => ({ ...p, password: "" }));
              // Re-valide confirm en parallèle si besoin
              if (errors["confirm"] && confirm) {
                setErrors(p => ({
                  ...p,
                  confirm: v === confirm ? "" : "Les mots de passe ne correspondent pas",
                }));
              }
            }}
            onBlur={() => handleBlur("password")}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            error={errors["password"] || undefined}
            hint={errors["password"] ? undefined : "8 caractères minimum"}
          />
          {password && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <div
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: 4,
                  background: "var(--border-soft)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(strength.score / 4) * 100}%`,
                    background: strength.color,
                    transition: "width .25s ease, background .25s ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: strength.color,
                  minWidth: 70,
                  textAlign: "right",
                }}
                aria-live="polite"
              >
                {strength.label}
              </span>
            </div>
          )}
        </div>

        <InputField
          label="Confirmer le mot de passe"
          type="password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            if (errors["confirm"]) setErrors(p => ({ ...p, confirm: "" }));
          }}
          onBlur={() => handleBlur("confirm")}
          placeholder="••••••••"
          required
          autoComplete="new-password"
          error={errors["confirm"] || undefined}
        />

        {/* Checkbox CGU + Confidentialité — styling vient du CSS global patché */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 13,
            color: "var(--muted)",
            cursor: "pointer",
            lineHeight: 1.5,
          }}>
            <input
              type="checkbox"
              checked={acceptCgu}
              onChange={(e) => {
                setAcceptCgu(e.target.checked);
                if (errors["cgu"]) setErrors(p => ({ ...p, cgu: "" }));
              }}
              aria-invalid={!!errors["cgu"]}
              aria-describedby={errors["cgu"] ? "cgu-err" : undefined}
              style={{ marginTop: 1 }}
            />
            <span>
              J'accepte les{" "}
              <Link
                href="/cgu"
                target="_blank"
                style={{ color: "var(--gold)", textDecoration: "underline" }}
              >
                conditions d'utilisation
              </Link>{" "}
              et la{" "}
              <Link
                href="/confidentialite"
                target="_blank"
                style={{ color: "var(--gold)", textDecoration: "underline" }}
              >
                politique de confidentialité
              </Link>
              .
            </span>
          </label>
          {errors["cgu"] && (
            <p
              id="cgu-err"
              role="alert"
              style={{
                marginLeft: 28,
                color: "var(--tension)",
                fontSize: 11,
                margin: "4px 0 0 28px",
              }}
            >
              {errors["cgu"]}
            </p>
          )}
        </div>

        {/* Erreur globale */}
        {mutation.isError && (
          <div className="alert-banner" role="alert" aria-live="polite">
            <span className="ab-ico">⚠</span>
            <span>{formatAuthError(mutation.error)}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-ob"
          style={{ marginTop: 4 }}
        >
          {mutation.isPending ? (
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
              Création…
            </>
          ) : "Créer mon compte"}
        </button>
      </form>
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

// AUTH-UX-POLISH-V1 applied
// AUTH-UX-POLISH-V1-FIXES applied
// AUTH-PAGES-DESIGN-V1 applied
// OAUTH-GOOGLE-FACEBOOK-V1 applied
// OAUTH-HIDE-FACEBOOK-V1 applied

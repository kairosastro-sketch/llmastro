"use client";

// ============================================================
// ACCOUNT-PAGE-V1 — /dashboard/account/page.tsx
// ------------------------------------------------------------
// Page "Mon compte" : affiche email, nom modifiable, plan,
// préférences (langue/thème), et bouton de déconnexion bien
// visible. Pas de suppression de compte ici (archive future).
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/i18n";
import { apiClient, natalApi, subscriptionsApi } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toaster";  // TOASTER-WIRING-V1
import { InputField } from "@/components/ui/InputField";
import { passwordStrength } from "@/components/auth/auth-utils";

export default function AccountPage() {
  const { user, plan, accessToken, logout, refresh } = useAuth();
  const { theme, setTheme, locale, setLocale } = useApp();
  const router = useRouter();

  const fr = locale === "fr";
  const { toast } = useToast();  // TOASTER-WIRING-V1

  // ─── State : édition du nom ────────────────────────────
  const [editingName, setEditingName] = useState<boolean>(false);
  const [nameDraft, setNameDraft]     = useState<string>(user?.name ?? "");
  const [saving, setSaving]           = useState<boolean>(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [savedFlash, setSavedFlash]   = useState<boolean>(false);

  // [ACCOUNT-DELETE-V1] State pour la modal de suppression
  const [showDeleteModal, setShowDeleteModal]   = useState<boolean>(false);
  const [deleteEmailDraft, setDeleteEmailDraft] = useState<string>("");
  const [deleteLoading, setDeleteLoading]       = useState<boolean>(false);
  const [deleteError, setDeleteError]           = useState<string | null>(null);

  // [AUTH-PASSWORD-RECOVERY-V1] State pour la modal de changement de mdp
  const [showPwdModal, setShowPwdModal]   = useState<boolean>(false);
  const [pwdCurrent,   setPwdCurrent]     = useState<string>("");
  const [pwdNew,       setPwdNew]         = useState<string>("");
  const [pwdConfirm,   setPwdConfirm]     = useState<string>("");
  const [pwdErrors,    setPwdErrors]      = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [pwdGlobal,    setPwdGlobal]      = useState<string | null>(null);
  const [pwdLoading,   setPwdLoading]     = useState<boolean>(false);

  const startEditName = () => {
    setNameDraft(user?.name ?? "");
    setSaveError(null);
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setSaveError(null);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setSaveError(fr ? "Le nom ne peut pas être vide" : "Name cannot be empty");
      return;
    }
    if (trimmed.length > 100) {
      setSaveError(fr ? "Nom trop long (max 100 caractères)" : "Name too long (max 100 characters)");
      return;
    }
    if (trimmed === user?.name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await apiClient.patch<{ user: typeof user }>("/auth/me", { name: trimmed }, accessToken!);
      await refresh();
      setEditingName(false);
      // TOASTER-WIRING-V1 : feedback via toast plutôt que savedFlash inline
      toast(fr ? "Nom mis à jour" : "Name updated", "success");
    } catch (err: unknown) {
      const e = err as { message?: string };
      const msg = e?.message ?? (fr ? "Erreur lors de la sauvegarde" : "Save error");
      setSaveError(msg);
      // TOASTER-WIRING-V1 : toast d'erreur visible même si l'inline est aussi affiché
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  // [AUTH-PASSWORD-RECOVERY-V1] Changement de mot de passe
  const isLocalAccount = user?.provider === "local" || user?.provider == null;

  const openPwdModal = () => {
    setPwdCurrent("");
    setPwdNew("");
    setPwdConfirm("");
    setPwdErrors({});
    setPwdGlobal(null);
    setShowPwdModal(true);
  };

  const closePwdModal = () => {
    if (pwdLoading) return;
    setShowPwdModal(false);
    setPwdGlobal(null);
  };

  const validatePwd = (): boolean => {
    const next: { current?: string; next?: string; confirm?: string } = {};
    if (!pwdCurrent) next.current = fr ? "Mot de passe actuel requis" : "Current password required";
    if (!pwdNew)                       next.next = fr ? "Nouveau mot de passe requis" : "New password required";
    else if (pwdNew.length < 8)        next.next = fr ? "8 caractères minimum" : "Minimum 8 characters";
    else if (pwdNew === pwdCurrent)    next.next = fr ? "Le nouveau doit être différent de l'actuel" : "Must differ from current";
    if (!pwdConfirm)                   next.confirm = fr ? "Confirmation requise" : "Confirmation required";
    else if (pwdConfirm !== pwdNew)    next.confirm = fr ? "Les mots de passe ne correspondent pas" : "Passwords do not match";
    setPwdErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitPwd = async () => {
    setPwdGlobal(null);
    if (!validatePwd()) return;
    setPwdLoading(true);
    try {
      await apiClient.post(
        "/auth/change-password",
        { currentPassword: pwdCurrent, newPassword: pwdNew },
        accessToken!,
      );
      setShowPwdModal(false);
      toast(fr ? "Mot de passe mis à jour" : "Password updated", "success");
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "INVALID_CURRENT_PASSWORD") {
        setPwdErrors((p) => ({ ...p, current: fr ? "Mot de passe actuel incorrect" : "Current password incorrect" }));
      } else if (e.code === "PASSWORD_UNCHANGED") {
        setPwdErrors((p) => ({ ...p, next: fr ? "Le nouveau doit être différent de l'actuel" : "Must differ from current" }));
      } else if (e.code === "PASSWORD_TOO_SHORT") {
        setPwdErrors((p) => ({ ...p, next: fr ? "8 caractères minimum" : "Minimum 8 characters" }));
      } else {
        setPwdGlobal(e.message ?? (fr ? "Erreur lors du changement" : "Change failed"));
      }
    } finally {
      setPwdLoading(false);
    }
  };

  // [ACCOUNT-DELETE-V1] Suppression de compte avec confirmation par email
  const openDeleteModal = () => {
    setDeleteEmailDraft("");
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setShowDeleteModal(false);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!user?.email) return;
    if (deleteEmailDraft.trim().toLowerCase() !== user.email.toLowerCase()) {
      setDeleteError(fr ? "L'email ne correspond pas" : "Email does not match");
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      // [ACCOUNT-DELETE-V1-FIX-V1] Body { confirmEmail } requis par le backend.
      // Token passé en 3e arg (signature étendue de apiClient.delete).
      await apiClient.delete(
        "/auth/me",
        { confirmEmail: deleteEmailDraft.trim() },
        accessToken!
      );
      await logout();
      router.push("/");
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setDeleteError(
        e.code === "EMAIL_MISMATCH"
          ? (fr ? "L'email ne correspond pas" : "Email does not match")
          : e.message ?? (fr ? "Erreur lors de la suppression" : "Delete error")
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="page-root" style={{ maxWidth: 720, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "Georgia, serif",
          fontSize: 28,
          fontWeight: 400,
          color: "var(--star)",
          margin: "0 0 4px",
        }}>
          {fr ? "Mon compte" : "My account"}
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          {fr ? "Gère tes informations personnelles et préférences." : "Manage your personal information and preferences."}
        </p>
      </header>

      {/* ───── INFORMATIONS PERSONNELLES ───── */}
      <Section title={fr ? "Informations personnelles" : "Personal information"}>
        <Field label="Email">
          <div style={{ fontSize: 14, color: "var(--star)", padding: "8px 0" }}>
            {user?.email ?? "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>
            {fr ? "L'email ne peut pas être modifié pour le moment." : "Email cannot be changed at this time."}
          </div>
        </Field>

        <Field label={fr ? "Nom" : "Name"}>
          {!editingName ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 14, color: "var(--star)", flex: 1 }}>
                {user?.name ?? "—"}
                {/* TOASTER-WIRING-V1 : feedback "Enregistré" via toast (cf. saveName) */}
              </div>
              <button
                type="button"
                onClick={startEditName}
                className="btn-ghost"
                style={{ fontSize: 12, padding: "4px 10px" }}
              >
                {fr ? "Modifier" : "Edit"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                disabled={saving}
                autoFocus
                maxLength={100}
                placeholder={fr ? "Ton nom" : "Your name"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") cancelEditName();
                }}
              />
              {saveError && (
                <p style={{ fontSize: 12, color: "var(--tension)", margin: 0 }}>
                  {saveError}
                </p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={saveName}
                  disabled={saving}
                  className="btn-ob"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                >
                  {saving ? (fr ? "Sauvegarde…" : "Saving…") : (fr ? "Enregistrer" : "Save")}
                </button>
                <button
                  type="button"
                  onClick={cancelEditName}
                  disabled={saving}
                  className="btn-ghost"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                >
                  {fr ? "Annuler" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </Field>

        <Field label={fr ? "Mot de passe" : "Password"}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 14, color: "var(--star)", flex: 1, fontFamily: "monospace" }}>
              {isLocalAccount ? "••••••••••" : (fr ? "Connexion via un fournisseur externe" : "Signed in via external provider")}
            </div>
            {isLocalAccount ? (
              <button
                type="button"
                onClick={openPwdModal}
                className="btn-ghost"
                style={{ fontSize: 12, padding: "4px 10px" }}
              >
                {fr ? "Modifier" : "Change"}
              </button>
            ) : (
              <Link
                href="/auth/forgot-password"
                className="btn-ghost"
                style={{ fontSize: 12, padding: "4px 10px", textDecoration: "none" }}
              >
                {fr ? "Définir" : "Set"}
              </Link>
            )}
          </div>
          {!isLocalAccount && (
            <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 6, lineHeight: 1.5 }}>
              {fr
                ? "Pour aussi te connecter par email, demande un lien sur « Mot de passe oublié »."
                : "To also sign in by email, request a link from \"Forgot password\"."}
            </div>
          )}
        </Field>
      </Section>

      {/* ───── MES PROFILS NATALS ───── */}
      <NatalProfilesSection accessToken={accessToken} fr={fr} />

      {/* ───── ABONNEMENT ───── */}
      <Section title={fr ? "Mon abonnement" : "My subscription"}>
        <Field label={fr ? "Plan" : "Plan"}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "var(--star)" }}>
                {plan?.name ?? (fr ? "Découverte" : "Free")}
              </div>
              {plan?.isTrial && plan?.currentPeriodEnd && (
                <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2 }}>
                  {fr ? "Essai gratuit · expire le " : "Free trial · expires "}
                  {new Date(plan.currentPeriodEnd).toLocaleDateString(fr ? "fr-FR" : "en-US")}
                </div>
              )}
            </div>
            {/* STRIPE-MVP-V1 : portail Stripe pour les plans payants. */}
            {plan?.code === "essential" || plan?.code === "premium" ? (
              <ManageSubscriptionButton accessToken={accessToken} fr={fr} />
            ) : null}
            <Link
              href="/pricing"
              className="btn-ghost"
              style={{ fontSize: 12, padding: "4px 10px", textDecoration: "none" }}
            >
              {fr ? "Voir les plans →" : "See plans →"}
            </Link>
          </div>
        </Field>
      </Section>

      {/* ───── PARRAINAGE [GROWTH-V1-PARRAINAGE-UI-MOBILE-V1] ─────
           Point d'entrée mobile vers /dashboard/parrainage. La sidebar
           desktop a déjà l'entrée ; ici on rend l'accès évident sur
           mobile où la bottom-nav ne peut accueillir un 7e item lisible. */}
      <Section title={fr ? "Parrainage" : "Invite"}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "var(--star)", marginBottom: 4 }}>
              {fr
                ? "Invitez vos proches, gagnez tous les deux."
                : "Invite your loved ones, both earn."}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              {fr
                ? "Code à partager, statistiques et avantages gagnés à l'activation de chaque filleul."
                : "Share your code, see your stats, and what you both earn on each activation."}
            </div>
          </div>
          <Link
            href="/dashboard/parrainage"
            style={{
              display:        "inline-flex",
              alignItems:     "center",
              padding:        "9px 16px",
              background:     "var(--violet)",
              color:          "var(--bg)",
              border:         "1px solid var(--violet)",
              borderRadius:   "var(--r-md)",
              fontSize:       13,
              textDecoration: "none",
              letterSpacing:  0.4,
            }}
          >
            {fr ? "Voir mon programme ✦" : "View my program ✦"}
          </Link>
        </div>
      </Section>

      {/* ───── PRÉFÉRENCES ───── */}
      <Section title={fr ? "Préférences" : "Preferences"}>
        <Field label={fr ? "Langue" : "Language"}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setLocale("fr")}
              className={locale === "fr" ? "btn-ob" : "btn-ghost"}
              style={{ fontSize: 13, padding: "8px 18px", width: "auto", flex: "0 0 auto" }}
            >
              Français
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={locale === "en" ? "btn-ob" : "btn-ghost"}
              style={{ fontSize: 13, padding: "8px 18px", width: "auto", flex: "0 0 auto" }}
            >
              English
            </button>
          </div>
        </Field>

        <Field label={fr ? "Thème" : "Theme"}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={theme === "dark" ? "btn-ob" : "btn-ghost"}
              style={{ fontSize: 13, padding: "8px 18px", width: "auto", flex: "0 0 auto" }}
            >
              ☾ {fr ? "Sombre" : "Dark"}
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={theme === "light" ? "btn-ob" : "btn-ghost"}
              style={{ fontSize: 13, padding: "8px 18px", width: "auto", flex: "0 0 auto" }}
            >
              ☼ {fr ? "Clair" : "Light"}
            </button>
          </div>
        </Field>
      </Section>

      {/* ───── ZONE DANGEREUSE ───── */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border-soft)" }}>
        <h2 style={{
          fontFamily: "Georgia, serif",
          fontSize: 18,
          fontWeight: 400,
          color: "var(--muted)",
          margin: "0 0 14px",
        }}>
          {fr ? "Session" : "Session"}
        </h2>
        <button
          type="button"
          onClick={handleLogout}
          className="btn-ghost"
          style={{
            fontSize: 13,
            padding: "10px 18px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span aria-hidden="true">⎋</span>
          {fr ? "Se déconnecter" : "Sign out"}
        </button>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border-soft)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--tension)", margin: "0 0 8px" }}>
            {fr ? "Zone dangereuse" : "Danger zone"}
          </h3>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, margin: "0 0 12px" }}>
            {fr
              ? "Supprimer ton compte est définitif après 30 jours. Pendant cette période de grâce, tu peux annuler la suppression en te reconnectant."
              : "Deleting your account is permanent after 30 days. During the grace period, you can cancel by signing in again."}
          </p>
          <button
            type="button"
            onClick={openDeleteModal}
            style={{
              fontSize: 13, padding: "10px 18px", width: "auto",
              background: "transparent", border: "1px solid var(--tension)",
              color: "var(--tension)", borderRadius: "var(--r-md)",
              cursor: "pointer", fontFamily: "inherit", transition: "all .18s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(229,69,69,.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            {fr ? "Supprimer mon compte" : "Delete my account"}
          </button>
        </div>

        <p style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 24, lineHeight: 1.5 }}>
          {fr
            ? "Pour toute demande RGPD ou question, écris-nous à "
            : "For any GDPR request or question, contact us at "}
          <a href="mailto:info@llmastro.com" style={{ color: "var(--gold)" }}>
            info@llmastro.com
          </a>
          .
        </p>
      </div>

      {/* [AUTH-PASSWORD-RECOVERY-V1] Modal de changement de mot de passe */}
      {showPwdModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-password-title"
          onClick={closePwdModal}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 460, width: "100%",
              background: "var(--card-bg)", border: "1px solid var(--border-mid)",
              borderRadius: "var(--r-lg)", padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,.4)",
            }}
          >
            <h2
              id="change-password-title"
              style={{
                fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 400,
                color: "var(--star)", margin: "0 0 12px",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <span aria-hidden="true" style={{ color: "var(--gold)" }}>✦</span>
              {fr ? "Changer le mot de passe" : "Change password"}
            </h2>

            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: "0 0 18px" }}>
              {fr
                ? "Saisis ton mot de passe actuel puis le nouveau (8 caractères minimum)."
                : "Enter your current password then the new one (8 characters minimum)."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InputField
                label={fr ? "Mot de passe actuel" : "Current password"}
                type="password"
                value={pwdCurrent}
                onChange={(v) => {
                  setPwdCurrent(v);
                  if (pwdErrors.current) setPwdErrors((p) => ({ ...p, current: undefined }));
                }}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                autoFocus
                error={pwdErrors.current}
              />

              <div>
                <InputField
                  label={fr ? "Nouveau mot de passe" : "New password"}
                  type="password"
                  value={pwdNew}
                  onChange={(v) => {
                    setPwdNew(v);
                    if (pwdErrors.next) setPwdErrors((p) => ({ ...p, next: undefined }));
                  }}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  error={pwdErrors.next}
                />
                {pwdNew && (
                  <div style={{ marginTop: 6, fontSize: 12, color: passwordStrength(pwdNew).color }}>
                    {fr ? "Force" : "Strength"}: {passwordStrength(pwdNew).label}
                  </div>
                )}
              </div>

              <InputField
                label={fr ? "Confirme le nouveau mot de passe" : "Confirm new password"}
                type="password"
                value={pwdConfirm}
                onChange={(v) => {
                  setPwdConfirm(v);
                  if (pwdErrors.confirm) setPwdErrors((p) => ({ ...p, confirm: undefined }));
                }}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                error={pwdErrors.confirm}
              />

              {pwdGlobal && (
                <div className="alert-banner" role="alert" aria-live="polite">
                  <span className="ab-ico">⚠</span>
                  <span>{pwdGlobal}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closePwdModal}
                disabled={pwdLoading}
                className="btn-ghost"
                style={{ fontSize: 13, padding: "10px 18px", width: "auto" }}
              >
                {fr ? "Annuler" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={submitPwd}
                disabled={pwdLoading}
                className="btn-ob"
                style={{ fontSize: 13, padding: "10px 18px", width: "auto" }}
              >
                {pwdLoading
                  ? (fr ? "Mise à jour…" : "Updating…")
                  : (fr ? "Mettre à jour" : "Update")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [ACCOUNT-DELETE-V1] Modal de confirmation suppression */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={closeDeleteModal}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 460, width: "100%",
              background: "var(--card-bg)", border: "1px solid var(--border-mid)",
              borderRadius: "var(--r-lg)", padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,.4)",
            }}
          >
            <h2
              id="delete-account-title"
              style={{
                fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 400,
                color: "var(--star)", margin: "0 0 12px",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <span aria-hidden="true" style={{ color: "var(--tension)" }}>⚠</span>
              {fr ? "Supprimer ton compte" : "Delete your account"}
            </h2>

            <p style={{ fontSize: 14, color: "var(--star)", lineHeight: 1.6, margin: "0 0 14px" }}>
              {fr
                ? "Cette action programme la suppression définitive de ton compte dans 30 jours. Pendant cette période, tu peux te reconnecter pour annuler."
                : "This will schedule permanent deletion of your account in 30 days. You can cancel by signing in during this period."}
            </p>

            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 14px" }}>
              {fr ? "Pour confirmer, tape ton email :" : "To confirm, type your email:"}
            </p>

            <div style={{
              fontSize: 13, color: "var(--gold)",
              padding: "8px 12px", background: "rgba(201,168,76,.08)",
              border: "1px solid rgba(201,168,76,.18)", borderRadius: "var(--r-sm)",
              fontFamily: "monospace", marginBottom: 10, userSelect: "all",
            }}>
              {user?.email ?? ""}
            </div>

            <input
              type="email"
              value={deleteEmailDraft}
              onChange={(e) => {
                setDeleteEmailDraft(e.target.value);
                if (deleteError) setDeleteError(null);
              }}
              disabled={deleteLoading}
              autoFocus
              placeholder={fr ? "ton@email.com" : "your@email.com"}
              autoComplete="off"
              style={{ marginBottom: 8 }}
              onKeyDown={(e) => { if (e.key === "Escape") closeDeleteModal(); }}
            />

            {deleteError && (
              <p style={{ fontSize: 12, color: "var(--tension)", margin: "0 0 12px" }}>
                {deleteError}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="btn-ghost"
                style={{ fontSize: 13, padding: "10px 18px", width: "auto" }}
              >
                {fr ? "Annuler" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading || !deleteEmailDraft}
                style={{
                  fontSize: 13, padding: "10px 18px", width: "auto",
                  background: "var(--tension)", border: "1px solid var(--tension)",
                  color: "var(--bg)", borderRadius: "var(--r-md)",
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", fontWeight: 600,
                  opacity: deleteLoading ? 0.7 : 1,
                }}
              >
                {deleteLoading
                  ? (fr ? "Suppression…" : "Deleting…")
                  : (fr ? "Confirmer la suppression" : "Confirm deletion")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Composants utilitaires
// ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: "var(--muted)",
        margin: "0 0 12px",
      }}>
        {title}
      </h2>
      <div className="card" style={{
        padding: 18,
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--r-lg)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "var(--muted)",
        marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// ACCOUNT-NATAL-LIST-V1 — Section "Mes profils natals"
// Aperçu compact des profils + lien vers /dashboard/natal pour
// la gestion complète. Ne duplique pas le CRUD : Account = vue
// rapide, /dashboard/natal = page de gestion.
// ──────────────────────────────────────────────────────────

interface NatalProfileSummary {
  id:        string;
  label:     string;
  birthDate: string;
}

function NatalProfilesSection({ accessToken, fr }: { accessToken: string | null; fr: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const profiles: NatalProfileSummary[] =
    (data as { data?: { profiles?: NatalProfileSummary[] } } | undefined)?.data?.profiles ?? [];

  // Format ISO "1980-11-04" → "4 nov. 1980" (fr) / "Nov 4, 1980" (en)
  const formatBirthDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return dateStr;
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(fr ? "fr-FR" : "en-US", {
      day:   "numeric",
      month: "short",
      year:  "numeric",
    });
  };

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: "var(--muted)",
        margin: "0 0 12px",
      }}>
        {fr ? "Mes profils natals" : "My natal profiles"}
      </h2>
      <div className="card" style={{
        padding: 18,
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--r-lg)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {isLoading ? (
          <div className="flex-center" style={{ padding: "8px 0" }}>
            <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          </div>
        ) : profiles.length === 0 ? (
          <>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
              {fr ? "Aucun profil natal pour le moment." : "No natal profile yet."}
            </p>
            <Link
              href="/dashboard/natal"
              className="btn-ob"
              style={{
                alignSelf: "flex-start",
                fontSize: 13,
                padding: "8px 16px",
                width: "auto",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              {fr ? "Créer mon profil ✦" : "Create my profile ✦"}
            </Link>
          </>
        ) : (
          <>
            <ul style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}>
              {profiles.map((p) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontSize: 14,
                    color: "var(--star)",
                    gap: 12,
                  }}
                >
                  <span style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {p.label}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 12, flexShrink: 0 }}>
                    {formatBirthDate(p.birthDate)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/natal"
              className="btn-ghost"
              style={{
                alignSelf: "flex-start",
                fontSize: 12,
                padding: "6px 12px",
                textDecoration: "none",
                marginTop: 4,
              }}
            >
              {fr ? "Gérer mes profils →" : "Manage my profiles →"}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================
// STRIPE-MVP-V1 — bouton vers le Customer Portal Stripe
// ------------------------------------------------------------
// Affiché uniquement sur les plans payants (essential/premium).
// Si le user n'a pas (encore) de stripe_customer_id (ex: plan
// posé manuellement par l'admin), l'API répond 409 NO_STRIPE_CUSTOMER
// et on bascule sur un message inline d'information.
// ============================================================
function ManageSubscriptionButton({
  accessToken,
  fr,
}: {
  accessToken: string | null;
  fr: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleClick = async () => {
    if (!accessToken || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await subscriptionsApi.portal(accessToken);
      const data = (res as { success: true; data: { url: string } }).data;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(fr ? "Portail indisponible." : "Portal unavailable.");
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "NO_STRIPE_CUSTOMER") {
        setError(fr
          ? "Aucun abonnement Stripe à gérer pour ce compte."
          : "No Stripe subscription on this account.");
      } else if (code === "STRIPE_NOT_CONFIGURED") {
        setError(fr
          ? "Le paiement n'est pas encore activé."
          : "Payments not enabled yet.");
      } else {
        setError(fr
          ? "Impossible d'ouvrir le portail. Réessaie."
          : "Unable to open the portal. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !accessToken}
        className="btn-ghost"
        style={{ fontSize: 12, padding: "4px 10px" }}
      >
        {loading
          ? (fr ? "Redirection…" : "Redirecting…")
          : (fr ? "Gérer mon abonnement" : "Manage subscription")}
      </button>
      {error && (
        <div style={{ flexBasis: "100%", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {error}
        </div>
      )}
    </>
  );
}

// ACCOUNT-PAGE-V1 applied
// ACCOUNT-DELETE-V1 applied
// ACCOUNT-PAGE-TOGGLES-FIX-V1 applied

// ACCOUNT-NATAL-LIST-V1 applied

// TOASTER-WIRING-V1 applied

// STRIPE-MVP-V1 applied

// AUTH-PASSWORD-RECOVERY-V1 applied

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
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/i18n";
import { apiClient } from "@/lib/api/client";

export default function AccountPage() {
  const { user, plan, accessToken, logout, refresh } = useAuth();
  const { theme, setTheme, locale, setLocale } = useApp();
  const router = useRouter();

  const fr = locale === "fr";

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
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setSaveError(e?.message ?? (fr ? "Erreur lors de la sauvegarde" : "Save error"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
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
                {savedFlash && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: "var(--harmony)" }}>
                    ✓ {fr ? "Enregistré" : "Saved"}
                  </span>
                )}
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
              ••••••••••
            </div>
            <button
              type="button"
              disabled
              title={fr ? "Bientôt disponible" : "Coming soon"}
              className="btn-ghost"
              style={{ fontSize: 12, padding: "4px 10px", opacity: 0.55, cursor: "not-allowed" }}
            >
              {fr ? "Modifier" : "Change"}
            </button>
          </div>
        </Field>
      </Section>

      {/* ───── ABONNEMENT ───── */}
      <Section title={fr ? "Mon abonnement" : "My subscription"}>
        <Field label={fr ? "Plan" : "Plan"}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
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
          <a href="mailto:contact@llmastro.com" style={{ color: "var(--gold)" }}>
            contact@llmastro.com
          </a>
          .
        </p>
      </div>

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

// ACCOUNT-PAGE-V1 applied
// ACCOUNT-DELETE-V1 applied
// ACCOUNT-PAGE-TOGGLES-FIX-V1 applied

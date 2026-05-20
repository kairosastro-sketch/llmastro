// ============================================================
// ADMIN-FOUNDATION-V1-FRONTEND
// apps/web/src/app/admin/users/[id]/page.tsx
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { adminApi } from "@/lib/api/client";

interface AdminUserDetail {
  id:                  string;
  email:               string;
  name:                string | null;
  is_admin:            boolean;
  email_verified:      boolean;
  provider:            string;
  timezone:            string;
  created_at:          string;
  updated_at:          string;
  deleted_at:          string | null;
  plan_code:           string | null;
  plan_name:           string | null;
  plan_status:         string | null;
  current_period_end:  string | null;
  plan_started_at:     string | null;
  last_token_at:       string | null;
}

const PLANS = [
  { code: "free",      label: "Découverte (free)" },
  { code: "essential", label: "Essentiel (essential)" },
  { code: "premium",   label: "Pro (premium)" },
];

export default function AdminUserDetailPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const params = useParams();
  const id = (params?.id as string) ?? "";

  const [planSel, setPlanSel] = useState<string>("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const userQuery = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: async () => {
      const res = await adminApi.getUser(accessToken!, id);
      return (res as { success: true; data: AdminUserDetail }).data;
    },
    enabled: !!accessToken && !!id,
  });

  const user    = userQuery.data ?? null;
  const loading = userQuery.isPending;
  const fetchError =
    userQuery.error
      ? ((userQuery.error as { statusCode?: number }).statusCode === 404
          ? "Utilisateur introuvable"
          : (userQuery.error as { message?: string }).message ?? "Erreur de chargement")
      : null;
  const error = mutationError ?? fetchError;

  // Init planSel from the user the first time it's loaded — adjust during
  // render, per https://react.dev/learn/you-might-not-need-an-effect.
  const [lastSeenUserId, setLastSeenUserId] = useState<string | null>(null);
  if (user && lastSeenUserId !== user.id) {
    setLastSeenUserId(user.id);
    setPlanSel(user.plan_code ?? "free");
  }

  const changePlanMutation = useMutation({
    mutationFn: async (planCode: string) => {
      if (!accessToken || !user) throw new Error("Pas de session");
      return adminApi.changePlan(accessToken, user.id, planCode);
    },
    onSuccess: () => {
      setSavedMsg("Plan mis à jour ✓");
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "user", id] });
    },
    onError: (e: unknown) => {
      const err = e as { message?: string };
      setMutationError(err?.message ?? "Échec de la mise à jour");
      setSavedMsg(null);
    },
  });

  const saving = changePlanMutation.isPending;

  const handleChangePlan = () => {
    if (!user || !planSel || planSel === user.plan_code) return;
    setSavedMsg(null);
    setMutationError(null);
    changePlanMutation.mutate(planSel);
  };

  if (loading && !user) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner" style={{ margin: "0 auto" }} />
      </div>
    );
  }

  if (error && !user) {
    return (
      <div>
        <Link
          href="/admin/users"
          className="btn-ghost"
          style={{ marginBottom: 16, display: "inline-flex" }}
        >
          ← Retour
        </Link>
        <div className="alert-banner">
          <span className="ab-ico">⚠</span>
          {error}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div>
      <Link
        href="/admin/users"
        className="btn-ghost"
        style={{ marginBottom: 16, display: "inline-flex" }}
      >
        ← Retour
      </Link>

      <h1
        style={{
          fontSize: 22,
          marginBottom: 4,
          fontFamily: "var(--font-display)",
          color: "var(--gold)",
        }}
      >
        {user.name ?? user.email}
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
        {user.email}
        {user.is_admin && (
          <span className="pill pill-gold" style={{ marginLeft: 8 }}>
            ADMIN
          </span>
        )}
        {user.deleted_at && (
          <span className="pill pill-t" style={{ marginLeft: 8 }}>
            DELETED {new Date(user.deleted_at).toLocaleDateString("fr-FR")}
          </span>
        )}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title">Identité</h3>
        <Field label="ID"            value={<code style={{ fontSize: 11 }}>{user.id}</code>} />
        <Field label="Provider"      value={user.provider} />
        <Field label="Email vérifié" value={user.email_verified ? "Oui" : "Non"} />
        <Field label="Timezone"      value={user.timezone} />
        <Field label="Inscrit le"    value={new Date(user.created_at).toLocaleString("fr-FR")} />
        <Field
          label="Dernier login"
          value={
            user.last_token_at
              ? new Date(user.last_token_at).toLocaleString("fr-FR")
              : "—"
          }
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title">Plan</h3>
        <Field label="Plan actuel" value={user.plan_name ?? "—"} />
        <Field label="Statut"      value={user.plan_status ?? "—"} />
        <Field
          label="Démarré"
          value={
            user.plan_started_at
              ? new Date(user.plan_started_at).toLocaleString("fr-FR")
              : "—"
          }
        />
        <Field
          label="Période fin"
          value={
            user.current_period_end
              ? new Date(user.current_period_end).toLocaleString("fr-FR")
              : "—"
          }
        />

        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--border-soft)",
          }}
        >
          <label className="form-label">Changer le plan</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={planSel}
              onChange={(e) => setPlanSel(e.target.value)}
              style={{ flex: 1 }}
            >
              {PLANS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              className="btn-ob"
              onClick={handleChangePlan}
              disabled={saving || planSel === user.plan_code}
              style={{ width: "auto", padding: "10px 16px", fontSize: 13 }}
            >
              {saving ? "…" : "Appliquer"}
            </button>
          </div>
          {savedMsg && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--harmony)" }}>
              {savedMsg}
            </p>
          )}
          {error && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--tension)" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: ".5px",
          color: "var(--muted)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--star)" }}>{value}</span>
    </div>
  );
}

// ADMIN-FOUNDATION-V1-FRONTEND applied

// ============================================================
// GROWTH-V1-ADMIN
// apps/web/src/app/admin/affiliates/[id]/page.tsx
// ------------------------------------------------------------
// Détail affilié. Permet de :
//   - Changer le tier (standard / vip / top / partner)
//   - Surcharger pct + months par cas exceptionnel (bornes 5-50 / 1-36)
//   - Faire évoluer le status (pending → active, paused, banned)
//   - Attacher un user existant par email (si pas déjà attaché)
//   - Voir la candidature soumise (notes JSON décodées côté API)
//   - Voir l'historique des changements de conditions
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { adminAffiliatesApi } from "@/lib/api/client";

interface Affiliate {
  id:                         string;
  slug:                       string;
  display_name:               string;
  status:                     "pending" | "active" | "paused" | "banned";
  tier:                       "standard" | "vip" | "top" | "partner";
  commission_pct_override:    number | null;
  commission_months_override: number | null;
  user_id:                    string | null;
  legal_name:                 string | null;
  siret:                      string | null;
  user_email:                 string | null;
  created_at:                 string;
  updated_at:                 string;
}

interface Application {
  kind:         "application";
  email:        string;
  socialHandle: string;
  audienceSize: string | null;
  motivation:   string | null;
  submittedAt:  string;
}

interface TermsHistoryRow {
  id:                number;
  previous_tier:     string | null;
  previous_pct:      number | null;
  previous_months:   number | null;
  new_tier:          string | null;
  new_pct:           number | null;
  new_months:        number | null;
  reason:            string | null;
  changed_at:        string;
  changed_by_email:  string | null;
}

interface DetailData {
  affiliate:   Affiliate;
  application: Application | null;
  notes:       string | null;
  history:     TermsHistoryRow[];
  stats: {
    lifetime_clicks:     number;
    lifetime_signups:    number;
    active_attributions: number;
  };
}

const TIERS = [
  { code: "standard", label: "Standard — 20% / 12m" },
  { code: "vip",      label: "VIP — 25% / 12m" },
  { code: "top",      label: "Top — 30% / 18m" },
  { code: "partner",  label: "Partner — 35% / 24m" },
] as const;

const STATUSES = [
  { code: "pending", label: "En attente" },
  { code: "active",  label: "Actif" },
  { code: "paused",  label: "En pause" },
  { code: "banned",  label: "Suspendu" },
] as const;

const PCT_DELTA_WARN = 10;

export default function AdminAffiliateDetailPage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const id = (params?.id as string) ?? "";
  const queryClient = useQueryClient();

  const [tierSel, setTierSel] = useState<string>("");
  const [pctOverride, setPctOverride] = useState<string>("");
  const [monthsOverride, setMonthsOverride] = useState<string>("");
  const [statusSel, setStatusSel] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [attachEmail, setAttachEmail] = useState("");
  const [attachMsg, setAttachMsg] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["admin", "affiliate", id],
    queryFn: async () => {
      const res = await adminAffiliatesApi.get(accessToken!, id);
      return (res as { success: true; data: DetailData }).data;
    },
    enabled: !!accessToken && !!id,
  });

  const data    = detailQuery.data ?? null;
  const loading = detailQuery.isPending;
  const fetchError =
    detailQuery.error
      ? ((detailQuery.error as { statusCode?: number }).statusCode === 404
          ? "Affilié introuvable"
          : (detailQuery.error as { message?: string }).message ?? "Erreur de chargement")
      : null;

  // Initialise les contrôles à partir du serveur — pattern "ajust pendant
  // render" (React docs : "You might not need an effect").
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  if (data && lastSeenId !== data.affiliate.id) {
    setLastSeenId(data.affiliate.id);
    setTierSel(data.affiliate.tier);
    setStatusSel(data.affiliate.status);
    setPctOverride(data.affiliate.commission_pct_override?.toString() ?? "");
    setMonthsOverride(data.affiliate.commission_months_override?.toString() ?? "");
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !data) throw new Error("Pas de session");

      const body: Parameters<typeof adminAffiliatesApi.update>[2] = {};
      if (tierSel !== data.affiliate.tier) body.tier = tierSel;
      if (statusSel !== data.affiliate.status) body.status = statusSel;

      const pctNum    = pctOverride    === "" ? null : Number(pctOverride);
      const monthsNum = monthsOverride === "" ? null : Number(monthsOverride);
      if (pctNum !== data.affiliate.commission_pct_override) body.commission_pct_override = pctNum;
      if (monthsNum !== data.affiliate.commission_months_override) body.commission_months_override = monthsNum;
      if (reason.trim()) body.reason = reason.trim();

      // Confirmation explicite si pct varie de > 10 points absolus.
      const prevEffective =
        data.affiliate.commission_pct_override
        ?? tierDefaults(data.affiliate.tier).pct;
      const nextEffective = pctNum ?? tierDefaults(tierSel || data.affiliate.tier).pct;
      if (Math.abs(nextEffective - prevEffective) > PCT_DELTA_WARN) {
        const confirmed = window.confirm(
          `Le pourcentage effectif passe de ${prevEffective}% à ${nextEffective}%.\n` +
          `Confirmer ce changement ?`,
        );
        if (!confirmed) throw new Error("Annulé");
      }

      return adminAffiliatesApi.update(accessToken, id, body);
    },
    onSuccess: () => {
      setSavedMsg("Mis à jour ✓");
      setMutationError(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "affiliate", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "affiliates"] });
    },
    onError: (e: unknown) => {
      const err = e as { message?: string };
      setMutationError(err.message ?? "Échec de la mise à jour");
      setSavedMsg(null);
    },
  });

  const attachMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Pas de session");
      return adminAffiliatesApi.attachUser(accessToken, id, attachEmail.trim());
    },
    onSuccess: () => {
      setAttachMsg("User attaché ✓");
      setAttachError(null);
      setAttachEmail("");
      queryClient.invalidateQueries({ queryKey: ["admin", "affiliate", id] });
    },
    onError: (e: unknown) => {
      const err = e as { message?: string };
      setAttachError(err.message ?? "Échec de l'attache");
      setAttachMsg(null);
    },
  });

  if (loading) {
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>Chargement…</p>;
  }
  if (fetchError) {
    return (
      <div>
        <p style={{ color: "var(--tension)", fontSize: 14 }}>{fetchError}</p>
        <Link href="/admin/affiliates" style={{ color: "var(--violet)", fontSize: 13 }}>
          ← Retour à la liste
        </Link>
      </div>
    );
  }
  if (!data) return null;

  const a = data.affiliate;
  const conditionsChanged =
    tierSel !== a.tier ||
    statusSel !== a.status ||
    (pctOverride === "" ? null : Number(pctOverride)) !== a.commission_pct_override ||
    (monthsOverride === "" ? null : Number(monthsOverride)) !== a.commission_months_override;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link href="/admin/affiliates" style={{ color: "var(--violet)", fontSize: 13, textDecoration: "none" }}>
          ← Affiliés
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontFamily: "var(--font-display)", color: "var(--gold)", margin: 0 }}>
            {a.display_name}
          </h1>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>
            {a.slug}
          </p>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "var(--muted)" }}>
          <div>Créé le {new Date(a.created_at).toLocaleDateString("fr-FR")}</div>
          {a.user_email ? (
            <div style={{ color: "var(--harmony)" }}>User attaché : {a.user_email}</div>
          ) : (
            <div style={{ color: "var(--muted-2)" }}>Pas de user attaché</div>
          )}
        </div>
      </div>

      {/* Application (si pending et notes contient une candidature) */}
      {data.application && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Candidature soumise</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, fontSize: 14, margin: 0 }}>
            <dt style={dtStyle}>Email</dt><dd style={ddStyle}>{data.application.email}</dd>
            <dt style={dtStyle}>Comptes sociaux</dt><dd style={ddStyle}>{data.application.socialHandle}</dd>
            <dt style={dtStyle}>Audience</dt><dd style={ddStyle}>{data.application.audienceSize ?? "—"}</dd>
            <dt style={dtStyle}>Motivation</dt>
            <dd style={{ ...ddStyle, whiteSpace: "pre-wrap" }}>
              {data.application.motivation ?? "—"}
            </dd>
            <dt style={dtStyle}>Soumis le</dt>
            <dd style={ddStyle}>{new Date(data.application.submittedAt).toLocaleString("fr-FR")}</dd>
          </dl>
        </section>
      )}

      {/* Stats rapides */}
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Activité</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <Stat label="Clics" value={data.stats.lifetime_clicks} />
          <Stat label="Inscriptions" value={data.stats.lifetime_signups} />
          <Stat label="Attributions actives" value={data.stats.active_attributions} />
        </div>
      </section>

      {/* Édition conditions + status */}
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Conditions et statut</h2>

        <div style={formGridStyle}>
          <label style={labelStyle}>
            <span>Tier</span>
            <select value={tierSel} onChange={(e) => setTierSel(e.target.value)} style={selectStyle}>
              {TIERS.map((t) => (
                <option key={t.code} value={t.code}>{t.label}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            <span>Status</span>
            <select value={statusSel} onChange={(e) => setStatusSel(e.target.value)} style={selectStyle}>
              {STATUSES.map((s) => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            <span>Override pct (vide = tier)</span>
            <input
              type="number"
              min={5}
              max={50}
              value={pctOverride}
              onChange={(e) => setPctOverride(e.target.value)}
              style={selectStyle}
              placeholder="—"
            />
          </label>

          <label style={labelStyle}>
            <span>Override mois (vide = tier)</span>
            <input
              type="number"
              min={1}
              max={36}
              value={monthsOverride}
              onChange={(e) => setMonthsOverride(e.target.value)}
              style={selectStyle}
              placeholder="—"
            />
          </label>
        </div>

        <label style={{ ...labelStyle, marginTop: 12 }}>
          <span>Raison (recommandé pour l&apos;audit)</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={selectStyle}
            maxLength={500}
            placeholder='Ex : "Lancement campagne mai 2026"'
          />
        </label>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={!conditionsChanged || updateMutation.isPending}
            style={primaryButton(!conditionsChanged || updateMutation.isPending)}
          >
            {updateMutation.isPending ? "Sauvegarde…" : "Enregistrer"}
          </button>
          {savedMsg && <span style={{ color: "var(--harmony)", fontSize: 13 }}>{savedMsg}</span>}
          {mutationError && <span style={{ color: "var(--tension)", fontSize: 13 }}>{mutationError}</span>}
        </div>
      </section>

      {/* Attacher user */}
      {!a.user_id && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Attacher un user existant</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
            Si le candidat a déjà un compte llmastro avec un autre email, lier ici
            permettra d&apos;afficher son dashboard sur <code>/affiliate/dashboard</code>.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="email"
              value={attachEmail}
              onChange={(e) => setAttachEmail(e.target.value)}
              placeholder="email@example.com"
              style={{ ...selectStyle, minWidth: 260 }}
            />
            <button
              type="button"
              onClick={() => attachMutation.mutate()}
              disabled={!attachEmail.trim() || attachMutation.isPending}
              style={primaryButton(!attachEmail.trim() || attachMutation.isPending)}
            >
              {attachMutation.isPending ? "Attache…" : "Attacher"}
            </button>
          </div>
          {attachMsg && <p style={{ color: "var(--harmony)", fontSize: 13, marginTop: 10 }}>{attachMsg}</p>}
          {attachError && <p style={{ color: "var(--tension)", fontSize: 13, marginTop: 10 }}>{attachError}</p>}
        </section>
      )}

      {/* Historique terms */}
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Historique des conditions</h2>
        {data.history.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            Aucun changement enregistré pour l&apos;instant.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.history.map((h) => (
              <li
                key={h.id}
                style={{
                  borderLeft:    "2px solid var(--border-mid)",
                  paddingLeft:   14,
                  marginBottom:  14,
                  fontSize:      13,
                  color:         "var(--muted)",
                }}
              >
                <div style={{ color: "var(--star)" }}>
                  {formatHistoryDiff(h)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 3 }}>
                  {new Date(h.changed_at).toLocaleString("fr-FR")}
                  {h.changed_by_email ? ` · par ${h.changed_by_email}` : ""}
                </div>
                {h.reason && (
                  <div style={{ fontSize: 12, marginTop: 3, fontStyle: "italic" }}>« {h.reason} »</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function tierDefaults(tier: string): { pct: number; months: number } {
  switch (tier) {
    case "vip":     return { pct: 25, months: 12 };
    case "top":     return { pct: 30, months: 18 };
    case "partner": return { pct: 35, months: 24 };
    case "standard":
    default:        return { pct: 20, months: 12 };
  }
}

function formatHistoryDiff(h: TermsHistoryRow): string {
  const parts: string[] = [];
  if (h.previous_tier !== h.new_tier) {
    parts.push(`tier ${h.previous_tier ?? "—"} → ${h.new_tier ?? "—"}`);
  }
  if (h.previous_pct !== h.new_pct) {
    parts.push(`pct ${h.previous_pct ?? "tier"} → ${h.new_pct ?? "tier"}`);
  }
  if (h.previous_months !== h.new_months) {
    parts.push(`mois ${h.previous_months ?? "tier"} → ${h.new_months ?? "tier"}`);
  }
  return parts.length > 0 ? parts.join(", ") : "Aucun changement détecté";
}

// ============================================================
// Styles inline (pattern admin existant)
// ============================================================

const cardStyle: React.CSSProperties = {
  background:    "var(--card-bg)",
  border:        "1px solid var(--card-border)",
  borderRadius:  12,
  padding:       "20px 22px",
  marginBottom:  16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize:      14,
  textTransform: "uppercase",
  letterSpacing: 1.5,
  color:         "var(--gold)",
  margin:        "0 0 14px",
  fontWeight:    400,
};

const dtStyle: React.CSSProperties = {
  color:  "var(--muted)",
  margin: 0,
};

const ddStyle: React.CSSProperties = {
  color:  "var(--star)",
  margin: 0,
};

const formGridStyle: React.CSSProperties = {
  display:             "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap:                 12,
};

const labelStyle: React.CSSProperties = {
  display:       "flex",
  flexDirection: "column",
  gap:           6,
  fontSize:      12,
  color:         "var(--muted)",
  letterSpacing: 0.4,
};

const selectStyle: React.CSSProperties = {
  background:   "var(--input-bg)",
  border:       "1px solid var(--border)",
  borderRadius: 8,
  padding:      "9px 12px",
  color:        "var(--star)",
  fontSize:     14,
  fontFamily:   "inherit",
};

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    background:    "var(--violet)",
    color:         "var(--bg)",
    border:        "1px solid var(--violet)",
    padding:       "9px 18px",
    borderRadius:  8,
    fontSize:      13,
    letterSpacing: 0.5,
    cursor:        disabled ? "not-allowed" : "pointer",
    opacity:       disabled ? 0.55 : 1,
    fontFamily:    "inherit",
  };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background:    "var(--bg-raised)",
        border:        "1px solid var(--border-soft)",
        borderRadius:  10,
        padding:       "14px 16px",
        textAlign:     "center",
      }}
    >
      <div style={{ fontSize: 24, color: "var(--star)" }}>{value}</div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted-2)", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

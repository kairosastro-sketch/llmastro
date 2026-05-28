// PROMO-CODES-V1
// apps/web/src/app/admin/promos/page.tsx
// Liste des codes promo + bouton "Nouveau code" (modal de création).
// Aligné sur /admin/affiliates : React Query, useAuth.accessToken,
// inline styles + tokens globals.css.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { adminPromoCodesApi, type PromoCodePayload, type PromoKind } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toaster";

interface ListResponse {
  codes: PromoCodePayload[];
  total: number;
  page:  number;
  limit: number;
}

const LIMIT = 20;
const ACTIVE_FILTERS = ["all", "true", "false"] as const;
const FILTER_LABEL: Record<typeof ACTIVE_FILTERS[number], string> = {
  all:   "Tous",
  true:  "Actifs",
  false: "Archivés",
};

const PLAN_OPTIONS = [
  { code: "essential", label: "Essentiel" },
  { code: "premium",   label: "Pro" },
];

// Feature keys utiles côté codes promo. La liste exhaustive est dans
// apps/api/src/config/plans.config.ts ; on expose ici un sous-ensemble
// crédibles à offrir en credits ponctuels.
const FEATURE_OPTIONS = [
  { key: "ai.chat.credits",       label: "Crédits chat Kairos" },
  { key: "tarot.credits",         label: "Crédits tarot" },
  { key: "synastry.credits",      label: "Crédits synastrie" },
  { key: "reports.credits",       label: "Crédits rapports" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function describeKind(promo: PromoCodePayload): string {
  if (promo.kind === "subscription_days") {
    return `${promo.subscriptionDays}j ${promo.subscriptionPlanCode === "premium" ? "Pro" : "Essentiel"}`;
  }
  const featureLabel = FEATURE_OPTIONS.find((f) => f.key === promo.featureKey)?.label ?? promo.featureKey;
  return `${promo.creditQuantity} × ${featureLabel}`;
}

export default function AdminPromosPage() {
  const { accessToken } = useAuth();
  const queryClient     = useQueryClient();
  const { toast }       = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<typeof ACTIVE_FILTERS[number]>("true");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, activeFilter]);

  const query = useQuery({
    queryKey: ["admin", "promos", { q: debouncedSearch, active: activeFilter, page, limit: LIMIT }],
    queryFn: async () => {
      const res = await adminPromoCodesApi.list(accessToken!, {
        q:      debouncedSearch || undefined,
        active: activeFilter,
        page,
        limit:  LIMIT,
      });
      return (res as { success: true; data: ListResponse }).data;
    },
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const data    = query.data ?? null;
  const loading = query.isFetching;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "promos"] });

  const toggleActive = async (id: string, next: boolean) => {
    try {
      await adminPromoCodesApi.update(accessToken!, id, { active: next });
      toast(next ? "Code réactivé" : "Code archivé", "success");
      refresh();
    } catch (err) {
      const e = err as { message?: string };
      toast(e.message ?? "Impossible de mettre à jour", "error");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0, color: "var(--star)", fontFamily: "Georgia, serif", fontWeight: 400 }}>
            Codes promo
          </h1>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
            Offrir des jours d'abonnement ou des crédits feature à un utilisateur.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="btn-ob"
          style={{ fontSize: 13, padding: "8px 16px" }}
        >
          ✦ Nouveau code
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un code…"
          style={{ flex: "1 1 240px", minWidth: 200 }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {ACTIVE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className={activeFilter === f ? "btn-ob" : "btn-ghost"}
              style={{ fontSize: 12, padding: "6px 12px", width: "auto" }}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {!data && loading ? (
        <div className="flex-center" style={{ padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : !data || data.codes.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          Aucun code promo pour le moment.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-raised)", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
                <th style={cellHeader}>Code</th>
                <th style={cellHeader}>Effet</th>
                <th style={cellHeader}>Utilisations</th>
                <th style={cellHeader}>Expire</th>
                <th style={cellHeader}>Statut</th>
                <th style={cellHeader}></th>
              </tr>
            </thead>
            <tbody>
              {data.codes.map((promo) => (
                <tr key={promo.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={cellBody}>
                    <Link
                      href={`/admin/promos/${promo.id}`}
                      style={{ color: "var(--gold)", fontFamily: "monospace", textDecoration: "none" }}
                    >
                      {promo.code}
                    </Link>
                    {promo.description ? (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {promo.description}
                      </div>
                    ) : null}
                  </td>
                  <td style={cellBody}>{describeKind(promo)}</td>
                  <td style={cellBody}>
                    {promo.redemptionsCount}
                    {promo.maxRedemptions !== null ? ` / ${promo.maxRedemptions}` : " / ∞"}
                  </td>
                  <td style={cellBody}>{formatDate(promo.expiresAt)}</td>
                  <td style={cellBody}>
                    <span style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: promo.active ? "rgba(110,177,127,.15)" : "rgba(255,255,255,.06)",
                      color:      promo.active ? "var(--harmony)"        : "var(--muted)",
                    }}>
                      {promo.active ? "Actif" : "Archivé"}
                    </span>
                  </td>
                  <td style={{ ...cellBody, textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => toggleActive(promo.id, !promo.active)}
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                    >
                      {promo.active ? "Archiver" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn-ghost"
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            ←
          </button>
          <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="btn-ghost"
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            →
          </button>
        </div>
      )}

      {showCreate && (
        <CreatePromoModal
          accessToken={accessToken!}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
            toast("Code promo créé", "success");
          }}
        />
      )}
    </div>
  );
}

const cellHeader: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontWeight: 500,
};
const cellBody: React.CSSProperties = {
  padding: "12px 14px", color: "var(--star)", verticalAlign: "top",
};

// ──────────────────────────────────────────────────────────
// Modal de création
// ──────────────────────────────────────────────────────────

function CreatePromoModal({
  accessToken,
  onClose,
  onCreated,
}: {
  accessToken: string;
  onClose:    () => void;
  onCreated:  () => void;
}) {
  const [kind, setKind] = useState<PromoKind>("subscription_days");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [planCode, setPlanCode] = useState("essential");
  const [days, setDays] = useState(14);
  const [featureKey, setFeatureKey] = useState(FEATURE_OPTIONS[0]!.key);
  const [quantity, setQuantity] = useState(5);
  const [maxRedemptions, setMaxRedemptions] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    setError(null);

    const trimmedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(trimmedCode)) {
      setError("Code invalide : 3-40 caractères, A-Z 0-9 _ -");
      return;
    }

    setSaving(true);
    try {
      const body: Parameters<typeof adminPromoCodesApi.create>[1] = {
        code:        trimmedCode,
        description: description.trim() || null,
        kind,
        maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
        expiresAt:   expiresAt ? new Date(expiresAt).toISOString() : null,
      };
      if (kind === "subscription_days") {
        body.subscriptionPlanCode = planCode;
        body.subscriptionDays     = days;
      } else {
        body.featureKey      = featureKey;
        body.creditQuantity  = quantity;
      }

      await adminPromoCodesApi.create(accessToken, body);
      onCreated();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(e.message ?? "Création échouée");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-promo-title"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16, overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520, width: "100%",
          background: "var(--card-bg)", border: "1px solid var(--border-mid)",
          borderRadius: "var(--r-lg)", padding: 24,
          boxShadow: "0 20px 50px rgba(0,0,0,.4)",
          maxHeight: "calc(100vh - 32px)", overflowY: "auto",
        }}
      >
        <h2
          id="create-promo-title"
          style={{
            fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 400,
            color: "var(--star)", margin: "0 0 18px",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <span aria-hidden="true" style={{ color: "var(--gold)" }}>✦</span>
          Nouveau code promo
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ModalField label="Type">
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setKind("subscription_days")}
                className={kind === "subscription_days" ? "btn-ob" : "btn-ghost"}
                style={{ fontSize: 12, padding: "8px 14px", width: "auto", flex: "0 0 auto" }}
              >
                Jours d'abonnement
              </button>
              <button
                type="button"
                onClick={() => setKind("feature_credits")}
                className={kind === "feature_credits" ? "btn-ob" : "btn-ghost"}
                style={{ fontSize: 12, padding: "8px 14px", width: "auto", flex: "0 0 auto" }}
              >
                Crédits feature
              </button>
            </div>
          </ModalField>

          <ModalField label="Code (visible par l'utilisateur)">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ex : WELCOME26"
              maxLength={40}
              style={{ fontFamily: "monospace" }}
            />
            <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>
              Lettres, chiffres, _ et -. Insensible à la casse.
            </div>
          </ModalField>

          <ModalField label="Description (interne, optionnelle)">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex : campagne Insta novembre"
              maxLength={500}
            />
          </ModalField>

          {kind === "subscription_days" ? (
            <>
              <ModalField label="Plan offert">
                <div style={{ display: "flex", gap: 6 }}>
                  {PLAN_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setPlanCode(opt.code)}
                      className={planCode === opt.code ? "btn-ob" : "btn-ghost"}
                      style={{ fontSize: 12, padding: "8px 14px", width: "auto", flex: "0 0 auto" }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </ModalField>
              <ModalField label="Durée (jours)">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Math.min(365, parseInt(e.target.value || "1", 10))))}
                />
              </ModalField>
            </>
          ) : (
            <>
              <ModalField label="Feature">
                <select
                  value={featureKey}
                  onChange={(e) => setFeatureKey(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px" }}
                >
                  {FEATURE_OPTIONS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </ModalField>
              <ModalField label="Quantité">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(10000, parseInt(e.target.value || "1", 10))))}
                />
              </ModalField>
            </>
          )}

          <ModalField label="Utilisations max (vide = illimité)">
            <input
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="∞"
            />
          </ModalField>

          <ModalField label="Expire le (optionnel)">
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </ModalField>

          {error && (
            <div className="alert-banner" role="alert" aria-live="polite">
              <span className="ab-ico">⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 22, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-ghost"
            style={{ fontSize: 13, padding: "10px 18px", width: "auto" }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !code.trim()}
            className="btn-ob"
            style={{ fontSize: 13, padding: "10px 18px", width: "auto" }}
          >
            {saving ? "Création…" : "Créer le code"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 11, textTransform: "uppercase",
        letterSpacing: 1, color: "var(--muted)", marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// PROMO-CODES-V1 applied

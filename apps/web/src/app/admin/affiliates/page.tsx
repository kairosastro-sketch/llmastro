// ============================================================
// GROWTH-V1-ADMIN
// apps/web/src/app/admin/affiliates/page.tsx
// ------------------------------------------------------------
// Liste des affiliés avec filtre par statut + recherche par nom/slug.
// Pattern aligné sur /admin/users : inline styles avec tokens
// globals.css, React Query, useAuth.accessToken.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { adminAffiliatesApi } from "@/lib/api/client";

interface AffiliateRow {
  id:                         string;
  slug:                       string;
  display_name:               string;
  status:                     "pending" | "active" | "paused" | "banned";
  tier:                       string;
  commission_pct_override:    number | null;
  commission_months_override: number | null;
  user_id:                    string | null;
  created_at:                 string;
  updated_at:                 string;
  active_attributions:        number;
  lifetime_clicks:            number;
}

interface ListResponse {
  affiliates: AffiliateRow[];
  total:      number;
  page:       number;
  limit:      number;
}

const LIMIT = 20;
const STATUSES = ["all", "pending", "active", "paused", "banned"] as const;

const STATUS_LABEL: Record<typeof STATUSES[number], string> = {
  all:     "Tous",
  pending: "En attente",
  active:  "Actifs",
  paused:  "En pause",
  banned:  "Suspendus",
};

function statusColor(status: AffiliateRow["status"]): string {
  switch (status) {
    case "active":  return "var(--harmony)";
    case "pending": return "var(--neutral)";
    case "paused":  return "var(--muted)";
    case "banned":  return "var(--tension)";
  }
}

export default function AdminAffiliatesPage() {
  const { accessToken } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<typeof STATUSES[number]>("pending");
  const [page,   setPage]   = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  const query = useQuery({
    queryKey: ["admin", "affiliates", { q: debouncedSearch, status, page, limit: LIMIT }],
    queryFn: async () => {
      const res = await adminAffiliatesApi.list(accessToken!, {
        q:      debouncedSearch,
        status: status === "all" ? undefined : status,
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
  const error   = (query.error as { message?: string } | null)?.message ?? null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 22,
            marginBottom: 4,
            fontFamily: "var(--font-display)",
            color: "var(--gold)",
          }}
        >
          Affiliés
        </h1>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          Approuver les candidatures, ajuster les conditions, suivre l&apos;activité.
        </p>
      </div>

      {/* Filtres status (chips) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            style={{
              background:    status === s ? "var(--violet)" : "transparent",
              color:         status === s ? "var(--bg)" : "var(--muted)",
              border:        `1px solid ${status === s ? "var(--violet)" : "var(--border)"}`,
              padding:       "6px 14px",
              borderRadius:  999,
              fontSize:      12,
              letterSpacing: 0.5,
              cursor:        "pointer",
              fontFamily:    "inherit",
            }}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ marginBottom: 18 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Recherche nom ou slug…"
          style={{
            background: "var(--input-bg)",
            border:     "1px solid var(--border)",
            borderRadius: 10,
            padding:    "10px 14px",
            color:      "var(--star)",
            fontSize:   14,
            width:      "100%",
            maxWidth:   360,
            fontFamily: "inherit",
          }}
        />
      </div>

      {error && (
        <p style={{ color: "var(--tension)", fontSize: 13, marginBottom: 14 }}>
          {error}
        </p>
      )}

      {/* Table */}
      <div
        style={{
          background:   "var(--card-bg)",
          border:       "1px solid var(--card-border)",
          borderRadius: 12,
          overflow:     "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-raised)" }}>
            <tr>
              <th style={thStyle}>Nom</th>
              <th style={thStyle}>Slug</th>
              <th style={thStyle}>Statut</th>
              <th style={thStyle}>Tier</th>
              <th style={thStyle}>Conditions</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Actives</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Clics</th>
              <th style={thStyle}>Créé</th>
            </tr>
          </thead>
          <tbody>
            {data?.affiliates.map((a) => (
              <tr
                key={a.id}
                style={{ borderTop: "1px solid var(--border-soft)" }}
              >
                <td style={tdStyle}>
                  <Link
                    href={`/admin/affiliates/${a.id}`}
                    style={{ color: "var(--star)", textDecoration: "none" }}
                  >
                    {a.display_name}
                  </Link>
                </td>
                <td style={{ ...tdStyle, color: "var(--muted)", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                  {a.slug}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      color:         statusColor(a.status),
                      fontSize:      11,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {a.status}
                  </span>
                </td>
                <td style={{ ...tdStyle, textTransform: "capitalize" }}>{a.tier}</td>
                <td style={tdStyle}>
                  {a.commission_pct_override !== null || a.commission_months_override !== null ? (
                    <span style={{ color: "var(--gold)" }}>
                      override {a.commission_pct_override ?? "—"}% / {a.commission_months_override ?? "—"}m
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted-2)" }}>tier</span>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{a.active_attributions}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{a.lifetime_clicks}</td>
                <td style={{ ...tdStyle, color: "var(--muted-2)", fontSize: 12 }}>
                  {new Date(a.created_at).toLocaleDateString("fr-FR", {
                    day:   "2-digit",
                    month: "short",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.affiliates.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
            Aucun affilié pour ce filtre.
          </div>
        )}
        {loading && (
          <div style={{ padding: 16, textAlign: "center", color: "var(--muted-2)", fontSize: 12 }}>
            Chargement…
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 8 }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={paginationButton(page <= 1)}
          >
            ← Précédent
          </button>
          <span style={{ alignSelf: "center", fontSize: 13, color: "var(--muted)" }}>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={paginationButton(page >= totalPages)}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign:     "left",
  padding:       "12px 14px",
  fontSize:      11,
  textTransform: "uppercase",
  letterSpacing: 1,
  color:         "var(--muted)",
  fontWeight:    400,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
};

function paginationButton(disabled: boolean): React.CSSProperties {
  return {
    background:    "transparent",
    border:        "1px solid var(--border)",
    color:         disabled ? "var(--muted-2)" : "var(--star)",
    padding:       "6px 14px",
    borderRadius:  8,
    fontSize:      13,
    cursor:        disabled ? "not-allowed" : "pointer",
    opacity:       disabled ? 0.5 : 1,
    fontFamily:    "inherit",
  };
}

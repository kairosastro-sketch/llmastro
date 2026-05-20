// ============================================================
// ADMIN-FOUNDATION-V1-FRONTEND
// apps/web/src/app/admin/users/page.tsx
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { adminApi } from "@/lib/api/client";

interface AdminUserRow {
  id:           string;
  email:        string;
  name:         string | null;
  is_admin:     boolean;
  created_at:   string;
  deleted_at:   string | null;
  plan_code:    string | null;
  plan_name:    string | null;
  plan_status:  string | null;
}

interface ListResponse {
  users: AdminUserRow[];
  total: number;
  page:  number;
  limit: number;
}

const LIMIT = 20;

export default function AdminUsersPage() {
  const { accessToken } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search → 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ["admin", "users", { q: debouncedSearch, page, limit: LIMIT }],
    queryFn: async () => {
      const res = await adminApi.listUsers(accessToken!, {
        q: debouncedSearch,
        page,
        limit: LIMIT,
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
          Utilisateurs
        </h1>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          {data
            ? `${data.total} utilisateur${data.total > 1 ? "s" : ""}`
            : "—"}
        </p>
      </div>

      <input
        type="text"
        placeholder="Rechercher par email ou nom…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        style={{ marginBottom: 16 }}
      />

      {error && (
        <div className="alert-banner" style={{ marginBottom: 12 }}>
          <span className="ab-ico">⚠</span>
          {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div className="spinner" style={{ margin: "0 auto" }} />
        </div>
      )}

      {data && data.users.length === 0 && (
        <div className="empty-state">
          <span className="ico">🔍</span>
          <p className="msg">Aucun utilisateur trouvé.</p>
        </div>
      )}

      {data && data.users.length > 0 && (
        <>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border-soft)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: ".5px",
                    color: "var(--muted)",
                  }}
                >
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Email</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Nom</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Plan</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Inscrit</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>—</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--star)" }}>
                      {u.email}
                      {u.is_admin && (
                        <span
                          className="pill pill-gold"
                          style={{ marginLeft: 8, fontSize: 9, padding: "2px 8px" }}
                        >
                          ADMIN
                        </span>
                      )}
                      {u.deleted_at && (
                        <span
                          className="pill pill-t"
                          style={{ marginLeft: 8, fontSize: 9, padding: "2px 8px" }}
                        >
                          DEL
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--star)" }}>
                      {u.name ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                      {u.plan_name ? (
                        <span className="pill pill-info">{u.plan_name}</span>
                      ) : (
                        <span style={{ color: "var(--muted-2)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)" }}>
                      {new Date(u.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="btn-ghost"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                      >
                        Détails
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                marginTop: 16,
                alignItems: "center",
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-ghost"
                style={{ padding: "6px 14px", fontSize: 13 }}
              >
                ←
              </button>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-ghost"
                style={{ padding: "6px 14px", fontSize: 13 }}
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ADMIN-FOUNDATION-V1-FRONTEND applied

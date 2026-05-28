// PROMO-CODES-V1
// apps/web/src/app/admin/promos/[id]/page.tsx
// Détail d'un code + table des redemptions.

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { adminPromoCodesApi, type PromoCodePayload } from "@/lib/api/client";

interface RedemptionRow {
  id:         string;
  userId:     string;
  userEmail:  string | null;
  redeemedAt: string;
}

interface DetailResponse {
  promo:       PromoCodePayload;
  redemptions: RedemptionRow[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminPromoDetailPage() {
  const { accessToken } = useAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const query = useQuery({
    queryKey: ["admin", "promos", id],
    queryFn: async () => {
      const res = await adminPromoCodesApi.get(accessToken!, id!);
      return (res as { success: true; data: DetailResponse }).data;
    },
    enabled: !!accessToken && !!id,
  });

  const data = query.data ?? null;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/admin/promos"
          style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
        >
          ← Codes promo
        </Link>
      </div>

      {query.isLoading || !data ? (
        <div className="flex-center" style={{ padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <h1 style={{
            fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 400,
            color: "var(--star)", margin: "0 0 4px",
          }}>
            <span style={{ fontFamily: "monospace", color: "var(--gold)" }}>{data.promo.code}</span>
          </h1>
          {data.promo.description ? (
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
              {data.promo.description}
            </p>
          ) : null}

          <div className="card" style={{ padding: 18, marginBottom: 24 }}>
            <Row label="Type">
              {data.promo.kind === "subscription_days"
                ? `${data.promo.subscriptionDays} jours · ${data.promo.subscriptionPlanCode === "premium" ? "Pro" : "Essentiel"}`
                : `${data.promo.creditQuantity} crédits · ${data.promo.featureKey}`}
            </Row>
            <Row label="Utilisations">
              {data.promo.redemptionsCount}
              {data.promo.maxRedemptions !== null ? ` / ${data.promo.maxRedemptions}` : " / ∞"}
              <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 12 }}>
                ({data.promo.maxPerUser === 1 ? "1 fois par user" : `${data.promo.maxPerUser} fois par user`})
              </span>
            </Row>
            <Row label="Expire">
              {data.promo.expiresAt
                ? new Date(data.promo.expiresAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                : "Jamais"}
            </Row>
            <Row label="Statut">
              <span style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 12,
                background: data.promo.active ? "rgba(110,177,127,.15)" : "rgba(255,255,255,.06)",
                color:      data.promo.active ? "var(--harmony)"        : "var(--muted)",
              }}>
                {data.promo.active ? "Actif" : "Archivé"}
              </span>
            </Row>
            <Row label="Créé le">
              {new Date(data.promo.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
            </Row>
          </div>

          <h2 style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2,
            color: "var(--muted)", margin: "0 0 12px",
          }}>
            Redemptions ({data.redemptions.length})
          </h2>

          {data.redemptions.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Personne n'a encore utilisé ce code.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-raised)", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    <th style={cellHeader}>Utilisateur</th>
                    <th style={cellHeader}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.redemptions.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                      <td style={cellBody}>
                        <Link
                          href={`/admin/users/${r.userId}`}
                          style={{ color: "var(--gold)", textDecoration: "none" }}
                        >
                          {r.userEmail ?? r.userId}
                        </Link>
                      </td>
                      <td style={cellBody}>{formatDateTime(r.redeemedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const cellHeader: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontWeight: 500,
};
const cellBody: React.CSSProperties = {
  padding: "12px 14px", color: "var(--star)",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: "6px 0", fontSize: 13 }}>
      <div style={{ minWidth: 130, color: "var(--muted)", fontSize: 12 }}>
        {label}
      </div>
      <div style={{ color: "var(--star)" }}>{children}</div>
    </div>
  );
}

// PROMO-CODES-V1 applied

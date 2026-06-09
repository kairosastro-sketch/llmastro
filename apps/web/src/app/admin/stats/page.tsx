// ============================================================
// ADMIN-STATS-V1-FRONTEND
// apps/web/src/app/admin/stats/page.tsx
// ============================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { adminStatsApi } from "@/lib/api/client";

// ── Shapes API (count(*) SQL renvoie des strings, on parse) ──
interface StatsOverview {
  totals: {
    active_users:  string;
    deleted_users: string;
    signups_7d:    string;
    signups_30d:   string;
    admin_users:   string;
  };
  byPlan: Array<{ code: string; name: string; users_count: number }>;
}

interface ConnEvent {
  date:          string;
  logins:        string;
  logins_failed: string;
  registers:     string;
}

interface XaiDaily {
  date:             string;
  total_calls:      number;
  success_count:    number;
  total_tokens_in:  number;
  total_tokens_out: number;
  avg_latency_ms:   number;
}

interface StatsXai {
  days:  number;
  total: Omit<XaiDaily, "date">;
  daily: XaiDaily[];
}

// ── ANALYTICS-V1 — audience ──
interface PageRow {
  path:            string;
  views:           number;
  unique_visitors: number;
  avg_active_ms:   number;
  total_active_ms: string | number; // bigint → string côté pg
}
interface StatsPages {
  days:  number;
  pages: PageRow[];
}
interface EngDaily {
  date:            string;
  sessions:        number;
  page_views:      number;
  avg_session_ms:  number;
  total_active_ms: string | number;
}
interface StatsEngagement {
  days:  number;
  total: Omit<EngDaily, "date">;
  daily: EngDaily[];
}

// ── Helpers ──
function n(v: string | number | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v, 10) || 0;
  return 0;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// ANALYTICS-V1 : ms → "Xs" / "Xm Ys" / "Xh Ym"
function fmtDuration(ms: string | number | undefined): string {
  const total = Math.round(n(ms) / 1000);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  if (m < 60) return `${m}m ${total % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function AdminStatsPage() {
  const { accessToken } = useAuth();

  const overviewQuery = useQuery({
    queryKey: ["admin", "stats", "overview"],
    queryFn: async () => {
      const res = await adminStatsApi.overview(accessToken!);
      return (res as { success: true; data: StatsOverview }).data;
    },
    enabled: !!accessToken,
  });

  const connQuery = useQuery({
    queryKey: ["admin", "stats", "connections", 7],
    queryFn: async () => {
      const res = await adminStatsApi.connections(accessToken!, 7);
      return (res as { success: true; data: { events: ConnEvent[] } }).data.events;
    },
    enabled: !!accessToken,
  });

  const xaiQuery = useQuery({
    queryKey: ["admin", "stats", "xai", 7],
    queryFn: async () => {
      const res = await adminStatsApi.xai(accessToken!, 7);
      return (res as { success: true; data: StatsXai }).data;
    },
    enabled: !!accessToken,
  });

  const pagesQuery = useQuery({
    queryKey: ["admin", "stats", "pages", 7],
    queryFn: async () => {
      const res = await adminStatsApi.pages(accessToken!, 7);
      return (res as { success: true; data: StatsPages }).data;
    },
    enabled: !!accessToken,
  });

  const engagementQuery = useQuery({
    queryKey: ["admin", "stats", "engagement", 7],
    queryFn: async () => {
      const res = await adminStatsApi.engagement(accessToken!, 7);
      return (res as { success: true; data: StatsEngagement }).data;
    },
    enabled: !!accessToken,
  });

  const overview   = overviewQuery.data ?? null;
  const conn       = connQuery.data ?? null;
  const xai        = xaiQuery.data ?? null;
  const pages      = pagesQuery.data ?? null;
  const engagement = engagementQuery.data ?? null;
  const loading  =
    overviewQuery.isPending || connQuery.isPending || xaiQuery.isPending ||
    pagesQuery.isPending || engagementQuery.isPending;
  const error    =
    (overviewQuery.error as { message?: string } | null)?.message ??
    (connQuery.error as { message?: string } | null)?.message ??
    (xaiQuery.error as { message?: string } | null)?.message ??
    (pagesQuery.error as { message?: string } | null)?.message ??
    (engagementQuery.error as { message?: string } | null)?.message ??
    null;

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner" style={{ margin: "0 auto" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-banner">
        <span className="ab-ico">⚠</span>
        {error}
      </div>
    );
  }

  if (!overview) return null;

  // ── Calculs dérivés ──
  const connMax = conn
    ? Math.max(1, ...conn.map(e => n(e.logins) + n(e.logins_failed) + n(e.registers)))
    : 1;
  const xaiMax = xai && xai.daily.length > 0
    ? Math.max(1, ...xai.daily.map(d => d.total_calls))
    : 1;

  const xaiSuccessRate = xai && xai.total.total_calls > 0
    ? Math.round((xai.total.success_count / xai.total.total_calls) * 100)
    : 0;

  return (
    <div>
      <h1 style={{
        fontSize: 22, marginBottom: 4,
        fontFamily: "var(--font-display)", color: "var(--gold)",
      }}>
        Statistiques
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
        Aperçu de la plateforme — données live
      </p>

      {/* ─── APERÇU ─── */}
      <h3 className="section-title" style={{ marginTop: 8 }}>Aperçu</h3>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10, marginBottom: 20,
      }}>
        <StatCard label="Actifs"        value={n(overview.totals.active_users)}  hint="utilisateurs" />
        <StatCard label="Admins"        value={n(overview.totals.admin_users)}    hint="comptes"     />
        <StatCard label="Inscrits 7j"   value={n(overview.totals.signups_7d)}     hint="nouveaux"    />
        <StatCard label="Inscrits 30j"  value={n(overview.totals.signups_30d)}    hint="nouveaux"    />
        <StatCard label="Supprimés"     value={n(overview.totals.deleted_users)}  hint="soft-delete" />
      </div>

      {/* ─── PLANS ─── */}
      <h3 className="section-title">Répartition par plan</h3>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10, marginBottom: 20,
      }}>
        {overview.byPlan.map(p => (
          <div key={p.code} className="card" style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 28, color: "var(--gold)",
            }}>
              {p.users_count}
            </div>
            <div style={{
              fontSize: 11, color: "var(--muted)",
              textTransform: "uppercase", letterSpacing: ".5px", marginTop: 2,
            }}>
              {p.name}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted-2)", marginTop: 2 }}>
              {p.code}
            </div>
          </div>
        ))}
      </div>

      {/* ─── CONNEXIONS ─── */}
      <h3 className="section-title">Connexions (7 derniers jours)</h3>
      <div className="card" style={{ marginBottom: 20 }}>
        {conn && conn.length > 0 ? (
          <>
            <BarChart
              data={conn.map(e => ({
                date:   fmtDate(e.date),
                series: [
                  { value: n(e.logins),        color: "var(--harmony)", label: "Logins"  },
                  { value: n(e.registers),     color: "var(--gold)",    label: "Inscriptions" },
                  { value: n(e.logins_failed), color: "var(--tension)", label: "Échecs"  },
                ],
              }))}
              max={connMax}
            />
            <Legend items={[
              { color: "var(--harmony)", label: "Logins réussis" },
              { color: "var(--gold)",    label: "Inscriptions" },
              { color: "var(--tension)", label: "Échecs login" },
            ]} />
          </>
        ) : (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            Aucune connexion sur la période.
          </div>
        )}
      </div>

      {/* ─── APPELS xAI/GROK ─── */}
      <h3 className="section-title">Appels Grok (7 derniers jours)</h3>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10, marginBottom: 12,
      }}>
        <StatCard
          label="Total appels"
          value={xai?.total.total_calls ?? 0}
          hint={`${xaiSuccessRate}% succès`}
        />
        <StatCard
          label="Tokens entrée"
          value={xai?.total.total_tokens_in ?? 0}
          hint="cumul"
        />
        <StatCard
          label="Tokens sortie"
          value={xai?.total.total_tokens_out ?? 0}
          hint="cumul"
        />
        <StatCard
          label="Latence moy."
          value={xai?.total.avg_latency_ms ?? 0}
          hint="ms"
        />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        {xai && xai.daily.length > 0 ? (
          <>
            <BarChart
              data={xai.daily.map(d => ({
                date:   fmtDate(d.date),
                series: [
                  { value: d.success_count,                       color: "var(--harmony)", label: "Succès" },
                  { value: d.total_calls - d.success_count,       color: "var(--tension)", label: "Échecs" },
                ],
              }))}
              max={xaiMax}
            />
            <Legend items={[
              { color: "var(--harmony)", label: "Appels réussis" },
              { color: "var(--tension)", label: "Appels échoués" },
            ]} />
          </>
        ) : (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            Aucun appel Grok sur la période.
            <br />
            <span style={{ fontSize: 11 }}>
              Déclenche une lecture Kairos pour voir des données apparaître.
            </span>
          </div>
        )}
      </div>

      {/* ─── ENGAGEMENT (ANALYTICS-V1) ─── */}
      <h3 className="section-title">Engagement (7 derniers jours)</h3>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10, marginBottom: 12,
      }}>
        <StatCard
          label="Temps moy. / visite"
          value={fmtDuration(engagement?.total.avg_session_ms)}
          hint="temps actif"
        />
        <StatCard
          label="Visites"
          value={n(engagement?.total.sessions)}
          hint="sessions"
        />
        <StatCard
          label="Pages vues"
          value={n(engagement?.total.page_views)}
          hint="total"
        />
        <StatCard
          label="Temps actif total"
          value={fmtDuration(engagement?.total.total_active_ms)}
          hint="cumul"
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        {engagement && engagement.daily.length > 0 ? (
          <>
            <BarChart
              data={engagement.daily.map(d => ({
                date:   fmtDate(d.date),
                series: [
                  { value: n(d.sessions),   color: "var(--gold)",    label: "Visites" },
                  { value: n(d.page_views), color: "var(--harmony)", label: "Pages vues" },
                ],
              }))}
              max={Math.max(1, ...engagement.daily.map(d => n(d.sessions) + n(d.page_views)))}
            />
            <Legend items={[
              { color: "var(--gold)",    label: "Visites" },
              { color: "var(--harmony)", label: "Pages vues" },
            ]} />
          </>
        ) : (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            Aucune visite enregistrée sur la période.
            <br />
            <span style={{ fontSize: 11 }}>
              Le suivi démarre dès qu'un visiteur accepte la mesure d'audience.
            </span>
          </div>
        )}
      </div>

      {/* ─── PAGES LES PLUS VUES (ANALYTICS-V1) ─── */}
      <h3 className="section-title">Pages les plus vues (7 derniers jours)</h3>
      <div className="card" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
        {pages && pages.pages.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{
                textTransform: "uppercase", fontSize: 10, letterSpacing: ".5px",
                color: "var(--muted)",
              }}>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>Page</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Vues</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Visiteurs</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Temps moy.</th>
              </tr>
            </thead>
            <tbody>
              {pages.pages.map((p) => (
                <tr key={p.path} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "8px 12px", color: "var(--star)", fontFamily: "monospace" }}>
                    {p.path}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--gold)" }}>
                    {n(p.views).toLocaleString("fr-FR")}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--muted)" }}>
                    {n(p.unique_visitors).toLocaleString("fr-FR")}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--muted)" }}>
                    {fmtDuration(p.avg_active_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            Aucune page vue sur la période.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 26, color: "var(--gold)",
      }}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </div>
      <div style={{
        fontSize: 11, color: "var(--muted)",
        textTransform: "uppercase", letterSpacing: ".5px", marginTop: 2,
      }}>
        {label}
      </div>
      {hint && (
        <div style={{ fontSize: 10, color: "var(--muted-2)", marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

interface BarSeries { value: number; color: string; label: string }
interface BarItem   { date: string; series: BarSeries[] }

function BarChart({ data, max }: { data: BarItem[]; max: number }) {
  const HEIGHT = 120;
  return (
    <div style={{
      display: "flex", justifyContent: "space-around", alignItems: "flex-end",
      height: HEIGHT + 24, padding: "8px 4px",
    }}>
      {data.map((item, idx) => {
        const total = item.series.reduce((s, x) => s + x.value, 0);
        return (
          <div key={idx} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            flex: 1, minWidth: 0,
          }}>
            <div style={{
              fontSize: 10, color: "var(--muted)", marginBottom: 4,
              fontFamily: "var(--font-display)",
            }}>
              {total}
            </div>
            <div style={{
              width: 24, height: HEIGHT,
              display: "flex", flexDirection: "column-reverse",
              borderRadius: 3, overflow: "hidden",
              background: "var(--surface-alt)",
            }}>
              {item.series.map((s, i) => (
                <div
                  key={i}
                  title={`${s.label}: ${s.value}`}
                  style={{
                    width: "100%",
                    height: `${(s.value / max) * 100}%`,
                    background: s.color,
                    transition: "height 0.4s var(--ease-out)",
                  }}
                />
              ))}
            </div>
            <div style={{
              fontSize: 9, color: "var(--muted)", marginTop: 4,
              textAlign: "center",
            }}>
              {item.date}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div style={{
      display: "flex", justifyContent: "center", gap: 14,
      paddingTop: 12, borderTop: "1px solid var(--border-soft)",
      marginTop: 8, flexWrap: "wrap",
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 11, color: "var(--muted)",
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: 2, background: it.color,
          }} />
          {it.label}
        </div>
      ))}
    </div>
  );
}

// ADMIN-STATS-V1-FRONTEND applied

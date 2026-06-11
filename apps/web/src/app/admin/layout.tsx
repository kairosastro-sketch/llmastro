// ============================================================
// ADMIN-FOUNDATION-V1-FRONTEND
// apps/web/src/app/admin/layout.tsx
// ------------------------------------------------------------
// Layout des routes /admin/*. Redirige vers /dashboard si le
// user n'est pas admin (côté client — la sécurité réelle est
// côté API où chaque route /admin-panel/* re-check is_admin
// en DB à chaque requête).
// ============================================================

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, isAdmin, router]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto" }} />
      </div>
    );
  }
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            <div className="sidebar-brand-logo">⚙</div>
            <span className="sidebar-brand-name">Admin</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <Link
            href="/admin/users"
            className={`sidebar-link${pathname.startsWith("/admin/users") ? " active" : ""}`}
          >
            <span className="icon">👥</span>
            <span>Utilisateurs</span>
          </Link>
          <Link
            href="/admin/stats"
            className={`sidebar-link${pathname.startsWith("/admin/stats") ? " active" : ""}`}
          >
            <span className="icon">📊</span>
            <span>Stats</span>
          </Link>
          <Link
            href="/admin/affiliates"
            className={`sidebar-link${pathname.startsWith("/admin/affiliates") ? " active" : ""}`}
          >
            <span className="icon">✦</span>
            <span>Affiliés</span>
          </Link>
          <Link
            href="/admin/promos"
            className={`sidebar-link${pathname.startsWith("/admin/promos") ? " active" : ""}`}
          >
            <span className="icon">✧</span>
            <span>Codes promo</span>
          </Link>
          <Link
            href="/admin/social"
            className={`sidebar-link${pathname.startsWith("/admin/social") ? " active" : ""}`}
          >
            <span className="icon">☄</span>
            <span>Social</span>
          </Link>
          <Link
            href="/admin/horoscopes"
            className={`sidebar-link${pathname.startsWith("/admin/horoscopes") ? " active" : ""}`}
          >
            <span className="icon">☾</span>
            <span>Horoscopes presse</span>
          </Link>
        </nav>
        <div className="sidebar-footer">
          <Link
            href="/dashboard"
            className="sidebar-link"
            style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}
          >
            <span className="icon">←</span>
            <span>Retour app</span>
          </Link>
        </div>
      </aside>
      <main className="main-zone">
        <div className="content-area">
          <div className="page-root">{children}</div>
        </div>
      </main>
    </div>
  );
}

// ADMIN-FOUNDATION-V1-FRONTEND applied

// ADMIN-STATS-V1-FRONTEND applied

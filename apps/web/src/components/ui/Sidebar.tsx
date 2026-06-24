"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp, useT } from "@/lib/i18n";

const NAV_ITEMS = [
  { href: "/dashboard/horoscope",          tKey: "nav_horoscope", icon: "🔮", exploreTab: null     },
  { href: "/dashboard/transits",           tKey: "nav_transits",  icon: "↻",  exploreTab: null     },
  { href: "/dashboard/natal",              tKey: "nav_natal",     icon: "🌌", exploreTab: null     },
  { href: "/dashboard/wheel",              tKey: "nav_wheel",     icon: "◎",  exploreTab: null     },
  // ASTROCARTOGRAPHY-V1 : « Vos lieux » — outil de lieu (premium)
  { href: "/dashboard/astrocartographie",  tKey: "nav_lieux",     icon: "🗺", exploreTab: null     },
  { href: "/dashboard/explore?tab=tarot",  tKey: "nav_tarot",     icon: "🃏", exploreTab: "tarot"  },
  { href: "/dashboard/explore?tab=compat", tKey: "nav_explore",   icon: "♡",  exploreTab: "compat" },
  { href: "/dashboard/chat",               tKey: "nav_chat",      icon: "💬", exploreTab: null     },
  { href: "/dashboard/account",            tKey: "nav_account",   icon: "👤", exploreTab: null     },
  // [COMMUNITY-V1-UI] « Ta place dans le ciel collectif » — stats anonymes.
  { href: "/dashboard/communaute",         tKey: "nav_communaute", icon: "✶", exploreTab: null     },
  // [GROWTH-V1-PARRAINAGE-UI] Entrée discrète sous Account.
  // Icône ✦ pour rester dans la palette « Céleste », pas d'emoji
  // bruyant. La page elle-même éduque le user sur ce qu'il gagne.
  { href: "/dashboard/parrainage",         tKey: "nav_parrainage", icon: "✦", exploreTab: null     },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const { theme, setTheme, locale, setLocale } = useApp();
  const t = useT();
  const isActive = (href: string, exploreTab: string | null) => {
    // PATCH-MENU-NAV-V1: 3 items pointent vers /dashboard/explore avec différents
    // tabs. On utilise exploreTab pour distinguer lequel est actif.
    if (pathname.startsWith("/dashboard/explore")) {
      const currentTab = searchParams.get("tab") ?? "compat";
      if (exploreTab !== null) return exploreTab === currentTab;
      return false;
    }
    if (href.startsWith("/dashboard/horoscope")) {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/horoscope");
    }
    const hrefPath = href.split("?")[0];
    return pathname.startsWith(hrefPath);
  };

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const firstName = user?.name?.split(" ")[0] ?? null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <div className="sidebar-brand-logo">✦</div>
          <span className="sidebar-brand-name">Llmastro</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ href, tKey, icon, exploreTab }) => {
          // CONFIG-HYGIENE-V1 : fallback retiré, nav_account est maintenant
          // une vraie clé dans translations.ts.
          const label = t(tKey as any);
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-link${isActive(href, exploreTab) ? " active" : ""}`}
            >
              <span className="icon">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button
            className="tb-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? t("theme_light") : t("theme_dark")}
            style={{ flex: 1 }}
          >
            {theme === "dark" ? "☀︎" : "☾"}
          </button>
          <button
            className="tb-toggle"
            onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
            style={{ flex: 1 }}
          >
            {locale.toUpperCase()}
          </button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "9px 10px",
          borderRadius: "var(--r-md)",
          background: "var(--bg-raised)",
          border: "1px solid var(--border-soft)",
        }}>
          <Link
            href="/dashboard/account"
            title="Mon compte / My account"
            style={{
              display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0,
              textDecoration: "none", color: "inherit", cursor: "pointer",
              padding: "2px 4px", margin: "-2px -4px",
              borderRadius: "var(--r-sm)",
              transition: "background 0.18s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(229,180,69,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, color: "var(--star)", fontWeight: 500,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {firstName ?? "—"}
              </div>
              <div style={{
                fontSize: 10, color: "var(--muted)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {user?.email ?? ""}
              </div>
            </div>
          </Link>
          <button
            onClick={logout}
            title={t("logout")}
            aria-label={locale === "fr" ? "Se déconnecter" : "Sign out"}
            style={{
              fontSize: 14,
              color: "var(--gold)",
              padding: "6px 9px",
              borderRadius: "var(--r-sm)",
              background: "rgba(201,168,76,.08)",
              border: "1px solid rgba(201,168,76,.18)",
              cursor: "pointer",
              transition: "all .18s",
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(201,168,76,.18)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(201,168,76,.08)";
            }}
          >
            ⎋
          </button>
        </div>

        {/* PATCH-KAIROS-NAMING-AND-JPL-V1 : mention trust-signal JPL/NASA, discrète, toujours visible */}
        <div style={{
          marginTop: 10,
          fontSize: 9,
          lineHeight: 1.4,
          color: "var(--muted-2, #8a8598)",
          textAlign: "center",
          letterSpacing: ".2px",
          opacity: 0.75,
        }}>
          {locale === "fr"
            ? "Calculs Swiss Ephemeris · tables JPL (NASA)"
            : "Swiss Ephemeris calculations · JPL (NASA) tables"}
        </div>
      </div>
    </aside>
  );
}

// PATCH-MENU-NAV-V1 applied

// LANDING-V1 brand applied

// ACCOUNT-PAGE-V1 applied

// CONFIG-HYGIENE-V1 applied

// ADMIN-FOUNDATION-V1-FRONTEND-V2 applied

// ADMIN-FOUNDATION-V1-FRONTEND-FIX-V2 applied

// REMOVE-LEARN-TAB-V1 applied : entrée sidebar « Apprendre » retirée

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useT, useApp } from "@/lib/i18n";

// Fusion de home+horoscope → Horoscope est l'entrée principale
const NAV = [
  { href: "/dashboard/horoscope",          tKey: "nav_horoscope", ico: "🔮", exploreTab: null     },
  { href: "/dashboard/natal",              tKey: "nav_natal",     ico: "🌌", exploreTab: null     },
  { href: "/dashboard/explore?tab=tarot",  tKey: "nav_tarot",     ico: "🃏", exploreTab: "tarot"  },
  { href: "/dashboard/explore?tab=compat", tKey: "nav_explore",   ico: "♡",  exploreTab: "compat" },
  { href: "/dashboard/chat",               tKey: "nav_chat",      ico: "💬", exploreTab: null     },
  { href: "/dashboard/account",            tKey: "nav_account",   ico: "👤", exploreTab: null     },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  const searchParams = useSearchParams();
  const t = useT();
  const { locale } = useApp();
  const isActive = (href: string, exploreTab: string | null) => {
    // PATCH-MENU-NAV-V1: distinction des sous-tabs explore via query param
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

  return (
    <nav className="bottom-nav no-print" role="navigation">
      {NAV.map(({ href, tKey, ico, exploreTab }) => {
        // CONFIG-HYGIENE-V1 : fallback retiré, nav_account est maintenant
        // une vraie clé dans translations.ts ("Mon compte" / "My account").
        const label = t(tKey as any);
        return (
          <Link
            key={href}
            href={href}
            className={`bn-item${isActive(href, exploreTab) ? " active" : ""}`}
          >
            <span className="ico">{ico}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// PATCH-MENU-NAV-V1 applied

// ACCOUNT-PAGE-V1 applied

// CONFIG-HYGIENE-V1 applied

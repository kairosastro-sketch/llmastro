"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp, useT } from "@/lib/i18n";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function MobileHeader() {
  const { user } = useAuth();
  const { theme, setTheme, locale, setLocale } = useApp();
  const t = useT();

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <header className="topbar no-print">
      <Link href="/dashboard" className="tb-logo">
        {/* BRAND-MARK-V1 : mark céleste (portail doré) en remplacement du ✦ */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/llmastro-mark-transparent.svg" alt="" width={22} height={22} style={{ display: "block" }} />
        <span>Llmastro</span>
      </Link>

      <div className="tb-right">
        <button
          className="tb-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? t("theme_light") : t("theme_dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀︎" : "☾"}
        </button>
        <button
          className="tb-toggle"
          onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
          aria-label="Toggle language"
        >
          {locale.toUpperCase()}
        </button>
        {user && <NotificationBell />}
        {/* [PARRAINAGE-MOBILE-ACCESS-V1] L'avatar header devient cliquable
            vers /dashboard/account. Mêmes styles `.avatar` (cercle initiales)
            sur un <Link> au lieu d'un <div> — pattern aligné sur Sidebar.tsx
            footer desktop qui wrap déjà l'avatar dans un Link. */}
        <Link
          href="/dashboard/account"
          className="avatar"
          title={user?.name ?? (locale === "fr" ? "Mon compte" : "My account")}
          aria-label={locale === "fr" ? "Mon compte" : "My account"}
          style={{ textDecoration: "none" }}
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}

// ARCHIVE-PRICING-POLISH-V1 applied
// NOTIFICATIONS-V1-UI bell-in-header applied

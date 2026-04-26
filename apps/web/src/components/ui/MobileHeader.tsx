"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp, useT } from "@/lib/i18n";

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
        <span>✦</span>
        <span>AstroPlatform</span>
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
        <div className="avatar" title={user?.name ?? ""}>
          {initials}
        </div>
      </div>
    </header>
  );
}

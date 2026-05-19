// ============================================================
// apps/web/src/components/ciel/CielSubnav.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getT, type Locale, type TranslationKey } from "@/lib/i18n/translations";

const ITEMS: { slug: string; labelKey: TranslationKey }[] = [
  { slug: "aujourd-hui", labelKey: "ciel_nav_day" },
  { slug: "semaine",     labelKey: "ciel_nav_week" },
  { slug: "mois",        labelKey: "ciel_nav_month" },
  { slug: "annee",       labelKey: "ciel_nav_year" },
];

export function CielSubnav({ lang }: { lang: Locale }) {
  const pathname = usePathname() || "";
  const t = getT(lang);
  const base = lang === "en" ? "/en/ciel" : "/ciel";

  return (
    <nav
      aria-label={t("ciel_subnav_aria")}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        marginBottom: "2rem",
        paddingBottom: "1rem",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {ITEMS.map((item) => {
        const href = `${base}/${item.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={item.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            style={{
              padding: "0.5rem 1.1rem",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "0.95rem",
              color: active ? "var(--bg)" : "var(--gold)",
              background: active
                ? "linear-gradient(180deg, var(--gold-l), var(--gold))"
                : "transparent",
              textDecoration: "none",
              transition: "all 200ms var(--ease-out)",
            }}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

// CIEL-PUBLIC-V1-PAGES subnav applied

// CIEL-I18N-V1 CielSubnav applied

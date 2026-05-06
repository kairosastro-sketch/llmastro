// ============================================================
// apps/web/src/components/ciel/CielSubnav.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: { slug: string; label: string }[] = [
  { slug: "aujourd-hui", label: "Aujourd'hui" },
  { slug: "semaine",     label: "Cette semaine" },
  { slug: "mois",        label: "Ce mois" },
  { slug: "annee",       label: "Cette année" },
];

export function CielSubnav() {
  const pathname = usePathname() || "";

  return (
    <nav
      aria-label="Cadences du ciel"
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
        const href = `/ciel/${item.slug}`;
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// CIEL-PUBLIC-V1-PAGES subnav applied

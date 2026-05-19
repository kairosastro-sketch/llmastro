// ============================================================
// apps/web/src/components/ciel/CielFooter.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import Link from "next/link";
import { getT, type Locale } from "@/lib/i18n/translations";

export function CielFooter({ lang }: { lang: Locale }) {
  const t = getT(lang);

  return (
    <footer style={{ marginTop: "2rem", textAlign: "center" }}>
      <Link
        href="/dashboard/transits"
        className="btn-ob"
        style={{ display: "inline-block", marginBottom: "1.5rem" }}
      >
        {t("ciel_footer_cta")}
      </Link>
      <p style={{ color: "var(--muted-2)", fontSize: "0.8rem", margin: 0 }}>
        {t("ciel_footer_calc")}{" "}
        <Link
          href="/methode"
          style={{ color: "var(--muted-2)", textDecoration: "underline" }}
        >
          {t("ciel_footer_method")}
        </Link>
        {" · "}
        <Link
          href="/limites"
          style={{ color: "var(--muted-2)", textDecoration: "underline" }}
        >
          {t("ciel_footer_limits")}
        </Link>
      </p>
    </footer>
  );
}

// CIEL-PUBLIC-V1-PAGES footer applied

// CIEL-I18N-V1 CielFooter applied

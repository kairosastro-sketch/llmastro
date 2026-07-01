// ============================================================
// apps/web/src/components/ciel/CielFooter.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import Link from "next/link";
import { getT, type Locale } from "@/lib/i18n/translations";
import { TrackedCta } from "./TrackedCta"; // CIEL-CONVERSION-EVENTS-V1

export function CielFooter({ lang }: { lang: Locale }) {
  const t = getT(lang);

  return (
    <footer style={{ marginTop: "2rem", textAlign: "center" }}>
      {/* CIEL-CONVERSION-V1 : CTA final reciblé vers l'inscription (auparavant
          /dashboard/transits = mur de login pour les visiteurs anonymes). */}
      <TrackedCta
        id="ciel_footer"
        href="/auth/register"
        className="btn-ob"
        style={{ display: "inline-block", width: "auto", padding: "13px 28px", marginBottom: "1.5rem", textDecoration: "none" }}
      >
        {t("ciel_footer_cta")}
      </TrackedCta>
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

// CIEL-CONVERSION-V1 CielFooter applied

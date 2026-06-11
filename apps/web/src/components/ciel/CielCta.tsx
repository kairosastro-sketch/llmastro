// ============================================================
// apps/web/src/components/ciel/CielCta.tsx
// CIEL-CTA-V1
// ------------------------------------------------------------
// Bloc de conversion de la page publique /ciel : les posts
// sociaux (« llmastro.com/ciel ») amènent des visiteurs anonymes
// — on les invite à créer leur thème plutôt que de les laisser
// buter sur le mur de connexion du lien dashboard du footer.
// ============================================================

import Link from "next/link";
import { getT, type Locale } from "@/lib/i18n/translations";

export function CielCta({ lang }: { lang: Locale }) {
  const t = getT(lang);

  return (
    <section
      className="card"
      style={{
        padding: "2rem 1.5rem",
        marginBottom: "2rem",
        textAlign: "center",
      }}
      aria-label={t("ciel_cta_title")}
    >
      <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{t("ciel_cta_title")}</h2>
      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.95rem",
          maxWidth: 480,
          margin: "0.75rem auto 1.25rem",
          lineHeight: 1.55,
        }}
      >
        {t("ciel_cta_body")}
      </p>
      <Link href="/auth/register" className="btn-ob" style={{ display: "inline-block" }}>
        {t("ciel_cta_button")}
      </Link>
    </section>
  );
}

// CIEL-CTA-V1 applied

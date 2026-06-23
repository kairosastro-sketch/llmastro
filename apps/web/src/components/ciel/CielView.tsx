// ============================================================
// apps/web/src/components/ciel/CielView.tsx
// CIEL-I18N-V1
// ------------------------------------------------------------
// Vue mutualisée de la page publique /ciel, rendue à l'identique
// pour la route FR (/ciel/[cadence]) et la route préfixée
// (/[lang]/ciel/[cadence]). La langue est portée par l'URL.
// ============================================================

import type { Metadata } from "next";

import { fetchSky, CADENCE_TO_SLUG, type Cadence } from "@/lib/server/sky-fetch";
import { getT, type Locale, type TranslationKey } from "@/lib/i18n/translations";

import { CielHeader } from "@/components/ciel/CielHeader";
import { AspectsList } from "@/components/ciel/AspectsList";
import { EventsList } from "@/components/ciel/EventsList";
import { InterpretationCard } from "@/components/ciel/InterpretationCard";
import { CielCta } from "@/components/ciel/CielCta";
import { CielFooter } from "@/components/ciel/CielFooter";
import { EphemerisWheel } from "@/components/landing/EphemerisWheel";
import { EphemerisTable } from "@/components/landing/EphemerisTable";
import { ShareButton } from "@/components/ui/ShareButton"; // CIEL-SHARE-V1

const META_KEYS: Record<Cadence, { title: TranslationKey; desc: TranslationKey }> = {
  day:   { title: "ciel_meta_day_title",   desc: "ciel_meta_day_desc" },
  week:  { title: "ciel_meta_week_title",  desc: "ciel_meta_week_desc" },
  month: { title: "ciel_meta_month_title", desc: "ciel_meta_month_desc" },
  year:  { title: "ciel_meta_year_title",  desc: "ciel_meta_year_desc" },
};

// SEO metadata for a cadence, with hreflang alternates pointing at both
// the bare FR route and the /en-prefixed route.
export function buildCielMetadata(cadence: Cadence, lang: Locale): Metadata {
  const t = getT(lang);
  const slug = CADENCE_TO_SLUG[cadence];
  const title = t(META_KEYS[cadence].title);
  const description = t(META_KEYS[cadence].desc);
  const frPath = `/ciel/${slug}`;
  const enPath = `/en/ciel/${slug}`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: lang === "en" ? enPath : frPath,
      // x-default → version FR (langue principale du site). SEO-HREFLANG-XDEFAULT-V1
      languages: { fr: frPath, en: enPath, "x-default": frPath },
    },
    openGraph: {
      title,
      description,
      type: "article",
      locale: lang === "en" ? "en_US" : "fr_FR",
    },
  };
}

export async function CielView({ cadence, lang }: { cadence: Cadence; lang: Locale }) {
  const t = getT(lang);
  const pub = await fetchSky(cadence);

  if (!pub) {
    return (
      <div
        className="card"
        style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}
      >
        <p style={{ margin: 0, fontSize: "1.05rem" }}>{t("ciel_unavailable_title")}</p>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>{t("ciel_unavailable_body")}</p>
      </div>
    );
  }

  const {
    data,
    llmText,
    llmGeneratedAt,
    llmTextAdvanced,
    llmAdvancedGeneratedAt,
    periodStart,
    periodEnd,
  } = pub;

  return (
    <>
      <CielHeader
        cadence={cadence}
        referenceDate={data.referenceDate}
        periodStart={periodStart}
        periodEnd={periodEnd}
        moonPhase={data.moonPhase}
        lang={lang}
      />

      {/* CIEL-SHARE-V1 : partage natif de cette page publique */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
        <ShareButton
          url={`https://llmastro.com${lang === "en" ? "/en" : ""}/ciel/${CADENCE_TO_SLUG[cadence]}`}
          title="Llmastro"
          text={t(META_KEYS[cadence].title)}
          label={t("ciel_share")}
          copiedLabel={t("ciel_share_copied")}
        />
      </div>

      <section
        className="card"
        style={{ padding: "1rem", marginBottom: "2rem" }}
        aria-label={t("ciel_aria_wheel")}
      >
        <EphemerisWheel planets={data.planets} ascendant={data.asc} />
      </section>

      <section
        className="card"
        style={{ padding: "1.5rem", marginBottom: "2rem" }}
        aria-label={t("ciel_aria_positions")}
      >
        <EphemerisTable planets={data.planets} />
      </section>

      <AspectsList aspects={data.aspects} lang={lang} />

      <EventsList events={data.events} lang={lang} />

      <InterpretationCard
        llmText={llmText}
        llmGeneratedAt={llmGeneratedAt}
        llmTextAdvanced={llmTextAdvanced}
        llmAdvancedGeneratedAt={llmAdvancedGeneratedAt}
        lang={lang}
      />

      {/* CIEL-CTA-V1 : conversion des visiteurs anonymes (posts sociaux) */}
      <CielCta lang={lang} />

      <CielFooter lang={lang} />
    </>
  );
}

// CIEL-I18N-V1 CielView applied

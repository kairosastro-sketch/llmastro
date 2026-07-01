// ============================================================
// apps/web/src/components/ciel/CielView.tsx
// CIEL-I18N-V1 · CIEL-EDITORIAL-V1
// ------------------------------------------------------------
// Vue mutualisée de la page publique /ciel, rendue à l'identique
// pour la route FR (/ciel/[cadence]) et la route préfixée
// (/[lang]/ciel/[cadence]). La langue est portée par l'URL.
//
// CIEL-EDITORIAL-V1 : mise en page éditoriale « Observatoire céleste »
// — hero + grille (roue | rail Phase Lunaire + CTA) + grille données
// (positions | aspects, repliables) + événements + lecture Kairos.
// ============================================================

import type { Metadata } from "next";

import { fetchSky, CADENCE_TO_SLUG, type Cadence } from "@/lib/server/sky-fetch";
import { getT, type Locale, type TranslationKey } from "@/lib/i18n/translations";

import { CielHeader } from "@/components/ciel/CielHeader";
import { CielMoonCard } from "@/components/ciel/CielMoonCard";     // CIEL-EDITORIAL-V1
import { CielRailCta } from "@/components/ciel/CielRailCta";       // CIEL-EDITORIAL-V1
import { CielPositions } from "@/components/ciel/CielPositions";   // CIEL-EDITORIAL-V1
import { CielAspects } from "@/components/ciel/CielAspects";       // CIEL-EDITORIAL-V1
import { EventsList } from "@/components/ciel/EventsList";
import { InterpretationCard } from "@/components/ciel/InterpretationCard";
import { CielFooter } from "@/components/ciel/CielFooter";
import { CielSky3DGate } from "@/components/ciel/CielSky3DGate";   // CIEL-SKY3D-V1
import { CielHousesNote } from "@/components/ciel/CielHousesNote"; // CIEL-SKY3D-DEFAULT-V1
import { ShareButton } from "@/components/ui/ShareButton";         // CIEL-SHARE-V1
import styles from "@/components/ciel/ciel.module.css";

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

  // Date de l'instantané (= periodStart), cohérente avec le bloc date du hero.
  const positionsDate = (() => {
    try {
      return new Date(periodStart).toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      });
    } catch {
      return periodStart.slice(0, 10);
    }
  })();

  // Prochain ingrès de la Lune dans la période (pour la carte Phase Lunaire).
  const moonIngress = (() => {
    const ing = data.events?.ingresses?.find((e) => e.planet === "moon");
    return ing ? { toSign: ing.toSign, date: ing.date } : null;
  })();

  return (
    <>
      <CielHeader cadence={cadence} periodStart={periodStart} periodEnd={periodEnd} lang={lang} />

      {/* Grille haut : roue (accroche) | rail = Phase Lunaire + CTA. */}
      <div className={styles.topGrid}>
        {/* CIEL-SKY3D-DEFAULT-V1 : roue 3D animée par défaut, repli 2D dans le gate. */}
        <CielSky3DGate
          cadence={cadence}
          planets={data.planets}
          ascendant={data.asc}
          ariaLabel={t("ciel_aria_wheel")}
        />
        <div className={styles.rail}>
          <CielMoonCard
            moonPhase={data.moonPhase}
            moonLongitude={data.planets.moon?.longitude}
            ingress={moonIngress}
            lang={lang}
          />
          {/* CTA à la place de « Photo du ciel ». */}
          <CielRailCta lang={lang} />
        </div>
      </div>

      {/* CIEL-SHARE-V1 : partage natif de la page publique. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.75rem" }}>
        <ShareButton
          url={`https://llmastro.com${lang === "en" ? "/en" : ""}/ciel/${CADENCE_TO_SLUG[cadence]}`}
          title="Llmastro"
          text={t(META_KEYS[cadence].title)}
          label={t("ciel_share")}
          copiedLabel={t("ciel_share_copied")}
        />
      </div>

      {/* CIEL-EDITORIAL-V1 : lecture Kairos au niveau du partage, sous la roue. */}
      <InterpretationCard
        llmText={llmText}
        llmGeneratedAt={llmGeneratedAt}
        llmTextAdvanced={llmTextAdvanced}
        llmAdvancedGeneratedAt={llmAdvancedGeneratedAt}
        lang={lang}
      />

      {/* Note « maisons » → /auth/register. */}
      <CielHousesNote lang={lang} />

      {/* Grille données : positions | aspects (repliées top 2 + voir plus). */}
      <div className={styles.dataGrid}>
        <CielPositions planets={data.planets} date={positionsDate} lang={lang} />
        <CielAspects aspects={data.aspects} lang={lang} />
      </div>

      <EventsList events={data.events} lang={lang} />

      <CielFooter lang={lang} />
    </>
  );
}

// CIEL-I18N-V1 CielView applied

// CIEL-CONVERSION-V1 CielView applied

// CIEL-EDITORIAL-V1 CielView applied

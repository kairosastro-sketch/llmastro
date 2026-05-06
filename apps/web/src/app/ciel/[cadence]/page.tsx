// ============================================================
// apps/web/src/app/ciel/[cadence]/page.tsx
// CIEL-PUBLIC-V1-PAGES
// ------------------------------------------------------------
// Page publique dynamique pour les 4 cadences (jour/semaine/mois/an).
// Server Component + ISR `revalidate: 3600`.
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  fetchSky,
  SLUG_TO_CADENCE,
  ALL_SLUGS,
  type Cadence,
} from "@/lib/server/sky-fetch";

import { CielHeader } from "@/components/ciel/CielHeader";
import { AspectsList } from "@/components/ciel/AspectsList";
import { EventsList } from "@/components/ciel/EventsList";
import { InterpretationCard } from "@/components/ciel/InterpretationCard";
import { CielFooter } from "@/components/ciel/CielFooter";
import { EphemerisWheel } from "@/components/landing/EphemerisWheel";
import { EphemerisTable } from "@/components/landing/EphemerisTable";

// Revalidation toutes les heures
export const revalidate = 3600;

// Pré-rend les 4 cadences statiquement au build
export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ cadence: slug }));
}

// ──────────────────────────────────────────────────────────
// Metadata SEO
// ──────────────────────────────────────────────────────────

const META_BY_CADENCE: Record<Cadence, { title: string; description: string }> = {
  day: {
    title: "Le ciel aujourd'hui — éphéméride du jour",
    description:
      "Positions planétaires, lunaisons, aspects et ingrès du jour. Éphéméride calculée avec Swiss Ephemeris et JPL NASA.",
  },
  week: {
    title: "Le ciel cette semaine — éphéméride hebdomadaire",
    description:
      "Aspects, ingrès, stations rétrogrades et lunaisons de la semaine. Astrologie traçable et publique.",
  },
  month: {
    title: "Le ciel ce mois — éphéméride mensuelle",
    description:
      "Tous les événements astronomiques du mois : ingrès, lunaisons, stations rétrogrades, éclipses éventuelles.",
  },
  year: {
    title: "Le ciel cette année — éphéméride annuelle",
    description:
      "Vue panoramique de l'année astronomique : éclipses, rétrogrades, lunaisons, ingrès des planètes lentes.",
  },
};

export async function generateMetadata(
  { params }: { params: { cadence: string } },
): Promise<Metadata> {
  const cadence = SLUG_TO_CADENCE[params.cadence];
  if (!cadence) return { title: "Le ciel — Llmastro" };

  const meta = META_BY_CADENCE[cadence];
  return {
    title: meta.title,
    description: meta.description,
    robots: { index: true, follow: true },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "article",
    },
  };
}

// ──────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────

export default async function CielCadencePage(
  { params }: { params: { cadence: string } },
) {
  const cadence = SLUG_TO_CADENCE[params.cadence];
  if (!cadence) notFound();

  const pub = await fetchSky(cadence);

  if (!pub) {
    return (
      <div
        className="card"
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--muted)",
        }}
      >
        <p style={{ margin: 0, fontSize: "1.05rem" }}>
          Le ciel reste mystérieux pour l'instant.
        </p>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
          Les positions seront recalculées sous peu — reviens dans quelques minutes.
        </p>
      </div>
    );
  }

  const { data, llmText, llmGeneratedAt, periodStart, periodEnd } = pub;

  return (
    <>
      <CielHeader
        cadence={cadence}
        referenceDate={data.referenceDate}
        periodStart={periodStart}
        periodEnd={periodEnd}
        moonPhase={data.moonPhase}
      />

      <section
        className="card"
        style={{ padding: "1rem", marginBottom: "2rem" }}
        aria-label="Roue zodiacale"
      >
        <EphemerisWheel planets={data.planets} ascendant={data.asc} />
      </section>

      <section
        className="card"
        style={{ padding: "1.5rem", marginBottom: "2rem" }}
        aria-label="Positions planétaires"
      >
        <EphemerisTable planets={data.planets} />
      </section>

      <AspectsList aspects={data.aspects} />

      <EventsList events={data.events} />

      <InterpretationCard llmText={llmText} llmGeneratedAt={llmGeneratedAt} />

      <CielFooter />
    </>
  );
}

// CIEL-PUBLIC-V1-PAGES cadence-page applied

// ============================================================
// apps/web/src/app/ciel/[cadence]/page.tsx
// CIEL-PUBLIC-V1-PAGES
// ------------------------------------------------------------
// Route FR (langue par défaut, sans préfixe) pour les 4 cadences.
// La variante anglaise vit sous /en/ciel/[cadence].
// Server Component + ISR `revalidate: 3600`.
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SLUG_TO_CADENCE, ALL_SLUGS } from "@/lib/server/sky-fetch";
import { CielView, buildCielMetadata } from "@/components/ciel/CielView";
import { getT } from "@/lib/i18n/translations";

// Filet de sécurité ISR : la revalidation à la demande (revalidateTag,
// déclenchée par le backend) est le mécanisme principal. Le délai
// effectif par cadence est porté par `fetchSky` (CIEL-ISR-REVALIDATE-V1).
export const revalidate = 86400;

// Pré-rend les 4 cadences statiquement au build
export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ cadence: slug }));
}

export async function generateMetadata(
  { params }: { params: { cadence: string } },
): Promise<Metadata> {
  const cadence = SLUG_TO_CADENCE[params.cadence];
  if (!cadence) return { title: getT("fr")("ciel_meta_fallback") };
  return buildCielMetadata(cadence, "fr");
}

export default async function CielCadencePage(
  { params }: { params: { cadence: string } },
) {
  const cadence = SLUG_TO_CADENCE[params.cadence];
  if (!cadence) notFound();

  return await CielView({ cadence, lang: "fr" });
}

// CIEL-PUBLIC-V1-PAGES cadence-page applied

// CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2 cadence-page applied

// CIEL-I18N-V1 cadence-page applied

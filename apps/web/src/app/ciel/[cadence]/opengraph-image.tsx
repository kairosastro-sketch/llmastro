// CIEL-CONVERSION-V1 — OG image FR par cadence (rendu partagé, cf. lib/share/ciel-og).
import { renderCielOg, CIEL_OG_SIZE, CIEL_OG_CONTENT_TYPE, cielOgAlt } from "@/lib/share/ciel-og";
import { SLUG_TO_CADENCE, ALL_SLUGS } from "@/lib/server/sky-fetch";

export const alt = cielOgAlt("fr");
export const size = CIEL_OG_SIZE;
export const contentType = CIEL_OG_CONTENT_TYPE;

// Pré-rend les 4 cadences au build, comme la page (SSG/ISR).
export const revalidate = 86400;

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ cadence: slug }));
}

export default async function OgImage({ params }: { params: Promise<{ cadence: string }> }) {
  const { cadence } = await params;
  return renderCielOg(SLUG_TO_CADENCE[cadence] ?? "day", "fr");
}

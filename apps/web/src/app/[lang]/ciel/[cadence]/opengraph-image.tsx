// CIEL-CONVERSION-V1 — OG image EN par cadence (préfixe /en ; cf. lib/share/ciel-og).
// Seul `en` est servi sous un préfixe (le FR garde /ciel). On NE pose PAS
// `dynamicParams = false` (cf. CIEL-EN-DYNAMICPARAMS-FIX-V1 sur la page).
import { renderCielOg, CIEL_OG_SIZE, CIEL_OG_CONTENT_TYPE, cielOgAlt } from "@/lib/share/ciel-og";
import { SLUG_TO_CADENCE, ALL_SLUGS } from "@/lib/server/sky-fetch";

export const alt = cielOgAlt("en");
export const size = CIEL_OG_SIZE;
export const contentType = CIEL_OG_CONTENT_TYPE;

export const revalidate = 86400;

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ lang: "en", cadence: slug }));
}

export default async function OgImage({ params }: { params: Promise<{ lang: string; cadence: string }> }) {
  const { cadence } = await params;
  return renderCielOg(SLUG_TO_CADENCE[cadence] ?? "day", "en");
}

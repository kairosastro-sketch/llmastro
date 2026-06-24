// COMMUNITY-SHARE-OG-V1 — OG image variante préfixée par langue (/en/partage/...).
// Seul `en` est servi sous préfixe (le FR garde la route nue /partage).
import { renderPlacementOg, OG_SIZE, OG_CONTENT_TYPE, ogAlt } from "@/lib/share/placement-og";
import type { Locale } from "@/lib/i18n/translations";

export const alt = ogAlt("en");
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const locale: Locale = lang === "en" ? "en" : "fr";
  return renderPlacementOg(slug, locale);
}

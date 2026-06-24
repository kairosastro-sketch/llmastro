// COMMUNITY-SHARE-OG-V1 — OG image FR (rendu partagé, cf. lib/share/placement-og).
import { renderPlacementOg, OG_SIZE, OG_CONTENT_TYPE, ogAlt } from "@/lib/share/placement-og";

export const alt = ogAlt("fr");
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderPlacementOg(slug, "fr");
}

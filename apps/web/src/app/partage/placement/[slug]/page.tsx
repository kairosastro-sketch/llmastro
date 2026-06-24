// ============================================================
// COMMUNITY-SHARE-OG-V1 — page de partage publique FR.
// La variante EN vit sous /en/partage/placement/[slug].
// Rendu + metadata partagés (cf. components/share/PlacementShareView).
// L'OG image dynamique est dans opengraph-image.tsx (même segment).
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { parsePlacementSlug } from "@/lib/share/placement-slug";
import { PlacementShareView, buildPlacementMetadata } from "@/components/share/PlacementShareView";

export const revalidate = 86400;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  return buildPlacementMetadata(slug, "fr");
}

export default async function PlacementSharePage(
  { params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ ref?: string }>;
  },
) {
  const { slug } = await params;
  const { ref: refCode } = await searchParams;
  if (!parsePlacementSlug(slug)) notFound();
  return <PlacementShareView slug={slug} lang="fr" refCode={refCode} />;
}

// COMMUNITY-SHARE-OG-V1 page applied

// ============================================================
// COMMUNITY-SHARE-OG-V1 — page de partage publique préfixée par langue
// (/en/partage/placement/[slug]). Seul `en` est servi ; les autres
// préfixes 404 (le FR garde la route nue /partage/...).
// Rendu + metadata partagés (cf. components/share/PlacementShareView).
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { parsePlacementSlug } from "@/lib/share/placement-slug";
import { PlacementShareView, buildPlacementMetadata } from "@/components/share/PlacementShareView";
import type { Locale } from "@/lib/i18n/translations";

export const revalidate = 86400;

const PREFIXED_LOCALES: Locale[] = ["en"];
function resolveLang(raw: string): Locale | null {
  return (PREFIXED_LOCALES as string[]).includes(raw) ? (raw as Locale) : null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string; slug: string }> },
): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = resolveLang(rawLang);
  if (!lang) return {};
  return buildPlacementMetadata(slug, lang);
}

export default async function PlacementShareLangPage(
  { params, searchParams }: {
    params: Promise<{ lang: string; slug: string }>;
    searchParams: Promise<{ ref?: string }>;
  },
) {
  const { lang: rawLang, slug } = await params;
  const { ref: refCode } = await searchParams;
  const lang = resolveLang(rawLang);
  if (!lang || !parsePlacementSlug(slug)) notFound();
  return <PlacementShareView slug={slug} lang={lang} refCode={refCode} />;
}

// COMMUNITY-SHARE-OG-V1 lang-page applied

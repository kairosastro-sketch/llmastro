// ============================================================
// apps/web/src/app/[lang]/ciel/[cadence]/page.tsx
// CIEL-I18N-V1
// ------------------------------------------------------------
// Variante préfixée par langue de /ciel/[cadence] (ex. /en/ciel/...).
// Server Component + ISR `revalidate: 3600`.
// CIEL-EN-DYNAMICPARAMS-FIX-V1 : ne PAS poser `dynamicParams = false`
// ici — sous Next 16 standalone, le runtime 404ait toutes les routes
// /en/ciel/* malgré des pages pré-rendues présentes dans l'image et
// listées par le prerender-manifest (la FR, sans ce flag, servait
// normalement). Les segments inconnus (langue ou cadence) restent en
// 404 via les `notFound()` explicites ci-dessous.
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SLUG_TO_CADENCE, ALL_SLUGS } from "@/lib/server/sky-fetch";
import { CielView, buildCielMetadata } from "@/components/ciel/CielView";
import { getT, type Locale } from "@/lib/i18n/translations";

// Filet de sécurité ISR : la revalidation à la demande (revalidateTag)
// est le mécanisme principal — cf. CIEL-ISR-REVALIDATE-V1 / fetchSky.
export const revalidate = 86400;

// Seul `en` est servi sous un préfixe — le FR garde la route nue /ciel.
const PREFIXED_LOCALES: Locale[] = ["en"];

export function generateStaticParams() {
  return PREFIXED_LOCALES.flatMap((lang) =>
    ALL_SLUGS.map((slug) => ({ lang, cadence: slug })),
  );
}

function resolveLang(raw: string): Locale | null {
  return (PREFIXED_LOCALES as string[]).includes(raw) ? (raw as Locale) : null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string; cadence: string }> },
): Promise<Metadata> {
  const { lang: rawLang, cadence: rawCadence } = await params;
  const lang = resolveLang(rawLang);
  const cadence = SLUG_TO_CADENCE[rawCadence];
  if (!lang || !cadence) return { title: getT("fr")("ciel_meta_fallback") };
  return buildCielMetadata(cadence, lang);
}

export default async function CielLangCadencePage(
  { params }: { params: Promise<{ lang: string; cadence: string }> },
) {
  const { lang: rawLang, cadence: rawCadence } = await params;
  const lang = resolveLang(rawLang);
  const cadence = SLUG_TO_CADENCE[rawCadence];
  if (!lang || !cadence) notFound();

  return await CielView({ cadence, lang });
}

// CIEL-I18N-V1 lang-cadence-page applied
// CIEL-EN-DYNAMICPARAMS-FIX-V1 applied

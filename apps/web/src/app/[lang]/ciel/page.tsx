// ============================================================
// apps/web/src/app/[lang]/ciel/page.tsx
// CIEL-I18N-V1
// ------------------------------------------------------------
// /[lang]/ciel sans cadence → redirige vers la cadence du jour.
// ============================================================

import { redirect, notFound } from "next/navigation";

// Seul `en` est servi sous un préfixe de langue — le FR garde /ciel.
const PREFIXED_LOCALES = ["en"];

export default async function CielLangIndex({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!PREFIXED_LOCALES.includes(lang)) notFound();
  redirect(`/${lang}/ciel/aujourd-hui`);
}

// CIEL-I18N-V1 lang-index applied

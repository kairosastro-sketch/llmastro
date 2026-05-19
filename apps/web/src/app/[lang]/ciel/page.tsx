// ============================================================
// apps/web/src/app/[lang]/ciel/page.tsx
// CIEL-I18N-V1
// ------------------------------------------------------------
// /[lang]/ciel sans cadence → redirige vers la cadence du jour.
// ============================================================

import { redirect, notFound } from "next/navigation";

// Seul `en` est servi sous un préfixe de langue — le FR garde /ciel.
const PREFIXED_LOCALES = ["en"];

export default function CielLangIndex({ params }: { params: { lang: string } }) {
  if (!PREFIXED_LOCALES.includes(params.lang)) notFound();
  redirect(`/${params.lang}/ciel/aujourd-hui`);
}

// CIEL-I18N-V1 lang-index applied

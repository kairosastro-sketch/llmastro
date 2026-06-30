// ============================================================
// apps/web/src/app/[lang]/ciel/layout.tsx
// CIEL-I18N-V1
// ------------------------------------------------------------
// Layout des pages /ciel préfixées par langue (/en/ciel/...).
// La route FR sans préfixe vit dans app/ciel/.
// ============================================================

import { CielSubnav } from "@/components/ciel/CielSubnav";
import { CielChrome } from "@/components/ciel/CielChrome"; // CIEL-SITE-CHROME-V1
import type { Locale } from "@/lib/i18n/translations";

export default async function CielLangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: Locale = rawLang === "en" ? "en" : "fr";

  return (
    // CIEL-SITE-CHROME-V1 : voir app/ciel/layout.tsx — même chrome de site.
    <CielChrome>
      <CielSubnav lang={lang} />
      {children}
    </CielChrome>
  );
}

// CIEL-I18N-V1 lang-layout applied

// CIEL-SITE-CHROME-V1 lang-layout applied

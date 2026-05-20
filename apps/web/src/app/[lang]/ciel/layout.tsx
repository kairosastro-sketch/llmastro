// ============================================================
// apps/web/src/app/[lang]/ciel/layout.tsx
// CIEL-I18N-V1
// ------------------------------------------------------------
// Layout des pages /ciel préfixées par langue (/en/ciel/...).
// La route FR sans préfixe vit dans app/ciel/.
// ============================================================

import { CielSubnav } from "@/components/ciel/CielSubnav";
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
    <main
      style={{
        maxWidth: "min(1100px, 96vw)",
        margin: "0 auto",
        padding: "2.5rem 1rem 4rem",
      }}
    >
      <CielSubnav lang={lang} />
      {children}
    </main>
  );
}

// CIEL-I18N-V1 lang-layout applied

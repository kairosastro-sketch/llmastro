// ============================================================
// apps/web/src/components/ciel/CielHousesNote.tsx
// CIEL-SKY3D-DEFAULT-V1
// ------------------------------------------------------------
// CTA pédagogique sur l'absence des maisons astrologiques dans le
// ciel public. Auparavant imbriqué dans la roue 2D (EphemerisWheel) ;
// extrait pour rester affiché même quand la roue 3D remplace la 2D.
// Composant serveur (pas de "use client") → rendu dans le HTML SSR.
// ============================================================

import type { Locale } from "@/lib/i18n/translations";
import { TrackedCta } from "./TrackedCta"; // CIEL-CONVERSION-EVENTS-V1

export function CielHousesNote({ lang }: { lang: Locale }) {
  // L'inscription est servie sur la même route quelle que soit la langue.
  const registerHref = "/auth/register";

  return (
    <p
      style={{
        margin: "0 0 2rem",
        padding: "0.95rem 1.25rem",
        background: "var(--card-bg)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-md)",
        fontSize: "0.9rem",
        color: "var(--muted)",
        textAlign: "center",
        lineHeight: 1.6,
      }}
    >
      <span aria-hidden style={{ marginRight: "0.4em" }}>📍</span>
      {lang === "en" ? (
        <>
          Astrological houses depend on{" "}
          <strong>your birth place and time</strong>.{" "}
          <TrackedCta
            id="ciel_houses"
            href={registerHref}
            style={{ color: "var(--gold)", fontWeight: 600, textDecoration: "underline" }}
          >
            Create your birth chart to see them &rarr;
          </TrackedCta>
        </>
      ) : (
        <>
          Les maisons astrologiques d&eacute;pendent de{" "}
          <strong>votre lieu et heure de naissance</strong>.{" "}
          <TrackedCta
            id="ciel_houses"
            href={registerHref}
            style={{ color: "var(--gold)", fontWeight: 600, textDecoration: "underline" }}
          >
            Cr&eacute;ez votre th&egrave;me natal pour les voir &rarr;
          </TrackedCta>
        </>
      )}
    </p>
  );
}

// CIEL-SKY3D-DEFAULT-V1 CielHousesNote applied

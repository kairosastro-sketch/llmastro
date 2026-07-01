// ============================================================
// apps/web/src/lib/share/ciel-og.tsx
// CIEL-CONVERSION-V1 — rendu partagé de l'image Open Graph par cadence
// de la page /ciel (1200×630, esthétique « Céleste »). Utilisé par la
// route FR (/ciel/[cadence]) et EN (/[lang]/ciel/[cadence]).
//
// Contraintes satori (next/og), apprises à la dure (cf. placement-og) :
//   - tout <div> à plusieurs enfants DOIT avoir un display explicite ;
//   - glyphes spéciaux (✦, signes astrologiques ♏, tiret cadratin —,
//     point médian ·) = tofu, car la police dynamique fetchée échoue
//     hors-ligne. On s'en tient à du texte latin simple (accents OK) et
//     à la marque « Llmastro » en toutes lettres (pas de glyphe).
// ============================================================

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import type { Cadence } from "@/lib/server/sky-fetch";
import type { Locale } from "@/lib/i18n/translations";

export const CIEL_OG_SIZE = { width: 1200, height: 630 };
export const CIEL_OG_CONTENT_TYPE = "image/png";

// Labels ASCII/latin-simple par cadence (pas de glyphe spécial).
const CADENCE_LABEL: Record<Locale, Record<Cadence, string>> = {
  fr: {
    day:   "Le ciel aujourd'hui",
    week:  "Le ciel cette semaine",
    month: "Le ciel ce mois",
    year:  "Le ciel cette année",
  },
  en: {
    day:   "The sky today",
    week:  "The sky this week",
    month: "The sky this month",
    year:  "The sky this year",
  },
};

export function cielOgAlt(lang: Locale): string {
  return lang === "en" ? "The sky today — Llmastro" : "Le ciel du jour — Llmastro";
}

export async function renderCielOg(cadence: Cadence, lang: Locale): Promise<ImageResponse> {
  // Logo horizontal embarqué en data-URI (readFile au build, cwd = apps/web).
  // Absent → repli texte « Llmastro » (sans glyphe, pour éviter le tofu).
  let logoSrc: string | null = null;
  try {
    const buf = await readFile(join(process.cwd(), "public/brand/llmastro-logo.png"));
    logoSrc = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    /* repli texte ci-dessous */
  }

  const label = CADENCE_LABEL[lang][cadence];
  const tagline = lang === "en" ? "Your sky, read and explained" : "Ton ciel, lu et expliqué";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(120% 120% at 50% 0%, #241a4d 0%, #14102e 55%, #0d0a22 100%)",
          color: "#f6f3fc",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "0 80px",
        }}
      >
        {logoSrc ? (
          // logo 2400×750 (ratio 3.2) → 520×163
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} width={520} height={163} alt="" />
        ) : (
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 700,
              color: "#e6cb8e",
              letterSpacing: "-0.02em",
            }}
          >
            Llmastro
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontSize: 66,
            fontWeight: 700,
            color: "#f6f3fc",
            marginTop: 40,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "#cdbff0",
            marginTop: 22,
            lineHeight: 1.3,
            maxWidth: 900,
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    { ...CIEL_OG_SIZE },
  );
}

// CIEL-CONVERSION-V1 ciel-og applied

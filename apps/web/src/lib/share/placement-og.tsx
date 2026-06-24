// ============================================================
// COMMUNITY-SHARE-OG-V1 — rendu partagé de l'image Open Graph d'un
// placement communautaire (1200×630, esthétique « Céleste »).
// Utilisé par la route FR (/partage/...) et EN (/en/partage/...).
//
// Contraintes satori (next/og), apprises à la dure :
//   - tout <div> à plusieurs enfants DOIT avoir un display explicite →
//     enfants en chaîne unique (template literals) + display:flex partout ;
//   - glyphes non-ASCII (✦, signes ♏) = tofu (police dynamique fetchée qui
//     échoue hors-ligne) → hero = pourcentage ASCII, marque = « Llmastro »
//     en texte (pas de glyphe).
// ============================================================

import { ImageResponse } from "next/og";
import { parsePlacementSlug } from "@/lib/share/placement-slug";
import type { Locale } from "@/lib/i18n/translations";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export function ogAlt(lang: Locale): string {
  return lang === "en"
    ? "My place in the collective sky — Llmastro"
    : "Ma place dans le ciel collectif — Llmastro";
}

export function renderPlacementOg(slug: string, lang: Locale): ImageResponse {
  const p = parsePlacementSlug(slug);
  const en = lang === "en";

  const hero = p ? `${p.pct}%` : "";
  const sub = p
    ? en
      ? `share their ${p.planetLabel("en")} in ${p.signLabel("en")}`
      : `partagent leur ${p.planetLabel("fr")} en ${p.signLabel("fr")}`
    : en
      ? "Your place in the collective sky"
      : "Ta place dans le ciel collectif";

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
        {hero ? (
          <div style={{ display: "flex", fontSize: 150, fontWeight: 700, color: "#e6cb8e", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {hero}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: hero ? 46 : 64, marginTop: hero ? 18 : 0, color: hero ? "#cdbff0" : "#f6f3fc", fontWeight: hero ? 400 : 700, lineHeight: 1.3, maxWidth: 980 }}>
          {sub}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 34,
            color: "#e6cb8e",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          Llmastro
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}

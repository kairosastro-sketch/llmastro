// COMMUNITY-SHARE-OG-V1 — image Open Graph dynamique (1200×630) d'un
// placement communautaire. Même esthétique « Céleste » que l'OG racine.
// 100 % anonyme : ne lit que le slug de route (planète-signe-pct).
//
// Contraintes satori (next/og) :
//   - tout <div> à plusieurs enfants DOIT avoir un display explicite ;
//     on garde donc des enfants en chaîne unique (template literals) et on
//     met display:flex sur les conteneurs multi-enfants.
//   - les glyphes de signe (♏…) ne sont pas garantis par la police par
//     défaut (fetch de police dynamique qui échoue hors-ligne) → on met le
//     POURCENTAGE en hero (ASCII, toujours rendu), pas le glyphe.

import { ImageResponse } from "next/og";
import { parsePlacementSlug } from "@/lib/share/placement-slug";

export const alt = "Ma place dans le ciel collectif — Llmastro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = parsePlacementSlug(slug);

  const hero = p ? `${p.pct}%` : "✦";
  const sub = p
    ? `partagent leur ${p.planetLabel("fr")} en ${p.signLabel("fr")}`
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
        <div style={{ display: "flex", fontSize: 150, fontWeight: 700, color: "#e6cb8e", lineHeight: 1, letterSpacing: "-0.02em" }}>
          {hero}
        </div>
        <div style={{ display: "flex", fontSize: 46, marginTop: 18, color: "#cdbff0", lineHeight: 1.3, maxWidth: 980 }}>
          {sub}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 56,
            fontSize: 34,
            color: "#f6f3fc",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "#e6cb8e" }}>✦</span>
          <span>Llmastro</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

// COMMUNITY-SHARE-OG-V1 — image Open Graph dynamique (1200×630) d'un
// placement communautaire. Même esthétique « Céleste » que l'OG racine.
// 100 % anonyme : ne lit que le slug de route (planète-signe-pct).

import { ImageResponse } from "next/og";
import { parsePlacementSlug } from "@/lib/share/placement-slug";

export const alt = "Ma place dans le ciel collectif — Llmastro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = parsePlacementSlug(slug);

  // Repli générique si le slug est invalide.
  const pct = p?.pct ?? null;
  const signGlyph = p?.signGlyph ?? "✦";
  const planetLabel = p?.planetLabel("fr") ?? "";
  const signLabel = p?.signLabel("fr") ?? "";

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
        <div style={{ fontSize: 150, color: "#e6cb8e", lineHeight: 1 }}>{signGlyph}</div>

        {pct !== null ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 24 }}>
              <span style={{ fontSize: 110, fontWeight: 700, color: "#e6cb8e", letterSpacing: "-0.02em" }}>
                {pct}%
              </span>
            </div>
            <div style={{ fontSize: 42, marginTop: 8, color: "#cdbff0", lineHeight: 1.3 }}>
              partagent leur {planetLabel} en {signLabel}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 56, fontWeight: 700, marginTop: 24 }}>
            Ta place dans le ciel collectif
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 48,
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

// SEO-OG-IMAGE-V1
// Image Open Graph par défaut (1200×630) générée dynamiquement,
// même esthétique « Céleste » que icon.tsx / apple-icon.tsx :
// ✦ doré + wordmark sur fond nuit. Sert de fallback social pour
// toute page qui ne définit pas sa propre opengraph-image.

import { ImageResponse } from "next/og";

export const alt = "Llmastro — Ton vrai thème, pas un horoscope générique";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
        <div style={{ fontSize: 120, color: "#e6cb8e", lineHeight: 1 }}>✦</div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            marginTop: 24,
            letterSpacing: "-0.02em",
          }}
        >
          Llmastro
        </div>
        <div
          style={{
            fontSize: 36,
            marginTop: 20,
            color: "#cdbff0",
            maxWidth: 900,
            lineHeight: 1.3,
          }}
        >
          Ton vrai thème, pas un horoscope générique
        </div>
      </div>
    ),
    { ...size },
  );
}

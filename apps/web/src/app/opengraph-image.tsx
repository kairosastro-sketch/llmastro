// SEO-OG-IMAGE-V1 · BRAND-OG-V1
// Image Open Graph par défaut (1200×630) générée dynamiquement, esthétique
// « Céleste » : logo de marque (mark + wordmark) sur fond nuit. Sert de
// fallback social pour toute page qui ne définit pas sa propre opengraph-image.
// L'OG racine (sans params) est généré STATIQUEMENT au build (cwd = apps/web),
// donc le readFile ne s'exécute qu'au build ; fallback ✦ + texte si indispo.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt = "Llmastro — Un moteur d'astrologie dans la poche qui calcule la position des planètes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  // BRAND-OG-V1 : logo horizontal (mark + wordmark) embarqué en data-URI.
  let logoSrc: string | null = null;
  try {
    const buf = await readFile(join(process.cwd(), "public/brand/llmastro-logo.png"));
    logoSrc = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    /* fallback ✦ + wordmark texte ci-dessous */
  }

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
          // logo 2400×750 (ratio 3.2) → 760×238
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} width={760} height={238} alt="" />
        ) : (
          <>
            <div style={{ fontSize: 120, color: "#e6cb8e", lineHeight: 1 }}>✦</div>
            <div style={{ fontSize: 88, fontWeight: 700, marginTop: 24, letterSpacing: "-0.02em" }}>
              Llmastro
            </div>
          </>
        )}
        <div
          style={{
            fontSize: 36,
            marginTop: 28,
            color: "#cdbff0",
            maxWidth: 900,
            lineHeight: 1.3,
          }}
        >
          Un moteur d'astrologie dans la poche qui calcule la position des planètes
        </div>
      </div>
    ),
    { ...size },
  );
}

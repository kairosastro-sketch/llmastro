// PATCH-FAVICON-METADATA-V1
// Favicon généré dynamiquement par Next.js 14 App Router.
// Affiche le ✦ doré sur fond sombre, cohérent avec le logo de la sidebar.

import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 26,
          background: "#14102e",
          color: "#e6cb8e",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ✦
      </div>
    ),
    { ...size },
  );
}

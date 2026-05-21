// PATCH-FAVICON-METADATA-V1
// Apple touch icon 180×180 pour "Add to Home Screen" iOS.

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 140,
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

// ============================================================
// apps/web/src/app/robots.ts
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/ciel", "/methode", "/limites", "/bibliographie", "/pricing"],
      disallow: ["/dashboard", "/auth", "/api", "/admin"],
    },
    sitemap: "https://llmastro.com/sitemap.xml",
  };
}

// CIEL-PUBLIC-V1-PAGES robots applied

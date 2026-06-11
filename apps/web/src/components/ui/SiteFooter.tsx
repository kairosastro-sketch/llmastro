// ============================================================
// FOOTER-CENTRAL-V1 — Footer global, rendu une seule fois depuis
// le root layout (app/layout.tsx) au lieu d'être inclus à la main
// dans chaque page. Masqué sur les surfaces à chrome propre.
// ============================================================

"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/landing/Footer";

// Sections qui possèdent leur propre layout / footer et ne doivent PAS
// recevoir le footer global :
//  - dashboard : espace connecté
//  - auth      : login / register
//  - admin     : back-office
//  - ciel      : surface publique « ciel » (a son propre CielFooter),
//                y compris les variantes localisées /<lang>/ciel.
const EXCLUDED_SEGMENTS = new Set(["dashboard", "auth", "admin", "ciel"]);

export function SiteFooter() {
  const pathname = usePathname();
  const segments = (pathname ?? "/").split("/").filter(Boolean);
  if (segments.some((s) => EXCLUDED_SEGMENTS.has(s))) return null;
  return <Footer />;
}

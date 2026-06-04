// ============================================================
// LANDING-V1 — app/page.tsx
// Landing publique sur "/" :
//  - Si user loggé → redirection vers /dashboard/horoscope
//    (la redirection vit désormais DANS <LandingPage>, qui est le
//     Client Component — cf. SEO-CANONICAL-V1)
//  - Si user non loggé → affiche la landing
//
// SEO-CANONICAL-V1 : ce fichier est redevenu un Server Component
// (plus de "use client") afin de pouvoir exporter `metadata` et
// déclarer le canonical de la home.
// ============================================================

import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return <LandingPage />;
}

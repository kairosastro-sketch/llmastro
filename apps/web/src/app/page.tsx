// ============================================================
// LANDING-V1 — app/page.tsx
// Landing publique sur "/" :
//  - Accessible à tous, y compris aux utilisateurs connectés
//    (plus de redirection vers /dashboard/horoscope)
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

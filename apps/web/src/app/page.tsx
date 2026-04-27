// ============================================================
// LANDING-V1 — app/page.tsx
// Landing publique sur "/" :
//  - Si user loggé → redirection vers /dashboard/horoscope
//  - Si user non loggé → affiche la landing
// ============================================================

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { LandingPage } from "@/components/landing/LandingPage";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard/horoscope");
    }
  }, [user, isLoading, router]);

  // On affiche la landing dès le 1er render (pas de spinner intermédiaire).
  // Si user loggé : useEffect redirige juste après vers le dashboard.
  // Si user non loggé : on reste sur la landing.
  return <LandingPage />;
}

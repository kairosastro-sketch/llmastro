// ============================================================
// LANDING-V1 — LandingPage (composant racine de la landing)
// ============================================================

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { Astrocartography } from "./Astrocartography";
import { Manifeste } from "./Manifeste";
import { Promesse } from "./Promesse";
import { Features } from "./Features";
import { Apercu } from "./Apercu";
import { Trust } from "./Trust";
import { CtaFinal } from "./CtaFinal";
import { Footer } from "./Footer";
import { StarsBackground } from "@/components/ui/StarsBackground";
import styles from "./landing.module.css";

export function LandingPage() {
  // Redirection des utilisateurs déjà connectés vers leur dashboard.
  // (Déplacée depuis app/page.tsx pour que celui-ci redevienne un
  //  Server Component capable d'exporter `metadata` — cf. SEO-CANONICAL-V1.)
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard/horoscope");
    }
  }, [user, loading, router]);

  return (
    <>
      <StarsBackground count={120} />
      <div className={styles.page}>
        <Header />
        <main>
          <Hero />
          {/* ASTROCARTOGRAPHY-V1 : carte générale du jour, sous le hero */}
          <Astrocartography />
          <Manifeste />
          <Promesse />
          <Features />
          <Apercu />
          <Trust />
          <CtaFinal />
        </main>
        <Footer />
      </div>
    </>
  );
}

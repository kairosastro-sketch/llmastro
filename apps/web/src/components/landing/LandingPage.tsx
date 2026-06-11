// ============================================================
// LANDING-V1 — LandingPage (composant racine de la landing)
// ============================================================

"use client";

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
  // Plus de redirection des utilisateurs connectés : la home reste
  // accessible même une fois loggé (le Header adapte ses liens).
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

// ============================================================
// LANDING-V1 — LandingPage (composant racine de la landing)
// ============================================================

"use client";

import { Header } from "./Header";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { Apercu } from "./Apercu";
import { Trust } from "./Trust";
import { CtaFinal } from "./CtaFinal";
import { Footer } from "./Footer";
import { StarsBackground } from "@/components/ui/StarsBackground";
import styles from "./landing.module.css";

export function LandingPage() {
  return (
    <>
      <StarsBackground count={120} />
      <div className={styles.page}>
        <Header />
        <main>
          <Hero />
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

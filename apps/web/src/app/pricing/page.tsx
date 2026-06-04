// ARCHIVE-PRICING-PAGE-V2 · SEO-PRICING-SSR-V1
// Server Component : le marketing statique (hero h1 + FAQ + footer) est
// désormais rendu côté serveur → visible des crawlers. Avant, la page
// était "use client" + force-dynamic et tout le contenu vivait sous un
// <Suspense> piloté par useSearchParams : le serveur ne renvoyait que le
// skeleton (aucun h1, aucune FAQ). L'interactif (plans, searchParams,
// bannières) est isolé dans <PricingClient> (île client sous Suspense).
//
// Bonus #3 : JSON-LD FAQPage injecté côté serveur pour les rich results.
// Le titre/description/canonical de la page vivent dans pricing/layout.tsx.

import { Suspense } from "react";
import { Header as LandingHeader } from "@/components/landing/Header";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import { PricingClient } from "@/components/pricing/PricingClient";
import { FAQ_ENTRIES } from "@/components/pricing/faq-data";
import styles from "@/components/pricing/pricing.module.css";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ENTRIES.map((e) => ({
    "@type": "Question",
    name: e.q,
    acceptedAnswer: { "@type": "Answer", text: e.a },
  })),
};

export default function PricingPage() {
  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingHeader />

      <div className={styles.container}>
        <header className={styles.hero}>
          <span className={styles.heroEyebrow}>Tarifs · Sans engagement</span>
          <h1 className={styles.heroTitle}>
            Choisis <span className={styles.heroTitleAccent}>ton plan</span>
          </h1>
          <p className={styles.heroLead}>
            Découvre ton ciel à ton rythme. Change ou annule quand tu veux,
            tes données restent intactes.
          </p>
          <p className={styles.heroTrust}>
            Calculs Swiss Ephemeris · tables JPL (NASA) — précision astronomique
          </p>

          <div className={styles.heroOrnament} aria-hidden>
            <span className={styles.heroOrnamentLine} />
            <span>✦</span>
            <span className={styles.heroOrnamentLine} />
          </div>
        </header>

        {/* Île client : bannières contextuelles + grille des plans.
            Sous Suspense car PricingClient lit useSearchParams. */}
        <Suspense
          fallback={
            <div className={styles.plansGrid}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.cardSkeleton}>
                  <div className="spinner" />
                </div>
              ))}
            </div>
          }
        >
          <PricingClient />
        </Suspense>

        <PricingFAQ />

        <p className={styles.pageFooter}>
          Pas encore prêt ? Tu peux continuer à profiter du plan Découverte gratuitement.
        </p>
      </div>
    </main>
  );
}

// ARCHIVE-PRICING-PAGE-V2 applied
// SEO-PRICING-SSR-V1 applied

// ARCHIVE-PRICING-PAGE-V2
// FAQ accordéon (HTML natif <details>) — pas de JS pour l'animation,
// CSS gère tout via les pseudo-classes [open].

// SEO-PRICING-SSR-V1 : composant désormais sans état → rendu côté serveur
// (plus de "use client"). L'accordéon est en HTML natif <details>, aucun JS
// requis. Les données viennent du module partagé faq-data.ts, réutilisé par
// le JSON-LD FAQPage de /pricing.

import styles from "./pricing.module.css";
import { FAQ_ENTRIES } from "./faq-data";

export function PricingFAQ() {
  return (
    <section className={styles.faqSection} aria-labelledby="faq-title">
      <h2 id="faq-title" className={styles.faqTitle}>
        Questions fréquentes
      </h2>
      <p className={styles.faqLead}>
        Tout ce qu'il faut savoir avant de choisir ton plan.
      </p>

      <div className={styles.faqList}>
        {FAQ_ENTRIES.map((entry, idx) => (
          <details key={idx} className={styles.faqItem}>
            <summary className={styles.faqQuestion}>
              <span>{entry.q}</span>
              <span className={styles.faqQuestionMark} aria-hidden>+</span>
            </summary>
            <div className={styles.faqAnswer}>{entry.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

// ARCHIVE-PRICING-PAGE-V2
// FAQ accordéon (HTML natif <details>) — pas de JS pour l'animation,
// CSS gère tout via les pseudo-classes [open].

"use client";

import styles from "./pricing.module.css";

interface FAQEntry {
  q: string;
  a: string;
}

const FAQ_ENTRIES: FAQEntry[] = [
  {
    q: "Puis-je changer de plan plus tard ?",
    a: "Oui, à tout moment. Tu peux passer de Découverte à Essentiel, ou inversement, et tes données restent intactes. Le pro-rata est appliqué automatiquement au prochain renouvellement.",
  },
  {
    q: "Comment fonctionne l'essai gratuit ?",
    a: "Tous les nouveaux comptes bénéficient de 7 jours d'accès complet à Essentiel à la création. Aucun moyen de paiement n'est demandé pour démarrer. À l'issue, tu repasses automatiquement sur Découverte (gratuit) si tu n'as pas activé ton abonnement.",
  },
  {
    q: "Puis-je annuler quand je veux ?",
    a: "Bien sûr. Pas d'engagement, pas de pénalité. Si tu annules, tu gardes l'accès à Essentiel jusqu'à la fin de la période payée, puis tu repasses sur Découverte.",
  },
  {
    q: "Comment sont calculés mes thèmes natals ?",
    a: "Llmastro utilise les Swiss Ephemeris combinées aux tables JPL de la NASA. La précision est astronomique au sens littéral : tes positions planétaires sont les mêmes que celles utilisées par les observatoires.",
  },
  {
    q: "Mes données sont-elles privées ?",
    a: "Oui. Tes données natales et tes lectures ne sont jamais vendues ni partagées. Tu peux les exporter (RGPD) ou supprimer ton compte à tout moment depuis les réglages.",
  },
  {
    q: "Quand le plan Pro sera-t-il disponible ?",
    a: "Le plan Pro est en soft-launch — il s'adresse aux astrologues professionnels, formateurs ou cabinets. Si tu es intéressé, contacte-nous à pro@llmastro.com pour discuter de ton usage et obtenir un tarif sur mesure.",
  },
];

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

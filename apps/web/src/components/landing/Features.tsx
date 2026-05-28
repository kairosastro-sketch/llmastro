// ============================================================
// LANDING — Section Features (grille 6 cartes)
// Reprend la grille de la maquette « Céleste » : 6 surfaces produit.
// Remplace l'ancienne section Promesse (3 colonnes) dans la landing.
// ============================================================

import { useT } from "@/lib/i18n";
import { RevealOnScroll } from "./RevealOnScroll";
import styles from "./landing.module.css";

const CARDS = [
  { icon: "☉", titleKey: "landing_features_card1_title", textKey: "landing_features_card1_text" },
  { icon: "✶", titleKey: "landing_features_card2_title", textKey: "landing_features_card2_text" },
  { icon: "♆", titleKey: "landing_features_card3_title", textKey: "landing_features_card3_text" },
  { icon: "♀", titleKey: "landing_features_card4_title", textKey: "landing_features_card4_text" },
  { icon: "☾", titleKey: "landing_features_card5_title", textKey: "landing_features_card5_text" },
  { icon: "✦", titleKey: "landing_features_card6_title", textKey: "landing_features_card6_text" },
];

export function Features() {
  const t = useT();

  return (
    <section className={`${styles.section} ${styles.features}`}>
      <RevealOnScroll>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>
            {t("landing_features_eyebrow" as any)}
          </p>
          <h2 className={styles.sectionTitle}>
            {t("landing_features_title" as any)}
          </h2>
          <p className={styles.featuresSubtitle}>
            {t("landing_features_subtitle" as any)}
          </p>
        </div>
      </RevealOnScroll>

      <div className={styles.featuresGrid}>
        {CARDS.map((card, i) => (
          <RevealOnScroll key={card.titleKey} delay={(i % 3) * 100}>
            <article className={styles.featureCard}>
              <span className={styles.featureIco} aria-hidden="true">
                {card.icon}
              </span>
              <h3 className={styles.featureTitle}>{t(card.titleKey as any)}</h3>
              <p className={styles.featureText}>{t(card.textKey as any)}</p>
            </article>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}

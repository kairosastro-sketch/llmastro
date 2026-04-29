// ARCHIVE-PRICING-PAGE-V2
// Placeholder visuel pour la saisie d'un code promo.
// Branchement réel sur l'API en archive 3 (ARCHIVE-PROMO-CODES-V1).

"use client";

import { useState } from "react";
import styles from "./pricing.module.css";

export function PromoCodeInput() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    // Placeholder : pas de backend pour l'instant. Les codes promo seront
    // branchés en archive 3 (ARCHIVE-PROMO-CODES-V1).
    setMessage(
      "Les codes promo seront bientôt disponibles. Reviens dans quelques jours !"
    );
    setCode("");
  };

  return (
    <section className={styles.promoSection} aria-labelledby="promo-title">
      <h3 id="promo-title" className={styles.promoTitle}>
        ✦ Tu as un code promo ?
      </h3>

      <form className={styles.promoForm} onSubmit={handleSubmit}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ex : WELCOME26"
          maxLength={32}
          className={styles.promoInput}
          aria-label="Code promo"
        />
        <button
          type="submit"
          className={styles.promoBtn}
          disabled={!code.trim()}
        >
          Vérifier
        </button>
      </form>

      {message ? (
        <div className={`${styles.promoMessage} ${styles.promoMessageInfo}`} role="status">
          {message}
        </div>
      ) : (
        <p className={styles.promoHint}>
          Le code s'applique à ton plan au prochain renouvellement.
        </p>
      )}
    </section>
  );
}

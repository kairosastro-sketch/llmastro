// ============================================================
// numerology.ts — Chemin de vie (numérologie pythagoricienne)
// ------------------------------------------------------------
// NUMEROLOGY-MODULE-V1 : extrait de service.ts (STAB-PRE-5-V1).
// Seule implémentation du chemin de vie dans le codebase — la
// variante dépréciée de astro-engine.ts::computeChart() (somme de
// tous les chiffres d'un coup, résultats différents pour certaines
// dates) a été supprimée et remplacée par un appel à ce module.
//
// Convention (méthode pythagoricienne la plus courante, cf.
// CALCULS.md §7.6) : on réduit jour/mois/année SÉPARÉMENT à un
// chiffre, puis on somme, puis réduction finale en préservant les
// nombres maîtres 11/22/33 — dans le résultat final uniquement.
//
// Le chemin de vie dépend de la date LOCALE de naissance, jamais
// de la date UTC (une naissance le 1er à 00h30 locale peut être
// le 31 en UTC).
// ============================================================

/**
 * Chemin de vie depuis une date locale "YYYY-MM-DD".
 * Retourne 0 si la date est malformée (jamais throw : la
 * numérologie est un enrichissement, pas une donnée critique).
 */
export function computeLifePath(localBirthDate: string): number {
  function reduceToDigit(n: number): number {
    while (n > 9) {
      n = String(n).split("").reduce((s, c) => s + Number(c), 0);
    }
    return n;
  }
  function reducePreserveMasters(n: number): number {
    while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
      n = String(n).split("").reduce((s, c) => s + Number(c), 0);
    }
    return n;
  }
  try {
    const m = (localBirthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return 0;
    const year  = Number(m[1]);
    const month = Number(m[2]);
    const day   = Number(m[3]);
    return reducePreserveMasters(reduceToDigit(day) + reduceToDigit(month) + reduceToDigit(year));
  } catch { return 0; }
}

// NUMEROLOGY-MODULE-V1 applied

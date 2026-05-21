// ============================================================
// ARCHIVE-BIBLIOGRAPHY-V1 — astro-sources.ts
// ------------------------------------------------------------
// Base de données des références bibliographiques utilisées
// par Llmastro, et mappings d'attribution par planète/aspect.
//
// Utilisé par :
//   - /bibliographie (page publique) pour lister les sources
//   - <SourceAttribution /> sur les lectures Kairos pour
//     afficher discrètement quelles traditions ont nourri la
//     lecture (par planète et type d'aspect concernés).
// ============================================================

export type SchoolKey =
  | "psychological"   // Greene, Sasportas, Arroyo
  | "archetypal"      // Hand, Tarnas, Rudhyar
  | "traditional"     // Lilly, Ebertin, technique avancée
  | "humanist";       // Rudhyar, approche existentielle

export interface Reference {
  /** Identifiant stable */
  id: string;
  /** Nom de l'auteur */
  author: string;
  /** Titre de l'ouvrage clé */
  title: string;
  /** Année de publication */
  year: number;
  /** École / courant astrologique */
  school: SchoolKey;
  /** Apport en 1-2 phrases */
  contribution: string;
  /** Nationalité / contexte (optionnel) */
  context?: string;
}

// ──────────────────────────────────────────────────────────
// Le corpus
// ──────────────────────────────────────────────────────────

export const REFERENCES: Reference[] = [
  // ── ÉCOLE PSYCHOLOGIQUE MODERNE ──
  {
    id: "greene-saturn-1976",
    author: "Liz Greene",
    title: "Saturn: A New Look at an Old Devil",
    year: 1976,
    school: "psychological",
    contribution:
      "Réhabilitation de Saturne comme principe d'individuation jungien. Texte fondateur de l'astrologie psychologique anglo-saxonne.",
    context: "Royaume-Uni, école Jung",
  },
  {
    id: "sasportas-houses-1985",
    author: "Howard Sasportas",
    title: "The Twelve Houses",
    year: 1985,
    school: "psychological",
    contribution:
      "Lecture détaillée du symbolisme des douze maisons. Référence sur l'expression existentielle des aspects.",
    context: "Royaume-Uni, école humaniste",
  },
  {
    id: "arroyo-elements-1975",
    author: "Stephen Arroyo",
    title: "Astrology, Psychology, and the Four Elements",
    year: 1975,
    school: "psychological",
    contribution:
      "Cadre élémentaire (feu, terre, air, eau) appliqué systématiquement à la dynamique psychologique du thème.",
    context: "États-Unis",
  },
  {
    id: "greene-relating-1977",
    author: "Liz Greene",
    title: "Relating: An Astrological Guide to Living with Others",
    year: 1977,
    school: "psychological",
    contribution:
      "Approche profonde de la synastrie et des aspects relationnels. Référence sur Vénus, Mars, et la composante interpersonnelle.",
  },

  // ── ÉCOLE ARCHÉTYPALE / SYMBOLIQUE ──
  {
    id: "hand-symbols-1981",
    author: "Robert Hand",
    title: "Horoscope Symbols",
    year: 1981,
    school: "archetypal",
    contribution:
      "Référence sur les significations symboliques des planètes et aspects. Synthèse rigoureuse du langage astrologique occidental.",
    context: "États-Unis, érudit",
  },
  {
    id: "tarnas-cosmos-2006",
    author: "Richard Tarnas",
    title: "Cosmos and Psyche",
    year: 2006,
    school: "archetypal",
    contribution:
      "Étude des cycles planétaires lents (Uranus, Neptune, Pluton) corrélés aux mouvements collectifs historiques.",
    context: "États-Unis, philosophie",
  },
  {
    id: "rudhyar-mandala-1973",
    author: "Dane Rudhyar",
    title: "An Astrological Mandala",
    year: 1973,
    school: "archetypal",
    contribution:
      "Astrologie humaniste centrée sur le développement de la conscience individuelle. Référence sur les degrés sabiens.",
    context: "France/États-Unis, philosophe",
  },
  {
    id: "rudhyar-person-1936",
    author: "Dane Rudhyar",
    title: "The Astrology of Personality",
    year: 1936,
    school: "humanist",
    contribution:
      "Texte fondateur de l'astrologie humaniste moderne. Réorientation de l'astrologie de la prédiction vers l'individuation.",
  },

  // ── TECHNIQUE / TRADITIONNELLE ──
  {
    id: "ebertin-stellar-1940",
    author: "Reinhold Ebertin",
    title: "The Combination of Stellar Influences",
    year: 1940,
    school: "traditional",
    contribution:
      "Ouvrage technique de référence sur les configurations à trois planètes (mid-points). Tradition cosmobiologique allemande.",
    context: "Allemagne, école Hambourg",
  },
  {
    id: "hand-night-2005",
    author: "Robert Hand",
    title: "Night & Day: Planetary Sect in Astrology",
    year: 2005,
    school: "traditional",
    contribution:
      "Restauration de la doctrine traditionnelle des sectes (diurne/nocturne) issue de l'astrologie hellénistique.",
  },
  {
    id: "brady-fixed-stars-1998",
    author: "Bernadette Brady",
    title: "Brady's Book of Fixed Stars",
    year: 1998,
    school: "traditional",
    contribution:
      "Étude approfondie des étoiles fixes et de leurs paranatellons. Référence sur les fonds étoilés du thème.",
    context: "Australie",
  },
  {
    id: "hand-planets-1981",
    author: "Robert Hand",
    title: "Planets in Composite",
    year: 1975,
    school: "traditional",
    contribution:
      "Méthode de calcul et d'interprétation des thèmes composites (synastrie avancée).",
  },

  // ── HUMANISTE / EXISTENTIELLE ──
  {
    id: "rudhyar-person-1973",
    author: "Dane Rudhyar",
    title: "The Practice of Astrology",
    year: 1968,
    school: "humanist",
    contribution:
      "Approche pratique et éthique de l'astrologie comme outil de croissance personnelle.",
  },
  {
    id: "greene-fate-1984",
    author: "Liz Greene",
    title: "The Astrology of Fate",
    year: 1984,
    school: "psychological",
    contribution:
      "Examen de la tension entre déterminisme astrologique et libre arbitre. Lecture des nœuds lunaires et de Pluton.",
  },
];

// ──────────────────────────────────────────────────────────
// Labels d'école pour affichage
// ──────────────────────────────────────────────────────────

export const SCHOOL_LABELS_FR: Record<SchoolKey, string> = {
  psychological: "Astrologie psychologique",
  archetypal: "Approche archétypale",
  traditional: "Tradition technique",
  humanist: "Astrologie humaniste",
};

export const SCHOOL_DESCRIPTIONS_FR: Record<SchoolKey, string> = {
  psychological:
    "Issue du courant jungien, cette école lit le thème comme une cartographie de l'inconscient et du processus d'individuation.",
  archetypal:
    "Centre la lecture sur les archétypes universels et les correspondances symboliques. Souvent érudite et synthétique.",
  traditional:
    "S'appuie sur les techniques héritées de l'astrologie hellénistique, médiévale et moderne (mid-points, sectes, étoiles fixes).",
  humanist:
    "Approche existentielle qui place l'individu au centre — le thème est un outil de devenir, pas un destin figé.",
};

// ──────────────────────────────────────────────────────────
// Mappings d'attribution
// ──────────────────────────────────────────────────────────

/**
 * Pour chaque planète, les références qui l'éclairent particulièrement.
 * Utilisé par <SourceAttribution> pour afficher les sources pertinentes
 * à une lecture donnée.
 */
export const SOURCES_BY_PLANET: Record<string, string[]> = {
  sun: ["hand-symbols-1981", "rudhyar-person-1936", "arroyo-elements-1975"],
  moon: ["greene-fate-1984", "sasportas-houses-1985", "arroyo-elements-1975"],
  mercury: ["hand-symbols-1981", "sasportas-houses-1985"],
  venus: ["greene-relating-1977", "hand-symbols-1981", "arroyo-elements-1975"],
  mars: ["greene-relating-1977", "hand-symbols-1981"],
  jupiter: ["sasportas-houses-1985", "hand-symbols-1981"],
  saturn: ["greene-saturn-1976", "hand-symbols-1981", "sasportas-houses-1985"],
  uranus: ["tarnas-cosmos-2006", "rudhyar-mandala-1973"],
  neptune: ["tarnas-cosmos-2006", "rudhyar-mandala-1973", "greene-fate-1984"],
  pluto: ["tarnas-cosmos-2006", "greene-fate-1984"],
  northnode: ["greene-fate-1984", "rudhyar-mandala-1973"],
  southnode: ["greene-fate-1984", "rudhyar-mandala-1973"],
  chiron: ["sasportas-houses-1985"],
  lilith: ["greene-fate-1984"],
};

/**
 * Pour chaque type d'aspect, les références qui en théorisent
 * particulièrement la dynamique.
 */
export const SOURCES_BY_ASPECT: Record<string, string[]> = {
  conjunction: ["hand-symbols-1981", "ebertin-stellar-1940"],
  opposition: ["hand-symbols-1981", "greene-relating-1977"],
  square: ["hand-symbols-1981", "greene-saturn-1976"],
  trine: ["hand-symbols-1981", "arroyo-elements-1975"],
  sextile: ["hand-symbols-1981", "arroyo-elements-1975"],
  quincunx: ["hand-symbols-1981", "ebertin-stellar-1940"],
  // ASPECTS-MINEURS-V1 — Ebertin (Combination of Stellar Influences, 1940)
  // est la référence technique de fond sur les aspects mineurs.
  semisextile: ["hand-symbols-1981", "ebertin-stellar-1940"],
  semisquare: ["hand-symbols-1981", "ebertin-stellar-1940"],
  sesquiquadrate: ["hand-symbols-1981", "ebertin-stellar-1940"],
  quintile: ["hand-symbols-1981", "ebertin-stellar-1940"],
};

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

export function getReference(id: string): Reference | undefined {
  return REFERENCES.find((r) => r.id === id);
}

/**
 * Retourne les références pertinentes pour une lecture donnée,
 * dédupliquées et limitées au top N par fréquence d'apparition.
 *
 * @param planets clés en lower (ex. ["sun", "moon"])
 * @param aspectTypes ex. ["conjunction", "trine"]
 * @param max nombre max de références à retourner
 */
export function getRelevantReferences(
  planets: string[],
  aspectTypes: string[],
  max: number = 4,
): Reference[] {
  const counts: Record<string, number> = {};

  for (const p of planets) {
    const key = p.toLowerCase();
    const ids = SOURCES_BY_PLANET[key] ?? [];
    for (const id of ids) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }

  for (const a of aspectTypes) {
    const key = a.toLowerCase();
    const ids = SOURCES_BY_ASPECT[key] ?? [];
    for (const id of ids) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }

  // Tri par score décroissant, puis par année (plus ancien d'abord = plus fondateur)
  const sortedIds = Object.entries(counts)
    .sort(([idA, scoreA], [idB, scoreB]) => {
      if (scoreB !== scoreA) return scoreB - scoreA;
      const refA = getReference(idA);
      const refB = getReference(idB);
      return (refA?.year ?? 9999) - (refB?.year ?? 9999);
    })
    .slice(0, max)
    .map(([id]) => id);

  return sortedIds
    .map((id) => getReference(id))
    .filter((r): r is Reference => r !== undefined);
}

/**
 * Formattage court d'une référence pour affichage discret en footer
 * d'une lecture : "Hand (1981)", "Greene (1976)".
 */
export function formatReferenceShort(ref: Reference): string {
  // Si plusieurs auteurs, prendre le nom de famille
  const lastName = ref.author.split(" ").slice(-1)[0] ?? ref.author;
  return `${lastName} (${ref.year})`;
}

// ARCHIVE-BIBLIOGRAPHY-V1 applied

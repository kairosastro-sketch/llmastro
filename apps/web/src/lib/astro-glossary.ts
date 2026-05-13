// ============================================================
// PATCH-ASTRO-TOOLTIPS-V1
// Glossaire bilingue des aspects astrologiques et planètes.
// Format optimisé pour title HTML natif (sauts de ligne via \n).
// ============================================================

export interface GlossaryEntry {
  fr: string;
  en: string;
}

// ────────────────────────────────────────────────────────────
// ASPECTS MAJEURS (5)
// ────────────────────────────────────────────────────────────
const ASPECTS_MAJORS: Record<string, GlossaryEntry> = {
  // FR
  Conjonction: {
    fr: "Conjonction (0°)\nDeux planètes au même endroit du ciel.\nFusion d'énergies — intensité, parfois confusion.",
    en: "Conjunction (0°)\nTwo planets at the same point in the sky.\nMerged energies — intensity, sometimes confusion.",
  },
  Sextile: {
    fr: "Sextile (60°)\nAspect harmonieux entre deux planètes.\nOpportunités fluides, énergies qui collaborent.",
    en: "Sextile (60°)\nHarmonious aspect between two planets.\nSmooth opportunities, energies that collaborate.",
  },
  Carré: {
    fr: "Carré (90°)\nAspect de tension entre deux planètes.\nFriction créatrice — pousse à l'action et à la croissance.",
    en: "Square (90°)\nTension aspect between two planets.\nCreative friction — pushes toward action and growth.",
  },
  Trigone: {
    fr: "Trigone (120°)\nLe plus harmonieux des aspects.\nCirculation fluide, talents naturels qui s'expriment.",
    en: "Trine (120°)\nThe most harmonious aspect.\nFlowing circulation, natural talents that express themselves.",
  },
  Opposition: {
    fr: "Opposition (180°)\nDeux planètes face-à-face dans le ciel.\nPolarité à intégrer — équilibre entre deux pôles.",
    en: "Opposition (180°)\nTwo planets face-to-face in the sky.\nPolarity to integrate — balance between two poles.",
  },
  // EN equivalents
  Conjunction: {
    fr: "Conjunction (0°)\nTwo planets at the same point in the sky.\nMerged energies — intensity, sometimes confusion.",
    en: "Conjunction (0°)\nTwo planets at the same point in the sky.\nMerged energies — intensity, sometimes confusion.",
  },
  Square: {
    fr: "Square (90°)\nTension aspect between two planets.\nCreative friction — pushes toward action and growth.",
    en: "Square (90°)\nTension aspect between two planets.\nCreative friction — pushes toward action and growth.",
  },
  Trine: {
    fr: "Trine (120°)\nThe most harmonious aspect.\nFlowing circulation, natural talents that express themselves.",
    en: "Trine (120°)\nThe most harmonious aspect.\nFlowing circulation, natural talents that express themselves.",
  },
};

// ────────────────────────────────────────────────────────────
// ASPECTS MINEURS (3)
// ────────────────────────────────────────────────────────────
const ASPECTS_MINORS: Record<string, GlossaryEntry> = {
  Quinconce: {
    fr: "Quinconce (150°)\nAspect mineur d'ajustement.\nRequiert un effort conscient d'intégration entre deux planètes étrangères.",
    en: "Quincunx (150°)\nMinor aspect of adjustment.\nRequires conscious integration between two foreign planets.",
  },
  Quincunx: {
    fr: "Quincunx (150°)\nMinor aspect of adjustment.\nRequires conscious integration between two foreign planets.",
    en: "Quincunx (150°)\nMinor aspect of adjustment.\nRequires conscious integration between two foreign planets.",
  },
  "Semi-carré": {
    fr: "Semi-carré (45°)\nDemi-tension d'un carré.\nIrritation discrète, friction à intégrer.",
    en: "Semi-square (45°)\nHalf-tension of a square.\nDiscreet irritation, friction to integrate.",
  },
  "Semi-square": {
    fr: "Semi-square (45°)\nHalf-tension of a square.\nDiscreet irritation, friction to integrate.",
    en: "Semi-square (45°)\nHalf-tension of a square.\nDiscreet irritation, friction to integrate.",
  },
  Sesquicarré: {
    fr: "Sesquicarré (135°)\nUne fois et demi un carré.\nTension cumulative qui demande une décision.",
    en: "Sesquiquadrate (135°)\nOne and a half square.\nCumulative tension that demands a decision.",
  },
};

// ────────────────────────────────────────────────────────────
// PLANÈTES TRADITIONNELLES (7) + LENTES (3)
// ────────────────────────────────────────────────────────────
const PLANETS: Record<string, GlossaryEntry> = {
  // FR
  Soleil: {
    fr: "Soleil ☉\nIdentité profonde, vitalité, élan vital.\nCe que tu cherches à incarner dans ta vie.",
    en: "Sun ☉\nDeep identity, vitality, life force.\nWhat you seek to embody in your life.",
  },
  Lune: {
    fr: "Lune ☽\nMonde émotionnel, intuition, mémoire.\nCe qui t'apaise, ce qui te ressource.",
    en: "Moon ☽\nEmotional world, intuition, memory.\nWhat soothes you, what restores you.",
  },
  Mercure: {
    fr: "Mercure ☿\nPensée, communication, apprentissage.\nComment tu traites l'information et exprimes tes idées.",
    en: "Mercury ☿\nThought, communication, learning.\nHow you process information and express ideas.",
  },
  Vénus: {
    fr: "Vénus ♀\nAmour, esthétique, valeurs.\nCe que tu trouves beau, ce que tu cherches en relation.",
    en: "Venus ♀\nLove, aesthetics, values.\nWhat you find beautiful, what you seek in relationships.",
  },
  Mars: {
    fr: "Mars ♂\nAction, désir, courage, colère.\nComment tu vas vers ce que tu veux, comment tu défends ton territoire.",
    en: "Mars ♂\nAction, desire, courage, anger.\nHow you go toward what you want, how you defend your space.",
  },
  Jupiter: {
    fr: "Jupiter ♃\nExpansion, confiance, philosophie, voyage.\nLà où tu trouves du sens et où tu fais confiance à la vie.",
    en: "Jupiter ♃\nExpansion, trust, philosophy, travel.\nWhere you find meaning and trust life.",
  },
  Saturne: {
    fr: "Saturne ♄\nStructure, responsabilité, limites, maîtrise.\nLà où tu construis lentement, par le travail et la patience.",
    en: "Saturn ♄\nStructure, responsibility, limits, mastery.\nWhere you build slowly, through work and patience.",
  },
  Uranus: {
    fr: "Uranus ♅\nRupture, liberté, originalité, révolution.\nLà où tu refuses le conformisme et cherches ta voie.",
    en: "Uranus ♅\nDisruption, freedom, originality, revolution.\nWhere you refuse conformity and seek your own path.",
  },
  Neptune: {
    fr: "Neptune ♆\nRêve, idéal, spiritualité, dissolution.\nLà où tu te connectes à plus grand que toi, au risque de te perdre.",
    en: "Neptune ♆\nDream, ideal, spirituality, dissolution.\nWhere you connect to something bigger, at the risk of losing yourself.",
  },
  Pluton: {
    fr: "Pluton ♇\nTransformation, pouvoir, ombre, renaissance.\nLà où tu meurs et renais — ce qui te change en profondeur.",
    en: "Pluto ♇\nTransformation, power, shadow, rebirth.\nWhere you die and are reborn — what changes you deeply.",
  },
  // EN equivalents
  Sun: {
    fr: "Sun ☉\nDeep identity, vitality, life force.\nWhat you seek to embody in your life.",
    en: "Sun ☉\nDeep identity, vitality, life force.\nWhat you seek to embody in your life.",
  },
  Moon: {
    fr: "Moon ☽\nEmotional world, intuition, memory.\nWhat soothes you, what restores you.",
    en: "Moon ☽\nEmotional world, intuition, memory.\nWhat soothes you, what restores you.",
  },
  Mercury: {
    fr: "Mercury ☿\nThought, communication, learning.\nHow you process information and express ideas.",
    en: "Mercury ☿\nThought, communication, learning.\nHow you process information and express ideas.",
  },
  Venus: {
    fr: "Venus ♀\nLove, aesthetics, values.\nWhat you find beautiful, what you seek in relationships.",
    en: "Venus ♀\nLove, aesthetics, values.\nWhat you find beautiful, what you seek in relationships.",
  },
  Saturn: {
    fr: "Saturn ♄\nStructure, responsibility, limits, mastery.\nWhere you build slowly, through work and patience.",
    en: "Saturn ♄\nStructure, responsibility, limits, mastery.\nWhere you build slowly, through work and patience.",
  },
  Pluto: {
    fr: "Pluto ♇\nTransformation, power, shadow, rebirth.\nWhere you die and are reborn — what changes you deeply.",
    en: "Pluto ♇\nTransformation, power, shadow, rebirth.\nWhere you die and are reborn — what changes you deeply.",
  },
  // LILITH-V1 : point géométrique (apogée de l'orbite lunaire moyen)
  // — pas un astre. Symbolise l'archétype féminin sauvage / rebelle.
  Lilith: {
    fr: "Lilith ⚸\nLune noire, point d'apogée lunaire moyen.\nL'archétype rebelle, instinct sauvage, ce que tu refuses de domestiquer en toi.",
    en: "Lilith ⚸\nBlack Moon, mean lunar apogee.\nThe rebellious archetype, wild instinct, what you refuse to tame in yourself.",
  },
};

// ────────────────────────────────────────────────────────────
// EXPORT FUSIONNÉ
// ────────────────────────────────────────────────────────────
export const ASTRO_GLOSSARY: Record<string, GlossaryEntry> = {
  ...ASPECTS_MAJORS,
  ...ASPECTS_MINORS,
  ...PLANETS,
};

// Liste des termes triée par longueur décroissante (pour matcher
// les expressions composées avant les mots simples — utile si on
// ajoute "Cancer Lune" ou "Lune noire" plus tard).
export const ASTRO_TERMS_SORTED = Object.keys(ASTRO_GLOSSARY)
  .sort((a, b) => b.length - a.length);

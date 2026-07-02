// ============================================================
// apps/web/src/lib/astro/house-names.ts
// SKY3D-ASTRO-READ-V1
// ------------------------------------------------------------
// Noms, mots-clés et numérotation des 12 maisons astrologiques,
// extraits en module partagé (wording aligné sur ZodiacWheel).
// Consommé par la roue 3D (ThemeSky3D) ; ZodiacWheel et la page
// transits gardent leurs constantes locales historiques — les y
// migrer est un chantier de dédoublonnage séparé.
// ============================================================

export const ROMAN = [
  "I", "II", "III", "IV", "V", "VI",
  "VII", "VIII", "IX", "X", "XI", "XII",
];

export const HOUSE_NAMES_FR = [
  "Soi", "Ressources", "Communication", "Foyer",
  "Créativité", "Santé", "Relations", "Transformation",
  "Philosophie", "Carrière", "Amitiés", "Intériorité",
];

export const HOUSE_NAMES_EN = [
  "Self", "Resources", "Communication", "Home",
  "Creativity", "Health", "Partnerships", "Transformation",
  "Philosophy", "Career", "Friendships", "Inner life",
];

export const HOUSE_KEYWORDS_FR = [
  "Identité et apparence",
  "Biens, argent, valeurs",
  "Pensée, fratrie, voisinage",
  "Origines, foyer, intimité",
  "Créations, enfants, plaisir",
  "Travail quotidien, santé",
  "Couple, contrats, autres",
  "Crises, ressources partagées",
  "Voyages, sens, études",
  "Vocation, image publique",
  "Amis, projets, communauté",
  "Retrait, inconscient, rêves",
];

export const HOUSE_KEYWORDS_EN = [
  "Identity, appearance",
  "Assets, money, values",
  "Mind, siblings, neighbors",
  "Roots, home, intimacy",
  "Creations, children, pleasure",
  "Daily work, health",
  "Partnership, contracts",
  "Crises, shared resources",
  "Travel, meaning, studies",
  "Vocation, public image",
  "Friends, projects, community",
  "Seclusion, unconscious, dreams",
];

// SKY3D-ASTRO-READ-V1 applied

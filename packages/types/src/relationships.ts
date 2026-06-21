// ============================================================
// RELATIONSHIPS-V1 — Taxonomie partagée des relations
// ------------------------------------------------------------
// Source unique (API + web) pour le tag relationnel d'un profil
// natal : catégorie (amoureuse / familiale / pro / amicale) +
// sous-type. La catégorie pilote l'astrologie (dimensions de
// synastrie, cadrage des lectures) ; le sous-type sert surtout
// au ton/contexte des prompts et à l'affichage.
// ============================================================

export type RelationshipCategory =
  | "romantic"
  | "family"
  | "professional"
  | "friendship"
  | "self"
  | "unspecified";

export interface RelationshipSubtype {
  key: string;
  fr: string;
  en: string;
}

export interface RelationshipCategoryDef {
  key: RelationshipCategory;
  fr: string;
  en: string;
  emoji: string;
  subtypes: RelationshipSubtype[];
}

// Catégories proposables à l'utilisateur (hors "self" auto et "unspecified").
export const RELATIONSHIP_TAXONOMY: RelationshipCategoryDef[] = [
  {
    key: "romantic", fr: "Amoureuse", en: "Romantic", emoji: "💞",
    subtypes: [
      { key: "partner",        fr: "En couple",           en: "Partner" },
      { key: "dating",         fr: "Relation naissante",  en: "Dating" },
      { key: "ex",             fr: "Ex",                  en: "Ex" },
      { key: "open",           fr: "Relation libre",      en: "Open relationship" },
      { key: "romantic_other", fr: "Autre",               en: "Other" },
    ],
  },
  {
    key: "family", fr: "Familiale", en: "Family", emoji: "👪",
    subtypes: [
      { key: "parent",       fr: "Parent",        en: "Parent" },
      { key: "child",        fr: "Enfant",        en: "Child" },
      { key: "sibling",      fr: "Frère/Sœur",    en: "Sibling" },
      { key: "grandparent",  fr: "Grand-parent",  en: "Grandparent" },
      { key: "cousin",       fr: "Cousin·e",      en: "Cousin" },
      { key: "family_other", fr: "Autre famille", en: "Other family" },
    ],
  },
  {
    key: "professional", fr: "Professionnelle", en: "Professional", emoji: "💼",
    subtypes: [
      { key: "colleague", fr: "Collègue",            en: "Colleague" },
      { key: "associate", fr: "Associé·e",           en: "Business partner" },
      { key: "superior",  fr: "Supérieur·e",         en: "Manager" },
      { key: "report",    fr: "Collaborateur·rice",  en: "Report" },
      { key: "client",    fr: "Client·e/Partenaire", en: "Client / Partner" },
    ],
  },
  {
    key: "friendship", fr: "Amicale", en: "Friendship", emoji: "🤝",
    subtypes: [
      { key: "close_friend", fr: "Ami·e proche", en: "Close friend" },
      { key: "friend",       fr: "Ami·e",        en: "Friend" },
      { key: "acquaintance", fr: "Connaissance", en: "Acquaintance" },
    ],
  },
];

// Toutes les clés de catégorie valides (pour validation côté API).
export const RELATIONSHIP_CATEGORY_KEYS: RelationshipCategory[] = [
  "romantic", "family", "professional", "friendship", "self", "unspecified",
];

// Toutes les clés de sous-type valides + "unspecified".
export const RELATIONSHIP_SUBTYPE_KEYS: string[] = [
  "unspecified",
  ...RELATIONSHIP_TAXONOMY.flatMap((c) => c.subtypes.map((s) => s.key)),
];

// ──────────────────────────────────────────────────────────
// Libellés de synastrie adaptés à la catégorie.
// Le moteur de score calcule toujours 6 buckets (mêmes paires
// planétaires) ; seuls les LIBELLÉS et le cadrage changent selon
// la nature de la relation. Partagé API (prompt) + web (affichage).
// ──────────────────────────────────────────────────────────

export type SynastryDimensionKey =
  | "love" | "communication" | "intimacy" | "stability" | "growth" | "challenges";

type LocalizedLabels = Record<SynastryDimensionKey, { fr: string; en: string }>;

const DIM_GENERIC: LocalizedLabels = {
  love:          { fr: "Affinité",      en: "Affinity" },
  communication: { fr: "Communication", en: "Communication" },
  intimacy:      { fr: "Compréhension", en: "Understanding" },
  stability:     { fr: "Solidité",      en: "Solidity" },
  growth:        { fr: "Évolution",     en: "Growth" },
  challenges:    { fr: "Frictions",     en: "Friction" },
};

const SYNASTRY_DIMENSION_LABELS: Partial<Record<RelationshipCategory, LocalizedLabels>> = {
  romantic: {
    love:          { fr: "Amour",         en: "Love" },
    communication: { fr: "Communication", en: "Communication" },
    intimacy:      { fr: "Intimité",      en: "Intimacy" },
    stability:     { fr: "Stabilité",     en: "Stability" },
    growth:        { fr: "Évolution",     en: "Growth" },
    challenges:    { fr: "Frictions",     en: "Friction" },
  },
  professional: {
    love:          { fr: "Affinité",         en: "Rapport" },
    communication: { fr: "Communication",    en: "Communication" },
    intimacy:      { fr: "Confiance",        en: "Trust" },
    stability:     { fr: "Fiabilité",        en: "Reliability" },
    growth:        { fr: "Ambition commune", en: "Shared ambition" },
    challenges:    { fr: "Frictions",        en: "Friction" },
  },
  family: {
    love:          { fr: "Affection",       en: "Affection" },
    communication: { fr: "Communication",   en: "Communication" },
    intimacy:      { fr: "Proximité",       en: "Closeness" },
    stability:     { fr: "Solidité du lien", en: "Bond strength" },
    growth:        { fr: "Évolution",       en: "Growth" },
    challenges:    { fr: "Tensions",        en: "Tension" },
  },
  friendship: {
    love:          { fr: "Complicité",    en: "Camaraderie" },
    communication: { fr: "Communication", en: "Communication" },
    intimacy:      { fr: "Connivence",    en: "Complicity" },
    stability:     { fr: "Constance",     en: "Constancy" },
    growth:        { fr: "Évolution",     en: "Growth" },
    challenges:    { fr: "Frictions",     en: "Friction" },
  },
};

const SYNASTRY_OVERALL_LABEL: Partial<Record<RelationshipCategory, { fr: string; en: string }>> = {
  romantic:     { fr: "Compatibilité amoureuse", en: "Romantic compatibility" },
  professional: { fr: "Entente professionnelle", en: "Professional rapport" },
  family:       { fr: "Lien familial",           en: "Family bond" },
  friendship:   { fr: "Affinité amicale",        en: "Friendship affinity" },
};

/** Libellés des 6 dimensions de synastrie pour une catégorie (fallback générique). */
export function synastryDimensionLabels(
  category: string | null | undefined,
  locale: "fr" | "en" = "fr",
): Record<SynastryDimensionKey, string> {
  const set = (category && SYNASTRY_DIMENSION_LABELS[category as RelationshipCategory]) || DIM_GENERIC;
  const out = {} as Record<SynastryDimensionKey, string>;
  (Object.keys(set) as SynastryDimensionKey[]).forEach((k) => { out[k] = set[k][locale]; });
  return out;
}

/** Libellé du score global selon la catégorie (fallback "Affinité"). */
export function synastryOverallLabel(
  category: string | null | undefined,
  locale: "fr" | "en" = "fr",
): string {
  const lbl = category && SYNASTRY_OVERALL_LABEL[category as RelationshipCategory];
  if (lbl) return lbl[locale];
  return locale === "en" ? "Affinity" : "Affinité";
}

const CATEGORY_BY_KEY: Record<string, RelationshipCategoryDef> =
  Object.fromEntries(RELATIONSHIP_TAXONOMY.map((c) => [c.key, c]));

/** Libellé localisé d'une catégorie (null si inconnue / unspecified / self). */
export function relationshipCategoryLabel(
  category: string | null | undefined,
  locale: "fr" | "en" = "fr",
): string | null {
  if (!category) return null;
  const def = CATEGORY_BY_KEY[category];
  if (!def) return null;
  return locale === "en" ? def.en : def.fr;
}

/** Libellé localisé d'un sous-type (cherché dans toutes les catégories). */
export function relationshipSubtypeLabel(
  subtype: string | null | undefined,
  locale: "fr" | "en" = "fr",
): string | null {
  if (!subtype || subtype === "unspecified") return null;
  for (const cat of RELATIONSHIP_TAXONOMY) {
    const st = cat.subtypes.find((s) => s.key === subtype);
    if (st) return locale === "en" ? st.en : st.fr;
  }
  return null;
}

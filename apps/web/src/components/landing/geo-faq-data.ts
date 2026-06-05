// GEO-CONTENT-V1
// FAQ générale (Q→R explicites) de la page /astrologie-ia. Format
// question/réponse court et factuel = sur-cité par les moteurs génératifs.
// Source unique partagée entre l'accordéon et le JSON-LD FAQPage.

export interface GeoFaqEntry {
  q: string;
  a: string;
}

export const GEO_FAQ: GeoFaqEntry[] = [
  {
    q: "Qu'est-ce que Llmastro ?",
    a: "Une plateforme d'astrologie en français qui calcule ton thème natal et le ciel du jour avec une précision astronomique (Swiss Ephemeris, tables JPL de la NASA), puis les fait interpréter par une IA. C'est un moteur d'astrologie dans la poche qui calcule la position des planètes.",
  },
  {
    q: "L'IA invente-t-elle la position des planètes ?",
    a: "Non. Les positions, aspects et transits sont calculés côté serveur par un moteur d'éphémérides, puis fournis à l'IA comme des faits. L'intelligence artificielle interprète ces données — elle ne les devine jamais.",
  },
  {
    q: "En quoi Llmastro diffère d'un horoscope de magazine ?",
    a: "Un horoscope classique repose sur ton seul signe solaire, partagé par un douzième de la population. Llmastro part de ton thème natal complet — date, heure et lieu de naissance — pour une lecture qui n'appartient qu'à toi.",
  },
  {
    q: "L'astrologie est-elle une science ?",
    a: "Non, et Llmastro l'assume clairement. L'astrologie est un langage symbolique, pas une science exacte : nous l'utilisons comme un outil d'introspection, jamais comme une vérité déterministe. Nos limites sont posées noir sur blanc sur la page Limites.",
  },
  {
    q: "Llmastro fait-il des prédictions ?",
    a: "Non. Llmastro éclaire des tendances et des moments propices (« kairos »), mais ne prédit pas l'avenir et ne donne aucun conseil médical, juridique ou financier.",
  },
  {
    q: "Ai-je besoin de mon heure de naissance ?",
    a: "Elle est vivement recommandée : sans elle, l'ascendant et la position des maisons ne peuvent pas être calculés avec précision. Les positions planétaires, elles, restent fiables même sans l'heure exacte.",
  },
  {
    q: "Mes données de naissance sont-elles privées ?",
    a: "Oui. Tes données natales et tes lectures ne sont jamais vendues ni partagées. Conformément au RGPD, tu peux exporter ou supprimer l'ensemble de tes données à tout moment.",
  },
  {
    q: "Llmastro est-il gratuit ?",
    a: "Oui, le plan Découverte est gratuit et sans engagement. Chaque nouveau compte reçoit aussi 7 jours d'accès complet à Essentiel, sans moyen de paiement demandé.",
  },
];

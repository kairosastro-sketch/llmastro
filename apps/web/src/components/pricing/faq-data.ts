// SEO-PRICING-SSR-V1
// Données FAQ extraites de PricingFAQ.tsx pour être partagées entre :
//   - le composant d'affichage <PricingFAQ /> (accordéon natif <details>)
//   - le JSON-LD FAQPage rendu côté serveur dans /pricing (rich results)
// Source unique de vérité : modifier ici met à jour les deux.

export interface FAQEntry {
  q: string;
  a: string;
}

export const FAQ_ENTRIES: FAQEntry[] = [
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
    q: "C'est quoi, une synastrie ?",
    a: "C'est l'analyse astrologique d'une relation. Llmastro superpose ton thème natal et celui d'une autre personne (en couple, en amitié, au travail) et lit les aspects qui se forment entre vos planètes : ce que l'autre déclenche chez toi, et inversement. La version détaillée explique chaque aspect croisé un par un.",
  },
  {
    q: "Mes données sont-elles privées ?",
    a: "Oui. Tes données natales et tes lectures ne sont jamais vendues ni partagées. Conformément au RGPD, tu peux demander l'export complet de tes données ou la suppression de ton compte à tout moment — détails sur la page Confidentialité.",
  },
  {
    q: "Quand le plan Pro sera-t-il disponible ?",
    a: "Le plan Pro est en soft-launch — il s'adresse aux astrologues professionnels, formateurs ou cabinets. Si tu es intéressé, contacte-nous à pro@llmastro.com pour discuter de ton usage et obtenir un tarif sur mesure.",
  },
];

// PRICING-SYNASTRY-DEFINE-V1 applied (entrée FAQ synastrie, aussi servie en JSON-LD)

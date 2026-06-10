// ============================================================
// apps/web/src/lib/astro/glossary.ts
// AUDIT-UX-GLOSSARY-V1
// Données du glossaire astrologique, partagées entre l'onglet
// Apprendre (explore) et le panneau contextuel GlossaryPanel.
// Contenu FR (comme le glossaire historique de la page Explorer).
// ============================================================

export interface GlossaryEntry {
  t: string;
  b: string;
}

export const GLOSSARY: Record<string, GlossaryEntry[]> = {
  Signes: [
    { t: "♈ Bélier", b: "Feu · Cardinal · Mars. Pionnier, courageux, impulsif." },
    { t: "♉ Taureau", b: "Terre · Fixe · Vénus. Stable, sensuel, persévérant." },
    { t: "♊ Gémeaux", b: "Air · Mutable · Mercure. Curieux, communicatif." },
    { t: "♋ Cancer", b: "Eau · Cardinal · Lune. Intuitif, protecteur." },
    { t: "♌ Lion", b: "Feu · Fixe · Soleil. Généreux, créatif, fier." },
    { t: "♍ Vierge", b: "Terre · Mutable · Mercure. Analytique, perfectionniste." },
    { t: "♎ Balance", b: "Air · Cardinal · Vénus. Diplomate, esthète." },
    { t: "♏ Scorpion", b: "Eau · Fixe · Pluton. Intense, transformateur." },
    { t: "♐ Sagittaire", b: "Feu · Mutable · Jupiter. Aventurier, philosophe." },
    { t: "♑ Capricorne", b: "Terre · Cardinal · Saturne. Ambitieux, patient." },
    { t: "♒ Verseau", b: "Air · Fixe · Uranus. Visionnaire, indépendant." },
    { t: "♓ Poissons", b: "Eau · Mutable · Neptune. Empathique, intuitif." },
  ],
  Planètes: [
    { t: "☉ Soleil", b: "Identité essentielle, ego, vitalité." },
    { t: "☽ Lune", b: "Émotions, instincts, mémoire." },
    { t: "☿ Mercure", b: "Communication, intellect, déplacements." },
    { t: "♀ Vénus", b: "Amour, beauté, valeurs." },
    { t: "♂ Mars", b: "Action, désir, énergie." },
    { t: "♃ Jupiter", b: "Expansion, chance, sagesse." },
    { t: "♄ Saturne", b: "Structure, discipline, karma." },
    { t: "♅ Uranus", b: "Innovation, révolution, liberté." },
    { t: "♆ Neptune", b: "Illusion, spiritualité." },
    { t: "♇ Pluton", b: "Transformation, pouvoir." },
  ],
  Aspects: [
    { t: "☌ Conjonction (0°)", b: "Fusion de deux énergies." },
    { t: "⚹ Sextile (60°)", b: "Harmonieux, opportunités fluides." },
    { t: "□ Carré (90°)", b: "Tension, friction créatrice." },
    { t: "△ Trigone (120°)", b: "Le plus harmonieux." },
    { t: "☍ Opposition (180°)", b: "Polarité à intégrer." },
    { t: "⚻ Quinconce (150°)", b: "Ajustement entre deux énergies étrangères l'une à l'autre." },
  ],
  Maisons: [
    { t: "Maison 1 — Soi", b: "Personnalité, apparence, élan vital. Sa pointe est l'Ascendant." },
    { t: "Maison 2 — Ressources", b: "Argent, biens, valeurs personnelles." },
    { t: "Maison 3 — Communication", b: "Esprit, échanges, fratrie, trajets du quotidien." },
    { t: "Maison 4 — Foyer", b: "Racines, famille, intimité." },
    { t: "Maison 5 — Créativité", b: "Plaisirs, romance, enfants, créations." },
    { t: "Maison 6 — Quotidien", b: "Travail, santé, routines." },
    { t: "Maison 7 — Union", b: "Couple, partenariats, contrats." },
    { t: "Maison 8 — Transformation", b: "Crises, ressources partagées, sexualité, héritages." },
    { t: "Maison 9 — Horizons", b: "Voyages, études supérieures, philosophie." },
    { t: "Maison 10 — Carrière", b: "Vocation, image publique. Sa pointe est le Milieu du Ciel (MC)." },
    { t: "Maison 11 — Amitiés", b: "Réseaux, groupes, projets collectifs." },
    { t: "Maison 12 — Intériorité", b: "Vie secrète, solitude, spiritualité." },
  ],
  Notions: [
    { t: "Thème natal", b: "Photographie du ciel à l'instant exact de ta naissance : positions des planètes, signes, maisons et aspects." },
    { t: "Transit", b: "Position actuelle d'une planète dans le ciel, comparée à ton thème natal. C'est la base de l'horoscope et de la page Transits." },
    { t: "Orbe", b: "Écart (en degrés) entre un aspect et son angle exact. Plus l'orbe est petit, plus l'aspect est puissant. Sous 1°, l'aspect est dit « exact »." },
    { t: "℞ Rétrograde", b: "Vue de la Terre, la planète semble reculer. Période de révision plutôt que d'action nouvelle, dans le domaine de cette planète." },
    { t: "Ascendant (ASC)", b: "Le signe qui se levait à l'horizon est à l'instant de ta naissance. Ton style, ta première impression. Nécessite l'heure de naissance exacte." },
    { t: "Milieu du Ciel (MC)", b: "Le point le plus haut du thème. Carrière, direction de vie, image publique. Nécessite l'heure de naissance exacte." },
  ],
};

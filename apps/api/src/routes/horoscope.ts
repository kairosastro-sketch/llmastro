import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload } from "@astro-platform/types";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { natalService } from "../services/natal.service.js";
import { ephemerisService } from "@astro-platform/ephemeris";
import { entitlementsService } from "../services/entitlements.service.js"; // ARCHIVE-4-GATES-V1
import {
  computeTransitAspects,
  generateAlerts,
} from "../services/transits.service.js";

// ──────────────────────────────────────────────────────────
// Arcanes majeurs pour le tirage tarot (inchangé)
// ──────────────────────────────────────────────────────────
const TAROT_CARDS = [
  { num: 0,  n: "Le Fou",           emoji: "🃏", meaning: "Nouveaux départs, liberté, spontanéité" },
  { num: 1,  n: "Le Magicien",      emoji: "🎩", meaning: "Volonté, talent, manifestation" },
  { num: 2,  n: "La Papesse",       emoji: "📚", meaning: "Intuition, sagesse intérieure, mystère" },
  { num: 3,  n: "L'Impératrice",    emoji: "👑", meaning: "Fertilité, abondance, créativité" },
  { num: 4,  n: "L'Empereur",       emoji: "🏛️", meaning: "Autorité, structure, stabilité" },
  { num: 5,  n: "Le Pape",          emoji: "✝️", meaning: "Tradition, guidance spirituelle" },
  { num: 6,  n: "Les Amoureux",     emoji: "💞", meaning: "Choix, amour, harmonie" },
  { num: 7,  n: "Le Chariot",       emoji: "⚔️", meaning: "Victoire, contrôle, détermination" },
  { num: 8,  n: "La Force",         emoji: "🦁", meaning: "Courage, endurance, compassion" },
  { num: 9,  n: "L'Ermite",         emoji: "🔦", meaning: "Introspection, solitude, guidance" },
  { num: 10, n: "La Roue de Fortune",emoji: "🎡", meaning: "Cycles, destin, chance" },
  { num: 11, n: "La Justice",       emoji: "⚖️", meaning: "Équité, vérité, cause-effet" },
  { num: 12, n: "Le Pendu",         emoji: "🙃", meaning: "Sacrifice, perspective, lâcher-prise" },
  { num: 13, n: "La Mort",          emoji: "🌙", meaning: "Transformation, fin, renouveau" },
  { num: 14, n: "La Tempérance",    emoji: "⚗️", meaning: "Équilibre, patience, modération" },
  { num: 15, n: "Le Diable",        emoji: "🔗", meaning: "Attachements, matérialisme, ombre" },
  { num: 16, n: "La Tour",          emoji: "⚡", meaning: "Rupture soudaine, révélation, chaos" },
  { num: 17, n: "L'Étoile",         emoji: "⭐", meaning: "Espoir, inspiration, sérénité" },
  { num: 18, n: "La Lune",          emoji: "🌛", meaning: "Illusion, peur, inconscient" },
  { num: 19, n: "Le Soleil",        emoji: "☀️", meaning: "Joie, succès, vitalité" },
  { num: 20, n: "Le Jugement",      emoji: "🎺", meaning: "Éveil, absolution, renaissance" },
  { num: 21, n: "Le Monde",         emoji: "🌍", meaning: "Accomplissement, intégration, voyage" },
];

// ──────────────────────────────────────────────────────────
// Scores par thème (6 axes), dérivés des aspects transit→natal.
// Harmonique (trine, sextile) → monte, tendu (carré, opposition) → descend.
// ──────────────────────────────────────────────────────────
function computeThemeScores(aspects: any[]): {
  vital: number; mental: number; harmony: number;
  love: number; career: number; luck: number;
} {
  const s = { vital: 50, mental: 50, harmony: 50, love: 50, career: 50, luck: 50 };
  for (const asp of aspects) {
    const p1 = asp.p1 ?? asp.planet1;
    const p2 = asp.p2 ?? asp.planet2;
    const tone = asp.tone ?? "n";
    const base = tone === "h" ? 4 : tone === "t" ? -4 : 0;
    const bonus = asp.exact ? (tone === "h" ? 2 : tone === "t" ? -2 : 0) : 0;
    const d = base + bonus;
    const involves = (pl: string) => p1 === pl || p2 === pl;
    if (involves("sun") || involves("mars")) s.vital += d;
    if (involves("mercury")) s.mental += d;
    if (involves("venus") || involves("moon")) s.harmony += d;
    if (involves("venus")) s.love += d;
    if (involves("jupiter") || involves("saturn")) s.career += d;
    if (involves("jupiter")) s.luck += d;
  }
  const clamp = (n: number) => Math.max(5, Math.min(95, Math.round(n)));
  return {
    vital:   clamp(s.vital),
    mental:  clamp(s.mental),
    harmony: clamp(s.harmony),
    love:    clamp(s.love),
    career:  clamp(s.career),
    luck:    clamp(s.luck),
  };
}

// ──────────────────────────────────────────────────────────
// Plugin
// ──────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────
// Tarot contextuel : contexte + nuances relationnelles + élément
// ──────────────────────────────────────────────────────────

type TarotContext = {
  gender?: "male" | "female" | "unspecified";
  relationshipStatus?: "single" | "couple" | "unspecified";
  sunSignIdx?: number;
};

/**
 * Signe solaire (tropical, idx 0..11 = Bélier..Poissons) dérivé de
 * la date de naissance. Précision suffisante pour le tarot :
 * les cusp dates tropicales sont stables à ±1 jour.
 */
function sunSignFromBirthDate(birthDate: string): number {
  const [, mStr, dStr] = birthDate.split("-");
  const m = Number(mStr);
  const d = Number(dStr);
  if (!m || !d) return 0;
  if (m === 1)  return d <= 19 ? 9  : 10;
  if (m === 2)  return d <= 18 ? 10 : 11;
  if (m === 3)  return d <= 20 ? 11 : 0;
  if (m === 4)  return d <= 19 ? 0  : 1;
  if (m === 5)  return d <= 20 ? 1  : 2;
  if (m === 6)  return d <= 20 ? 2  : 3;
  if (m === 7)  return d <= 22 ? 3  : 4;
  if (m === 8)  return d <= 22 ? 4  : 5;
  if (m === 9)  return d <= 22 ? 5  : 6;
  if (m === 10) return d <= 22 ? 6  : 7;
  if (m === 11) return d <= 21 ? 7  : 8;
  if (m === 12) return d <= 21 ? 8  : 9;
  return 0;
}

const SUN_ELEMENT: Record<number, "fire" | "earth" | "air" | "water"> = {
  0:  "fire",  1:  "earth", 2:  "air",   3:  "water",
  4:  "fire",  5:  "earth", 6:  "air",   7:  "water",
  8:  "fire",  9:  "earth", 10: "air",   11: "water",
};

const ELEMENT_FLAVOR: Record<string, string> = {
  fire:  "Votre feu intérieur colore cette lecture d'intensité.",
  earth: "Une énergie stable ancre ce tirage dans le réel.",
  air:   "La clarté mentale accompagne ces messages.",
  water: "Votre intuition est le fil conducteur ici.",
};

type RelStatus = "single" | "couple";

/**
 * Nuances relationnelles pour les cartes sensibles à la sphère
 * amoureuse / du lien. Les autres cartes ne reçoivent pas de
 * surcouche ici (on garde leur texte de base).
 */
const RELATIONSHIP_NUANCES: Record<string, Partial<Record<RelStatus, Record<string, string>>>> = {
  "Les Amoureux": {
    single: {
      "Passé":   "Un choix amoureux passé résonne encore — libérez-vous de ce qui pèse.",
      "Présent": "Votre cœur s'ouvre à une possibilité nouvelle, restez à l'écoute.",
      "Futur":   "Une rencontre décisive pourrait transformer votre trajectoire affective.",
    },
    couple: {
      "Passé":   "Votre duo s'est construit sur un choix mûri qui continue de porter ses fruits.",
      "Présent": "Votre couple vit une phase de choix partagés et d'alignement profond.",
      "Futur":   "Un engagement renouvelé ou une décision commune vous attend.",
    },
  },
  "L'Impératrice": {
    single: {
      "Passé":   "Vous avez créé des liens féconds par le passé, riches en douceur.",
      "Présent": "Votre fertilité créatrice attire à vous — l'amour peut être l'un des fruits.",
      "Futur":   "Une abondance nouvelle, affective ou créative, se prépare.",
    },
    couple: {
      "Passé":   "Votre couple a nourri quelque chose de vivant — un projet, un foyer, un lien.",
      "Présent": "L'abondance circule entre vous : prenez soin de ce qui pousse.",
      "Futur":   "Un projet commun fertile — foyer, famille, création — s'annonce.",
    },
  },
  "Le Pape": {
    single: {
      "Passé":   "Un modèle ou une tradition vous a offert des repères.",
      "Présent": "Vous cherchez un sens profond, spirituel ou vocationnel.",
      "Futur":   "Une guidance ou une initiation s'annonce sur votre chemin.",
    },
    couple: {
      "Passé":   "Votre union a été scellée par un engagement ou une tradition partagée.",
      "Présent": "Votre couple traverse une phase d'engagement et de fidélité lucide.",
      "Futur":   "Un engagement approfondi — mariage, enfant, projet durable — approche.",
    },
  },
  "La Lune": {
    single: {
      "Passé":   "Des peurs ou illusions passées ont pesé sur votre cœur.",
      "Présent": "Une incertitude affective trouble vos nuits — écoutez vos rêves.",
      "Futur":   "Vous traverserez une zone d'ombre avant une clarté nouvelle en amour.",
    },
    couple: {
      "Passé":   "Des non-dits ou malentendus ont brouillé votre relation autrefois.",
      "Présent": "Votre couple traverse une zone ambiguë — patience et honnêteté éclaireront.",
      "Futur":   "Une vérité cachée pourrait émerger, transformante si bien accueillie.",
    },
  },
  "Le Soleil": {
    single: {
      "Passé":   "Un épanouissement passé, seul ou avec d'autres, vous a construit.",
      "Présent": "Votre lumière rayonne — c'est un bon moment pour vous montrer.",
      "Futur":   "Une joie nouvelle et pleine vous attend — ouverte, partagée ou solitaire.",
    },
    couple: {
      "Passé":   "Votre amour a connu une période de pleine joie qui continue d'éclairer.",
      "Présent": "Votre couple rayonne ensemble — profitez de cette lumière.",
      "Futur":   "Un moment d'épanouissement commun, peut-être une célébration, se profile.",
    },
  },
  "Le Monde": {
    single: {
      "Passé":   "Un grand cycle personnel s'est accompli, intégré.",
      "Présent": "Vous touchez à une forme de plénitude — profitez de ce palier.",
      "Futur":   "L'aboutissement d'un grand voyage intérieur vous attend.",
    },
    couple: {
      "Passé":   "Votre couple a traversé un cycle complet ensemble, avec maturité.",
      "Présent": "Votre union atteint une plénitude rare — savourez-la.",
      "Futur":   "L'aboutissement d'un projet commun majeur se prépare.",
    },
  },
};

export const horoscopeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authMiddleware);

  // ── GET /horoscope/daily/:natalId ─────────────────────────
  // Renvoie : natal (pour le hero signe solaire), current (ciel du moment
  // + phase lunaire), scores par thème, aspects transit→natal, alertes.
  fastify.get<{ Params: { natalId: string } }>(
    "/daily/:natalId",
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const natal = await natalService.findOne(req.params.natalId, userId);
      if (!natal) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Profil natal non trouvé" },
        });
      }

      try {
        // 1) Carte natale du profil — API objet avec IANA tz
        const natalChart = await ephemerisService.calculateNatalChart({
          natalId:        natal.id,
          localBirthDate: natal.birthDate,
          localBirthTime: natal.birthTime,
          ianaTz:         natal.timezone,
          latitude:       natal.latitude,
          longitude:      natal.longitude,
          birthTimeKnown: !natal.birthTimeUnknown,
        });

        // 2) Ciel du moment (à la position du natif)
        const currentSky = await ephemerisService.getCurrentSky(
          natal.latitude,
          natal.longitude,
        );

        // 3) Aspects transit → natal
        const transitAspects = computeTransitAspects(
          currentSky.planets as any,
          natalChart.planets as any,
        );

        // 4) Scores par thème
        const scores = computeThemeScores(transitAspects);

        // 5) Alertes (rétrogrades, aspects tendus proches d'exact, etc.)
        const alerts = generateAlerts(
          transitAspects,
          currentSky.planets as any,
          "fr",
        );

        return reply.send({
          success: true,
          data: {
            natalId: natal.id,
            natalLabel: (natal as any).label ?? "",
            natal: {
              label:              natal.label,
              gender:             natal.gender,
              relationshipStatus: natal.relationshipStatus,
              planets:            natalChart.planets,
              asc:                natalChart.asc,
              mc:                 natalChart.mc,
            },
            current: {
              planets:     currentSky.planets,
              moonPhase:   currentSky.moonPhase,
              retrogrades: currentSky.retrogrades,
            },
            aspects: transitAspects.slice(0, 20),
            scores,
            alerts,
          },
        });
      } catch (err) {
        fastify.log.error({ err }, "Horoscope calculation failed");
        return reply.code(500).send({
          success: false,
          error: {
            code: "HOROSCOPE_ERROR",
            message: err instanceof Error ? err.message : "Erreur",
          },
        });
      }
    }
  );

  // ── GET /horoscope/moon ───────────────────────────────────
  // Phase lunaire du moment. Location = Paris par défaut (lat/lon
  // n'influent pas sur la phase, seulement sur les maisons).
  fastify.get("/moon", async (_req, reply) => {
    try {
      const sky = await ephemerisService.getCurrentSky(48.857, 2.352);
      return reply.send({ success: true, data: { phase: sky.moonPhase } });
    } catch (err) {
      fastify.log.error({ err }, "Moon phase failed");
      return reply.code(500).send({
        success: false,
        error: {
          code: "MOON_ERROR",
          message: err instanceof Error ? err.message : "Erreur",
        },
      });
    }
  });

  // ── POST /horoscope/tarot ─────────────────────────────────
  // Tirage 3 cartes. Si `natalId` est fourni dans le body, le tirage
  // est contextualisé : gender + relationshipStatus + signe solaire
  // viennent nuancer l'interprétation de chaque carte.
  fastify.post<{ Body?: { natalId?: string } }>("/tarot", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const natalId = (req.body as any)?.natalId;

    // ARCHIVE-4-GATES-V1 : consume bundle tarot
    const tarotResult = await entitlementsService.consumeBundle(userId, "tarot", 1);
    if (!tarotResult.allowed) {
      if (entitlementsService.isEnforcementActive()) {
        const code = tarotResult.reason === "quota_exceeded" ? "QUOTA_EXCEEDED" : "FEATURE_NOT_AVAILABLE";
        const status = tarotResult.reason === "quota_exceeded" ? 429 : 403;
        return reply.code(status).send({
          success: false,
          error: {
            code,
            message: tarotResult.reason === "quota_exceeded"
              ? "Tu as atteint ta limite de tirages pour aujourd'hui."
              : "Les tirages de tarot ne sont pas disponibles dans ton plan.",
            feature: "tarot",
            remaining: tarotResult.remaining,
          },
        });
      }
      req.log.warn({ userId, reason: tarotResult.reason }, "[entitlements] would block horoscope/tarot (enforcement off)");
    }

    let ctx: TarotContext = {};
    let profileLabel: string | null = null;

    if (natalId) {
      const natal = await natalService.findOne(natalId, userId);
      if (natal) {
        profileLabel = natal.label;
        ctx = {
          gender: (natal as any).gender ?? "unspecified",
          relationshipStatus: (natal as any).relationshipStatus ?? "unspecified",
          sunSignIdx: sunSignFromBirthDate(natal.birthDate),
        };
      }
    }

    const shuffled = [...Array(22).keys()].sort(() => Math.random() - 0.5);
    const drawn    = shuffled.slice(0, 3).map(i => TAROT_CARDS[i]!);
    const positions = ["Passé", "Présent", "Futur"];
    const interpretation = drawn.map((card, i) => ({
      position: positions[i]!,
      card:     card.n,
      emoji:    card.emoji,
      num:      card.num,
      meaning:  card.meaning,
      text:     generateTarotText(card.n, positions[i]!, ctx),
    }));

    return reply.send({
      success: true,
      data: {
        cards: drawn,
        interpretation,
        context: natalId ? {
          natalId,
          label: profileLabel,
          gender: ctx.gender,
          relationshipStatus: ctx.relationshipStatus,
          sunSignIdx: ctx.sunSignIdx,
        } : null,
      },
    });
  });
};

// ──────────────────────────────────────────────────────────
// Textes tarot — base par carte/position + contexte optionnel
// ──────────────────────────────────────────────────────────
function generateTarotText(
  cardName: string,
  position: string,
  ctx: TarotContext = {},
): string {
  const texts: Record<string, Record<string, string>> = {
    "Le Fou":       { Passé: "Une période d'insouciance et d'aventure vous a mené jusqu'ici.", Présent: "L'heure est à la nouveauté — osez l'inattendu.", Futur: "Un saut dans l'inconnu s'annonce, chargé de promesses." },
    "Le Magicien":  { Passé: "Vous avez su mobiliser vos ressources au bon moment.", Présent: "Vos talents sont au service de votre volonté créatrice.", Futur: "La maîtrise de vos outils ouvrira de nouvelles portes." },
    "L'Étoile":     { Passé: "Une guérison ou un espoir a illuminé votre parcours.", Présent: "La sérénité et l'inspiration vous habitent.", Futur: "Un avenir lumineux se dessine, porteur de renouveau." },
    "La Lune":      { Passé: "Des peurs ou illusions ont influencé vos choix.", Présent: "L'inconscient parle — écoutez vos rêves.", Futur: "Traversez les zones d'ombre avec confiance." },
    "Le Soleil":    { Passé: "Une période de joie et de réussite vous a nourri.", Présent: "La vitalité et le succès rayonnent en vous.", Futur: "La clarté et l'épanouissement vous attendent." },
    "La Mort":      { Passé: "Une transformation profonde a changé votre trajectoire.", Présent: "Un cycle se clôt pour en ouvrir un nouveau.", Futur: "Le renouveau passe par un lâcher-prise courageux." },
    "La Tour":      { Passé: "Une rupture soudaine a ébranlé vos certitudes.", Présent: "Des bases instables doivent être reconstruites.", Futur: "Un bouleversement libérateur approche." },
    "Le Monde":     { Passé: "Un accomplissement majeur a marqué votre chemin.", Présent: "Vous touchez à une forme d'intégration et de plénitude.", Futur: "L'aboutissement d'un grand cycle vous attend." },
  };

  const generics: Record<string, string> = {
    Passé:   `${cardName} révèle une influence passée qui a façonné votre être.`,
    Présent: `${cardName} vous invite à embrasser son énergie dans l'instant présent.`,
    Futur:   `${cardName} annonce une évolution vers son expression la plus haute.`,
  };

  const base =
    texts[cardName]?.[position]
    ?? generics[position]
    ?? `${cardName} porte un message profond pour vous.`;

  // Nuance relationnelle (cartes sensibles + status défini)
  let relNuance = "";
  const rs = ctx.relationshipStatus;
  if (rs === "single" || rs === "couple") {
    relNuance = RELATIONSHIP_NUANCES[cardName]?.[rs]?.[position] ?? "";
  }

  // Saveur élémentaire (signe solaire)
  let elFlavor = "";
  if (typeof ctx.sunSignIdx === "number") {
    const el = SUN_ELEMENT[ctx.sunSignIdx];
    if (el) elFlavor = ELEMENT_FLAVOR[el] ?? "";
  }

  const parts = [base];
  if (relNuance) parts.push(relNuance);
  if (elFlavor) parts.push(elFlavor);
  return parts.join(" ");
}

// RWS-TAROT-V1 horoscope applied

// ============================================================
// apps/api/src/services/ai-prompts.versions.ts
// ------------------------------------------------------------
// ARCHIVE-PERSISTENCE-LECTURES-IA-V1
// Versions de prompts Kairos. Bumper une version ici déclenche
// l'auto-regen de toutes les lectures persistées avec une version
// inférieure, à leur prochain accès.
//
// CONVENTION : 1 incrément par changement significatif de prompt.
// Les corrections cosmétiques (typo, reformulation mineure) ne
// nécessitent PAS de bump. Le bump est explicite et tracé en commit.
//
// HISTORIQUE :
//  - horoscope     v1 : initial (post PATCH-KAIROS-TONE-ACCESSIBLE-V2)
//  - horoscope     v2 : ARCHIVE-KAIROS-PROMPTS-BIBLIO-V1 (ajout posture éditoriale Llmastro)
//  - horoscope     v3 : HOROSCOPE-KEY-MOMENTS-V1 (moments clés = {when, trigger, stance})
//  - horoscope     v4 : FR-GENDER-FIX (accord « ta Lune ») + qualification natale
//                       (« ton Jupiter natal ») + astéroïdes + ligne « relation du jour »
//  - horoscope     v5 : HOROSCOPE-CONSEIL-DETAILS-V1 — thèmes = conseils courts
//                       sans jargon ; "text" devient la lecture détaillée (seul
//                       champ où la mécanique astrale est nommée), repliée en front
//  - horoscope     v6 : HOROSCOPE-TONE-V6 — thèmes = conseils incarnés riches
//                       (~80-110 mots), 2-3 énergies planétaires nommées en clair
//                       (sans degrés/maisons/aspects), spécifiques au jour ; validé
//                       sur sortie réelle via preview admin. Reste : varier les
//                       énergies par thème (effet litanie à corriger plus tard)
//  - horoscope     v7 : HOROSCOPE-TONE-V7 — (A) fuite de jargon corrigée : la
//                       mécanique (transit/natal/Ascendant/aspects) est scopée au
//                       SEUL champ "text" + liste d'interdits par thème ; (B) effet
//                       litanie corrigé : énergies variées par thème, ancrage par
//                       domaine (Vitalité→Mars/Soleil, Mental→Mercure…)
//  - horoscope     v8 : HOROSCOPE-MINOR-BODIES-V1 — pont actif vers la règle
//                       ASTEROIDS : une énergie nommée d'un thème PEUT être un
//                       astre mineur (Chiron, Lilith, Cérès, Pallas, Junon,
//                       Vesta) quand il est marquant, 1-2 fois max sur l'ensemble,
//                       toujours glosé. Avant : règle passive « tu PEUX » noyée.
//  - natal_profile v1 : initial
//  - natal_profile v2 : ARCHIVE-KAIROS-PROMPTS-BIBLIO-V1 (Greene + Sasportas nommés)
//  - natal_profile v3 : FR-GENDER-FIX + qualification natale + directive astéroïdes
//  - tarot         v1 : initial — pas d'auto-regen sur ce kind
//                       (un tirage est figé dans le temps)
//  - tarot         v2 : ARCHIVE-KAIROS-PROMPTS-BIBLIO-V1 (Jodorowsky/Nichols/Greer)
//  - tarot         v3 : ASTRO-TAROT-V1 — lecture orientée astro-tarot : chaque
//                       Arcane Majeur lu via sa correspondance astrologique
//                       (Golden Dawn/RWS), croisée avec le thème natal ; astro
//                       = ossature, plus un simple ajout. (pas d'auto-regen)
//  - synastry      v1 : initial
//  - synastry      v2 : ARCHIVE-KAIROS-PROMPTS-BIBLIO-V1 (Greene-Relating + Hand-Composite)
//  - synastry      v3 : FR-GENDER-FIX + synastrie adaptative par catégorie de relation
// ============================================================

export const PROMPT_VERSIONS = {
  horoscope: 8,
  natal_profile: 3,
  tarot: 3,
  synastry: 3,
  sky_public: 2,  // CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2
  astrocartography: 2,  // V2 : distinction explicite permanent (lieu) / moment (transits)
} as const;

export type PromptKind = keyof typeof PROMPT_VERSIONS;

/**
 * Pour ces kinds, l'auto-regen sur changement de version est DÉSACTIVÉ.
 * Une lecture déjà persistée reste figée à sa version d'origine.
 * L'endpoint admin reste disponible pour forcer une regen manuelle.
 *
 * Tarot : un tirage est lié à un sessionId unique avec ses cartes
 * choisies à un moment précis — re-générer changerait l'interprétation
 * de cartes que le user n'a plus en mémoire visuelle.
 */
export const KINDS_WITHOUT_AUTO_REGEN: ReadonlySet<PromptKind> = new Set([
  "tarot",
]);

/**
 * Indique si le kind donné doit être auto-regen quand sa version
 * en DB est inférieure à la version courante du code.
 */
export function shouldAutoRegen(kind: PromptKind): boolean {
  return !KINDS_WITHOUT_AUTO_REGEN.has(kind);
}

/**
 * Retourne la version courante du prompt pour un kind donné.
 */
export function getCurrentVersion(kind: PromptKind): number {
  return PROMPT_VERSIONS[kind];
}

// ARCHIVE-KAIROS-PROMPTS-BIBLIO-V1 applied

// CIEL-PUBLIC-V1-LLM versions applied

// CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2 versions applied

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
//  - natal_profile v1 : initial
//  - natal_profile v2 : ARCHIVE-KAIROS-PROMPTS-BIBLIO-V1 (Greene + Sasportas nommés)
//  - tarot         v1 : initial — pas d'auto-regen sur ce kind
//                       (un tirage est figé dans le temps)
//  - tarot         v2 : ARCHIVE-KAIROS-PROMPTS-BIBLIO-V1 (Jodorowsky/Nichols/Greer)
//  - synastry      v1 : initial
//  - synastry      v2 : ARCHIVE-KAIROS-PROMPTS-BIBLIO-V1 (Greene-Relating + Hand-Composite)
// ============================================================

export const PROMPT_VERSIONS = {
  horoscope: 3,
  natal_profile: 2,
  tarot: 2,
  synastry: 2,
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

// ============================================================
// apps/api/src/services/readings.helpers.ts
// ------------------------------------------------------------
// ARCHIVE-PERSISTENCE-LECTURES-IA-V2 + HOTFIX-WIRING-UUID
// Helpers de haut niveau pour les routes AI.
//
// HOTFIX UUID : on sépare désormais
//   - natalProfileId (UUID strict ou null, FK vers natal_data)
//   - keySuffix      (string libre : digest, variant, locale, etc.)
//
// La readingKey effective devient :
//   `${naturalKey}:${keySuffix}` où naturalKey est l'identifiant
//   métier de la lecture (profileId pour natal/horoscope, sessionId
//   pour tarot, "${aId}:${bId}" pour synastry).
// ============================================================

import { getOrGenerate, type Reading } from "./readings.service.js";
import { xaiService, type XaiMessage, type XaiCallOptions } from "./ai.service.js";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export interface CommonReadingArgs {
  messages: XaiMessage[];
  options?: XaiCallOptions;
  normalize?: (raw: any) => any;
}

// ------------------------------------------------------------
// Horoscope
// ------------------------------------------------------------
export interface HoroscopeReadingArgs extends CommonReadingArgs {
  userId: string;
  natalProfileId: string;     // ⚠ UUID strict — FK vers natal_data
  keySuffix: string;          // ex: "${digest}:${variant}:${loc}"
  period: "day" | "week" | "month" | "year";
  periodKey: string;
  // HOTFIX-GROK-RETRY-V1 : rejette une génération incomplète → retry
  validate?: (raw: any) => void;
}

export async function getOrGenerateHoroscopeReading(
  args: HoroscopeReadingArgs,
): Promise<Reading> {
  const readingKey = `${args.natalProfileId}:${args.keySuffix}:${args.period}:${args.periodKey}`;
  return getOrGenerate({
    userId: args.userId,
    kind: "horoscope",
    readingKey,
    natalProfileId: args.natalProfileId,
    generator: async () => {
      const raw = await xaiService.chatJSON<any>(args.messages, {
        ...(args.options ?? {}),
        validate: args.validate,
      });
      const normalized = args.normalize ? args.normalize(raw) : raw;
      return {
        content: normalized,
        model: process.env["XAI_MODEL"] ?? "grok-4.3",
      };
    },
  });
}

// ------------------------------------------------------------
// Natal profile
// ------------------------------------------------------------
export interface NatalProfileReadingArgs extends CommonReadingArgs {
  userId: string;
  natalProfileId: string;     // UUID strict
  keySuffix: string;          // ex: "${digest}:${loc}"
}

export async function getOrGenerateNatalProfileReading(
  args: NatalProfileReadingArgs,
): Promise<Reading> {
  const readingKey = `${args.natalProfileId}:${args.keySuffix}`;
  return getOrGenerate({
    userId: args.userId,
    kind: "natal_profile",
    readingKey,
    natalProfileId: args.natalProfileId,
    generator: async () => {
      const raw = await xaiService.chatJSON<any>(args.messages, args.options ?? {});
      const normalized = args.normalize ? args.normalize(raw) : raw;
      return {
        content: normalized,
        model: process.env["XAI_MODEL"] ?? "grok-4.3",
      };
    },
  });
}

// ------------------------------------------------------------
// Astrocartographie — « lecture de vos lieux » (ASTROCARTOGRAPHY-V1)
// Texte libre (pas de JSON), cachée par profil (carte natale fixe).
// ------------------------------------------------------------
export interface AstrocartographyReadingArgs {
  userId: string;
  natalProfileId: string;
  keySuffix: string;          // ex: "${digest}:${loc}"
  messages: XaiMessage[];
  options?: XaiCallOptions;
}

export async function getOrGenerateAstrocartographyReading(
  args: AstrocartographyReadingArgs,
): Promise<Reading> {
  const readingKey = `${args.natalProfileId}:${args.keySuffix}`;
  return getOrGenerate({
    userId: args.userId,
    kind: "astrocartography",
    readingKey,
    natalProfileId: args.natalProfileId,
    generator: async () => {
      const text = await xaiService.chat(args.messages, args.options ?? {});
      return {
        content: { text },
        model: process.env["XAI_MODEL"] ?? "grok-4.3",
      };
    },
  });
}

// ------------------------------------------------------------
// Tarot
// ------------------------------------------------------------
export interface TarotReadingArgs extends CommonReadingArgs {
  userId: string;
  sessionId: string;
}

export async function getOrGenerateTarotReading(
  args: TarotReadingArgs,
): Promise<Reading> {
  return getOrGenerate({
    userId: args.userId,
    kind: "tarot",
    readingKey: args.sessionId,
    natalProfileId: null,
    generator: async () => {
      const raw = await xaiService.chatJSON<any>(args.messages, args.options ?? {});
      const normalized = args.normalize ? args.normalize(raw) : raw;
      return {
        content: normalized,
        model: process.env["XAI_MODEL"] ?? "grok-4.3",
      };
    },
  });
}

// ------------------------------------------------------------
// Synastry (compatibilité)
// ------------------------------------------------------------
export interface SynastryReadingArgs extends CommonReadingArgs {
  userId: string;
  profileAId: string;
  profileBId: string;
  keySuffix?: string;         // optionnel (locale par exemple)
}

export async function getOrGenerateSynastryReading(
  args: SynastryReadingArgs,
): Promise<Reading> {
  const sorted = [args.profileAId, args.profileBId].sort();
  const aId = sorted[0]!;
  const bId = sorted[1]!;
  const baseKey = `${aId}:${bId}`;
  const readingKey = args.keySuffix ? `${baseKey}:${args.keySuffix}` : baseKey;
  return getOrGenerate({
    userId: args.userId,
    kind: "synastry",
    readingKey,
    natalProfileId: aId,  // attaché au profil A (arbitraire mais stable)
    generator: async () => {
      const raw = await xaiService.chatJSON<any>(args.messages, args.options ?? {});
      const normalized = args.normalize ? args.normalize(raw) : raw;
      return {
        content: normalized,
        model: process.env["XAI_MODEL"] ?? "grok-4.3",
      };
    },
  });
}

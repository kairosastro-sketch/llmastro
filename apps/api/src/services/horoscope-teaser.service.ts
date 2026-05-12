// ============================================================
// apps/api/src/services/horoscope-teaser.service.ts
// DAILY-HOROSCOPE-NOTIF-V1
// ------------------------------------------------------------
// Génère un teaser court Kairos pour la notif quotidienne (8h locale
// user). Le but : une phrase personnalisée qui donne envie d'ouvrir
// l'horoscope complet — pas le horoscope lui-même.
//
// Stratégie :
//   - Prompt LLM court (~80-120 tokens output)
//   - temperature 0.8 (créatif mais focalisé)
//   - Bilingue : génère dans la lang user puis traduit
//   - Fallback déterministe si xAI down (template basé sur sun/moon)
//
// Pattern aligné sur event-narrative.service (génération + traduction).
// ============================================================

import { xaiService, type XaiMessage } from "./ai.service.js";
import { translateEventNarrative } from "./event-narrative.service.js";

// ──────────────────────────────────────────────────────────
// Input
// ──────────────────────────────────────────────────────────

export interface HoroscopeTeaserInput {
  /** Signe solaire natal (0-11). */
  natalSunSign:  number;
  /** Signe lunaire natal (0-11). */
  natalMoonSign: number;
  /** Date locale du jour (YYYY-MM-DD dans la tz de l'user). */
  localDate:     string;
  /** Langue canonique de génération. */
  locale:        "fr" | "en";
  /** ID utilisateur pour tracking xAI. */
  userId?:       string | null;
}

const SIGN_NAMES_FR = [
  "Bélier", "Taureau", "Gémeaux", "Cancer",
  "Lion", "Vierge", "Balance", "Scorpion",
  "Sagittaire", "Capricorne", "Verseau", "Poissons",
] as const;

const SIGN_NAMES_EN = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

function signName(idx: number, locale: "fr" | "en"): string {
  if (idx < 0 || idx > 11) return "?";
  return locale === "en" ? SIGN_NAMES_EN[idx]! : SIGN_NAMES_FR[idx]!;
}

// ──────────────────────────────────────────────────────────
// Fallback déterministe (sans LLM)
// ──────────────────────────────────────────────────────────

function buildFallbackTeaser(input: HoroscopeTeaserInput): string {
  const sun  = signName(input.natalSunSign,  input.locale);
  const moon = signName(input.natalMoonSign, input.locale);
  if (input.locale === "en") {
    return `Today's reading awaits — your Sun in ${sun} meets your Moon in ${moon} under fresh skies.`;
  }
  return `Ton horoscope du jour t'attend — ton Soleil ${sun} et ta Lune ${moon} sous un ciel renouvelé.`;
}

// ──────────────────────────────────────────────────────────
// Prompt LLM
// ──────────────────────────────────────────────────────────

function buildPrompt(input: HoroscopeTeaserInput): XaiMessage[] {
  const isEN = input.locale === "en";
  const sun  = signName(input.natalSunSign,  input.locale);
  const moon = signName(input.natalMoonSign, input.locale);

  const systemFR = `Tu es Kairos, voix astrologique du projet Llmastro.
Tu écris UNE phrase de teaser pour la notif quotidienne d'horoscope (8h du matin).
Style : poétique mais accessible, ancrée dans le concret du natal de l'user.
Tu donnes envie d'ouvrir l'app pour lire l'horoscope complet — sans le révéler.
1 à 2 phrases maximum, ~25 mots. Pas de salutation, pas de "Bonjour", entre directement.
Pas de prédictions catégoriques ; plutôt une invitation à la journée.`;

  const systemEN = `You are Kairos, the astrological voice of the Llmastro project.
You write ONE teaser sentence for the daily horoscope notification (8 AM).
Style: poetic but accessible, grounded in the user's natal chart specifics.
You make the user want to open the app for the full reading — without revealing it.
1 to 2 sentences maximum, ~25 words. No greeting, no "Hello", start directly.
No categorical predictions; rather an invitation to the day.`;

  const userFR = `Date : ${input.localDate}
Soleil natal : ${sun}
Lune natale : ${moon}

Rédige UNE phrase de teaser pour la notif horoscope du jour (français).`;

  const userEN = `Date: ${input.localDate}
Natal Sun: ${sun}
Natal Moon: ${moon}

Write ONE teaser sentence for today's horoscope notification (English).`;

  return [
    { role: "system", content: isEN ? systemEN : systemFR },
    { role: "user",   content: isEN ? userEN  : userFR  },
  ];
}

// ──────────────────────────────────────────────────────────
// API publique
// ──────────────────────────────────────────────────────────

/**
 * Génère le teaser dans la langue canonique de l'user. Pas de traduction
 * ici — la traduction est appliquée par le caller via translateEventNarrative
 * pour stocker `{ fr, en }` directement.
 *
 * Throw si xAI fail ; le caller catche et fallback sur buildFallbackTeaser.
 */
export async function generateHoroscopeTeaser(
  input: HoroscopeTeaserInput,
): Promise<string> {
  if (!xaiService.isConfigured()) {
    return buildFallbackTeaser(input);
  }
  const text = await xaiService.chat(buildPrompt(input), {
    temperature: 0.8,
    maxTokens:   100,
    timeoutMs:   15000,
    userId:      input.userId ?? null,
  });
  return text.trim();
}

export { buildFallbackTeaser, translateEventNarrative };

// DAILY-HOROSCOPE-NOTIF-V1 teaser service applied

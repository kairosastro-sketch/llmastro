// ============================================================
// apps/api/src/services/event-narrative.service.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// Génère un texte court et personnalisé Kairos pour un sky-event
// donné (éclipse, lunaison) en l'inscrivant dans le contexte du
// natal de l'utilisateur (Soleil/Lune + top aspects).
//
// Le texte est destiné à être affiché dans la <NotificationItem>
// du NotificationCenter (PR #E), donc :
//   - ton accessible (pas de jargon astro pointu)
//   - 3 à 5 phrases max (≈ 200 tokens, pour rester compact dans la UI)
//   - 1 angle clair : "voici ce qui arrive, voilà pourquoi c'est
//     pertinent pour toi"
//
// Tolérance / fallback :
//   - Si XAI_API_KEY n'est pas configuré → renvoie un template
//     déterministe (toujours utilisable, dégradé mais lisible).
//   - Si l'appel xAI throw → le caller (dispatcher PR #D) catche
//     et tombe sur le fallback aussi.
// ============================================================

import { xaiService, type XaiMessage } from "./ai.service.js";
import type {
  EclipseEvent,
  LunationEvent,
  LunationPhase,
} from "./sky-events.service.js";
import type { NotificationAspect } from "../types/notification-payload.js";

// ──────────────────────────────────────────────────────────
// Input
// ──────────────────────────────────────────────────────────

export interface EventNarrativeInput {
  /** Event tel que retourné par sky-events.service. */
  event: LunationEvent | EclipseEvent;

  /** Signe solaire natal de l'user (0–11). */
  natalSunSign: number;

  /** Signe lunaire natal de l'user (0–11). */
  natalMoonSign: number;

  /** Top 3 aspects formés au moment de l'event (event-relevance.service). */
  topAspects: NotificationAspect[];

  /** Langue cible. */
  locale: "fr" | "en";

  /** ID utilisateur pour tracking xAI (cf. logXaiCall). Optionnel. */
  userId?: string | null;
}

// ──────────────────────────────────────────────────────────
// Constantes — noms de signes / planètes / aspects par langue
// ──────────────────────────────────────────────────────────

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

const PLANET_NAMES_FR: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturne",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
  northNode: "Nœud Nord", southNode: "Nœud Sud",
};

const PLANET_NAMES_EN: Record<string, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturn",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
  northNode: "North Node", southNode: "South Node",
};

const ASPECT_NAMES_FR: Record<string, string> = {
  conjunction: "conjonction",
  opposition:  "opposition",
  trine:       "trigone",
  square:      "carré",
  sextile:     "sextile",
};

const ASPECT_NAMES_EN: Record<string, string> = {
  conjunction: "conjunction",
  opposition:  "opposition",
  trine:       "trine",
  square:      "square",
  sextile:     "sextile",
};

const LUNATION_PHASE_FR: Record<LunationPhase, string> = {
  new:           "Nouvelle Lune",
  first_quarter: "Premier Quartier",
  full:          "Pleine Lune",
  last_quarter:  "Dernier Quartier",
};

const LUNATION_PHASE_EN: Record<LunationPhase, string> = {
  new:           "New Moon",
  first_quarter: "First Quarter",
  full:          "Full Moon",
  last_quarter:  "Last Quarter",
};

// ──────────────────────────────────────────────────────────
// Helpers d'affichage
// ──────────────────────────────────────────────────────────

function signName(idx: number, locale: "fr" | "en"): string {
  if (idx < 0 || idx > 11) return "?";
  return locale === "en" ? SIGN_NAMES_EN[idx]! : SIGN_NAMES_FR[idx]!;
}

function planetName(key: string, locale: "fr" | "en"): string {
  const map = locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR;
  return map[key] ?? key;
}

function aspectName(type: string, locale: "fr" | "en"): string {
  const map = locale === "en" ? ASPECT_NAMES_EN : ASPECT_NAMES_FR;
  return map[type] ?? type;
}

function eventTitle(event: LunationEvent | EclipseEvent, locale: "fr" | "en"): string {
  if (event.type === "eclipse") {
    if (locale === "en") return event.kind === "solar" ? "Solar Eclipse" : "Lunar Eclipse";
    return event.kind === "solar" ? "Éclipse solaire" : "Éclipse lunaire";
  }
  // lunation
  return locale === "en"
    ? LUNATION_PHASE_EN[event.phase]
    : LUNATION_PHASE_FR[event.phase];
}

function formatAspectClause(a: NotificationAspect, locale: "fr" | "en"): string {
  const t = planetName(a.transitPlanet, locale);
  const n = planetName(a.natalPlanet, locale);
  const ty = aspectName(a.type, locale);
  return locale === "en"
    ? `transit ${t} in ${ty} with natal ${n}`
    : `${t} en transit en ${ty} avec ton ${n} natal`;
}

// ──────────────────────────────────────────────────────────
// Fallback déterministe (si LLM indisponible)
// ──────────────────────────────────────────────────────────

function buildFallbackNarrative(input: EventNarrativeInput): string {
  const title = eventTitle(input.event, input.locale);
  const aspectsText = input.topAspects
    .slice(0, 2)
    .map((a) => formatAspectClause(a, input.locale))
    .join(input.locale === "en" ? " and " : " et ");

  if (input.locale === "en") {
    if (aspectsText) {
      return `${title} approaching. It forms a strong link to your natal chart through ${aspectsText}. A meaningful moment to observe inner shifts and outer signals.`;
    }
    return `${title} approaching. A moment to pay attention to subtle shifts in your inner landscape.`;
  }

  // FR
  if (aspectsText) {
    return `${title} en approche. Elle entre en résonance avec ton thème natal via ${aspectsText}. Un moment significatif pour observer les mouvements intérieurs et les signaux extérieurs.`;
  }
  return `${title} en approche. Un moment propice pour porter attention aux glissements subtils de ton paysage intérieur.`;
}

// ──────────────────────────────────────────────────────────
// Construction du prompt LLM
// ──────────────────────────────────────────────────────────

function buildPrompt(input: EventNarrativeInput): XaiMessage[] {
  const isEN = input.locale === "en";
  const title = eventTitle(input.event, input.locale);
  const sun  = signName(input.natalSunSign,  input.locale);
  const moon = signName(input.natalMoonSign, input.locale);

  const aspectsList = input.topAspects.length === 0
    ? (isEN ? "(no significant aspect formed)" : "(aucun aspect significatif formé)")
    : input.topAspects
        .map((a) => `  - ${formatAspectClause(a, input.locale)} (orbe ${a.orb}°)`)
        .join("\n");

  const eventDate = new Date(input.event.date).toISOString().slice(0, 10);

  const systemFR = `Tu es Kairos, voix astrologique du projet Llmastro.
Style : posé, lucide, accessible. Pas de jargon ésotérique pointu.
Tu écris pour une notification de l'app : 3 à 5 phrases maximum.
Tu rends l'événement concret pour l'utilisateur : ce qui arrive, et pourquoi c'est pertinent pour SON thème natal.
Pas de prédictions catégoriques ("tu vas vivre X"). Plutôt des invitations à observer.
Pas de salutations, pas de formules d'introduction. Tu commences directement par l'événement.`;

  const systemEN = `You are Kairos, the astrological voice of the Llmastro project.
Style: grounded, clear-eyed, accessible. No obscure esoteric jargon.
You write for an in-app notification: 3 to 5 sentences max.
You make the event tangible for the user: what's happening, and why it matters for THEIR natal chart.
No categorical predictions ("you will experience X"). Rather, invitations to observe.
No greetings, no preambles. Start directly with the event.`;

  const userFR = `Événement : ${title}
Date : ${eventDate} (UTC)

Thème natal de l'utilisateur :
  - Soleil en ${sun}
  - Lune en ${moon}

Aspects formés au moment de l'événement :
${aspectsList}

Rédige le texte de notification (3 à 5 phrases, français).`;

  const userEN = `Event: ${title}
Date: ${eventDate} (UTC)

User's natal chart:
  - Sun in ${sun}
  - Moon in ${moon}

Aspects formed at the event time:
${aspectsList}

Write the notification text (3 to 5 sentences, English).`;

  return [
    { role: "system", content: isEN ? systemEN : systemFR },
    { role: "user",   content: isEN ? userEN  : userFR  },
  ];
}

// ──────────────────────────────────────────────────────────
// API publique
// ──────────────────────────────────────────────────────────

/**
 * Génère un texte court Kairos pour une notification d'événement cosmique.
 *
 * Stratégie :
 *   1) Si xAI configuré → appel LLM avec un prompt système Kairos +
 *      le contexte event/natal/aspects → texte 3–5 phrases.
 *   2) Sinon (clé absente, dev local sans crédit, etc.) → renvoie
 *      un fallback template déterministe, lisible, sans LLM.
 *
 * Le caller (dispatcher PR #D) catche également les erreurs réseau et
 * applique son propre fallback en stockant directement le template.
 * Cette double protection garantit qu'aucune notif ne reste sans
 * texte exploitable.
 */
export async function generateEventNarrative(
  input: EventNarrativeInput,
): Promise<string> {
  if (!xaiService.isConfigured()) {
    return buildFallbackNarrative(input);
  }

  const messages = buildPrompt(input);

  const text = await xaiService.chat(messages, {
    temperature: 0.85,
    maxTokens:   220,        // ~3-5 phrases de prose française
    timeoutMs:   20000,      // notif → on n'attend pas longtemps
    userId:      input.userId ?? null,
  });

  return text.trim();
}

// Exposé pour faciliter les tests éventuels et pour permettre au
// dispatcher de fallback explicitement si l'appel LLM throw.
export { buildFallbackNarrative };

// ──────────────────────────────────────────────────────────
// Traduction (bilinguer kairosText)
// ──────────────────────────────────────────────────────────

/**
 * Traduit un texte Kairos déjà généré dans une autre langue.
 *
 * Stratégie :
 *   - Prompt système qui demande à Grok de préserver la voix Kairos
 *     et la terminologie astrologique standard, sans regénérer.
 *   - temperature 0.2 (vs 0.85 pour la génération) → traduction stable,
 *     pas une regénération créative qui dévierait du sens.
 *   - timeout 15s (vs 20s pour la génération) → plus rapide attendu
 *     puisque le contexte est petit et le travail mécanique.
 *
 * Throw si xAI n'est pas configuré (le caller dispatcher catche et
 * tombe sur "translation absente" = best-effort, pas bloquant).
 */
export async function translateEventNarrative(params: {
  text:    string;
  from:    "fr" | "en";
  to:      "fr" | "en";
  userId?: string | null;
}): Promise<string> {
  if (!xaiService.isConfigured()) {
    throw new Error("xai-not-configured");
  }
  if (params.from === params.to) return params.text;

  const langName = (code: "fr" | "en") => code === "fr" ? "French" : "English";

  const system = `You translate astrology notifications for the Llmastro app.
Translate the user's message from ${langName(params.from)} to ${langName(params.to)}.
Preserve:
 - Kairos's voice: grounded, clear-eyed, accessible (no esoteric jargon).
 - The 3 to 5 sentence structure of the original.
 - Standard astrological terminology: use natural equivalents ("Pleine Lune"↔"Full Moon", "Soleil"↔"Sun", "trigone"↔"trine", "carré"↔"square", "Bélier"↔"Aries"…).
Do not add greetings, preambles, or commentary. Output only the translated text.`;

  const text = await xaiService.chat(
    [
      { role: "system", content: system },
      { role: "user",   content: params.text },
    ],
    {
      temperature: 0.2,
      maxTokens:   280,
      timeoutMs:   15000,
      userId:      params.userId ?? null,
    },
  );
  return text.trim();
}

// NOTIFICATIONS-V1 event-narrative applied

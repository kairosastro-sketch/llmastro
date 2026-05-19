// ============================================================
// apps/api/src/services/sky-llm.service.ts
// CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2
// ------------------------------------------------------------
// Génère DEUX interprétations Kairos pour chaque cadence :
//   • Lecture claire   — destinée au grand public, sans jargon
//   • Lecture technique — destinée aux praticiens, vocabulaire pro
//
// Chaque cadence a une cible de mots :
//   • day   : ~150 mots
//   • week  : ~225 mots
//   • month : ~250 mots
//   • year  : ~350 mots
//
// Mode dry-run : SKY_LLM_DRY_RUN=1 écrit un placeholder sans appeler xAI.
// Idempotent par champ : si llmText est rempli, skip clear ; si llmTextAdvanced
// est rempli, skip technique.
// Error-safe : les erreurs sont loguées mais ne propagent pas.
// ============================================================

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { skyPublication } from "../db/schema.js";
import { xaiService } from "./ai.service.js";
import {
  kairosToneDirective,
  kairosBiblioDirective,
} from "./ai-prompts.service.js";
import {
  type Cadence,
  getSkyPublication,
} from "./sky-publication.service.js";

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────

const DRY_RUN = process.env["SKY_LLM_DRY_RUN"] === "1";
const SKY_MODEL = process.env["SKY_LLM_MODEL"] ?? undefined;

const SIGN_NAMES_FR = [
  "Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
  "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons",
];

const PLANET_NAMES_FR: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturne",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
  northNode: "Nœud Nord", southNode: "Nœud Sud",
};

// ──────────────────────────────────────────────────────────
// Cadence profiles
// ──────────────────────────────────────────────────────────

interface CadenceProfile {
  scope:        string;
  targetWords:  number;
  maxTokens:    number;
}

const CADENCE_PROFILES: Record<Cadence, CadenceProfile> = {
  day:   { scope: "la journée d'aujourd'hui", targetWords: 150, maxTokens: 400 },
  week:  { scope: "la semaine en cours",      targetWords: 225, maxTokens: 550 },
  month: { scope: "le mois en cours",         targetWords: 250, maxTokens: 600 },
  year:  { scope: "l'année en cours",         targetWords: 350, maxTokens: 800 },
};

// Tone instructions par mode + cadence
const TONE_CLEAR: Record<Cadence, string> = {
  day:   "Ton intime, comme à un ami qui se réveille. Une seule idée centrale, ancrée dans le concret du jour. Évite la prophétie ; nomme ce que ce ciel rend disponible.",
  week:  "Ton orientation. Donne au lecteur une carte mentale de la semaine : un fil narratif (début / milieu / fin) sans découper en jours. Souligne 1 ou 2 inflexions notables, sans surcharger.",
  month: "Ton structurant. Le mois a sa propre architecture : présente-la comme un mouvement (les forces qui s'installent, celles qui culminent, celles qui se résolvent). Évite l'énumération.",
  year:  "Ton panoramique, presque littéraire. L'année a des chapitres ; pose 3 ou 4 grandes lignes qui la structurent. Reste sobre — c'est une vue d'ensemble, pas une prédiction.",
};

const TONE_TECHNICAL: Record<Cadence, string> = {
  day:   "Ton de praticien : précis, factuel, analytique. Tu peux mentionner les aspects par leur nom, les degrés, les phases techniques de la Lune.",
  week:  "Ton de praticien hebdomadaire : analyse les configurations majeures, les perfections d'aspects (jour exact si dispo), les moments-clés de la semaine.",
  month: "Ton de praticien mensuel : structure par phases lunaires, points de bascule, ingrès et stations marquants. Le lecteur connaît le vocabulaire.",
  year:  "Ton de praticien annuel : détaille les transits structurants des planètes lentes, les éclipses, les rétrogradations longues, les ingrès majeurs. Réfère-toi à Greene/Sasportas/Hand quand pertinent (sans surcharge bibliographique).",
};

// ──────────────────────────────────────────────────────────
// Format helpers
// ──────────────────────────────────────────────────────────

function formatPlanetSign(longitude: number): string {
  const idx = Math.floor(longitude / 30) % 12;
  const deg = Math.floor(longitude % 30);
  return `${deg}° ${SIGN_NAMES_FR[idx] ?? "?"}`;
}

function formatSkyContext(data: any, cadence: Cadence): string {
  const lines: string[] = [];

  if (data.planets) {
    const mainKeys = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
    const positions = mainKeys
      .map((k) => {
        const p = data.planets[k];
        if (!p?.longitude && p?.longitude !== 0) return null;
        const r = p.retrograde ? " ℞" : "";
        return `  - ${PLANET_NAMES_FR[k]} : ${formatPlanetSign(p.longitude)}${r}`;
      })
      .filter(Boolean);
    if (positions.length > 0) {
      lines.push("Positions principales :");
      lines.push(...(positions as string[]));
    }
  }

  if (data.moonPhase?.phase) {
    const illum = typeof data.moonPhase.illumination === "number"
      ? ` (${Math.round(data.moonPhase.illumination * 100)}% éclairée)`
      : "";
    lines.push(`Phase de Lune : ${data.moonPhase.phase}${illum}`);
  }

  if (Array.isArray(data.aspects) && data.aspects.length > 0) {
    const top = data.aspects.slice(0, 3);
    lines.push("Aspects en cours (top 3) :");
    for (const a of top) {
      const t = PLANET_NAMES_FR[a.transitPlanet] ?? a.transitPlanet;
      const n = PLANET_NAMES_FR[a.natalPlanet] ?? a.natalPlanet;
      const exact = a.exact ? " (exact)" : a.tight ? " (serré)" : "";
      lines.push(`  - ${t} ${a.typeFr.toLowerCase()} ${n}${exact}`);
    }
  }

  if (data.events) {
    const ev = data.events;
    if ((ev.eclipses?.length ?? 0) > 0) {
      const list = ev.eclipses
        .map((e: any) => `${e.date.slice(0, 10)} (${e.kind})`)
        .join(", ");
      lines.push(`Éclipses : ${list}`);
    }
    if ((ev.lunations?.length ?? 0) > 0 && cadence !== "day") {
      const summary = ev.lunations.length === 1
        ? `1 lunaison`
        : `${ev.lunations.length} lunaisons`;
      lines.push(`Lunaisons : ${summary}`);
    }
    if ((ev.stations?.length ?? 0) > 0) {
      const list = ev.stations
        .slice(0, 5)
        .map((s: any) => {
          const planet = PLANET_NAMES_FR[s.planet] ?? s.planet;
          return `${planet} ${s.direction === "retrograde" ? "rétrograde" : "direct"} (${s.date.slice(0, 10)})`;
        })
        .join(", ");
      lines.push(`Stations : ${list}`);
    }
    if ((ev.ingresses?.length ?? 0) > 0) {
      const slow = ev.ingresses.filter((g: any) =>
        ["jupiter", "saturn", "uranus", "neptune", "pluto", "northNode"].includes(g.planet),
      );
      if (slow.length > 0) {
        const list = slow
          .slice(0, 5)
          .map((g: any) => {
            const planet = PLANET_NAMES_FR[g.planet] ?? g.planet;
            const sign = SIGN_NAMES_FR[g.toSign] ?? "?";
            return `${planet} → ${sign} (${g.date.slice(0, 10)})`;
          })
          .join(", ");
        lines.push(`Ingrès des planètes lentes : ${list}`);
      }
    }
  }

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────
// Prompt builders — CLEAR (Lecture claire)
// ──────────────────────────────────────────────────────────

export function buildSkyPromptClear(
  cadence: Cadence,
  data: any,
  periodStart: string,
  periodEnd: string,
): { system: string; user: string } {
  const profile = CADENCE_PROFILES[cadence];

  const tone = kairosToneDirective("fr");
  const biblio = kairosBiblioDirective("fr");

  const system = `Tu es Kairos, voix astrologique de Llmastro.

${tone}

${biblio}

CONTEXTE — LECTURE CLAIRE
Tu écris la lecture publique du ciel pour ${profile.scope}, en mode "Lecture claire".
Le lecteur n'est PAS initié à l'astrologie. Il ne sait pas ce qu'est un sextile,
un trigone, ou un ingrès. Ton rôle : lui partager une qualité du temps, sans
le perdre dans le vocabulaire technique.

${TONE_CLEAR[cadence]}

CONTRAINTES DE FORME
- Prose continue, pas de listes, pas de titres, pas de markdown.
- Pas de salutation, pas d'au-revoir, pas de "Bonjour", pas de "Voici".
- N'invente pas de positions ou d'événements ; appuie-toi uniquement sur les données fournies.
- Vise environ ${profile.targetWords} mots.
- Si une donnée semble ambiguë (ex: orbe large), nuance plutôt que de prédire.
- N'utilise pas le mot "vous" si tu peux l'éviter ; préfère un "on" universel.
- Termine sur une note ouverte, pas une conclusion fermée.

LANGAGE — INTERDITS STRICTS
- Ne nomme JAMAIS les aspects par leur terme technique : interdits absolus de
  "sextile", "trigone", "carré", "opposition", "conjonction", "quinconce", "semi-carré".
- Ne mentionne JAMAIS un orbe, ni un degré chiffré, ni un signe d'aspect (□, △, ⚹, ☌, ☍).
- Ne nomme JAMAIS la phase de Lune par son terme technique
  ("gibbeuse décroissante", "premier quartier", "dernier quartier") —
  décris plutôt le mouvement (lumière qui monte / qui décroît, lune presque pleine, lune fine).
- Ne dis JAMAIS "ingrès" ; utilise "passe en", "entre en", "arrive en", "rejoint".
- N'utilise pas les noms d'auteurs (Greene, Sasportas, Hand, Jodorowsky...) — c'est trop référencé.

LANGAGE — TRADUCTIONS
- Pour les aspects harmoniques (sextile, trigone) : parle de "fluidité", "appui",
  "circulation entre", "soutien tacite", "élan que rien ne contrarie".
- Pour les aspects tendus (carré, opposition) : parle de "tension", "frottement",
  "à régler", "désaccord intérieur", "ce qui résiste".
- Pour les conjonctions : parle de "se fondre avec", "marcher ensemble", "se mêler à".

VIGILANCE GRAMMATICALE
- Vérifie soigneusement les accords de GENRE : "ancrage" est masculin (un ancrage),
  "élan" masculin, "intuition" féminin, "présence" féminin, "appui" masculin.
- Vérifie les accords en nombre.
- Vérifie l'usage de "à"/"a", "ces"/"ses", "où"/"ou", "leur"/"leurs".
- Relis-toi avant de rendre.

ANTI-REDONDANCE
- Une seule idée centrale par paragraphe ; ne la reformule pas.
- Ne reviens pas deux fois sur les mêmes planètes ou les mêmes signes.
- Si tu as plusieurs paragraphes, qu'ils prennent chacun un angle différent.`;

  const user = `Données du ciel pour ${profile.scope}
Période : ${periodStart.slice(0, 10)} → ${periodEnd.slice(0, 10)}

${formatSkyContext(data, cadence)}

Rédige maintenant la "Lecture claire" du ciel pour cette période.`;

  return { system, user };
}

// ──────────────────────────────────────────────────────────
// Prompt builders — TECHNICAL (Lecture technique)
// ──────────────────────────────────────────────────────────

export function buildSkyPromptTechnical(
  cadence: Cadence,
  data: any,
  periodStart: string,
  periodEnd: string,
): { system: string; user: string } {
  const profile = CADENCE_PROFILES[cadence];

  const tone = kairosToneDirective("fr");
  const biblio = kairosBiblioDirective("fr");

  const system = `Tu es Kairos, voix astrologique de Llmastro.

${tone}

${biblio}

CONTEXTE — LECTURE TECHNIQUE
Tu écris la lecture publique du ciel pour ${profile.scope}, en mode "Lecture technique".
Le lecteur EST initié à l'astrologie. Il connaît les aspects, les signes, les
maîtrises, les phases techniques de la Lune. Tu peux et dois utiliser le
vocabulaire pro, sans tomber dans le pédantisme. Précision avant tout.

${TONE_TECHNICAL[cadence]}

VOCABULAIRE AUTORISÉ
- Aspects par leur nom : sextile, trigone, carré, opposition, conjonction,
  quinconce, semi-carré, sesqui-carré.
- Orbes, en degrés (ex : "à 0.7° d'exact").
- Phases techniques de Lune : nouvelle Lune, premier quartier, gibbeuse croissante,
  pleine Lune, gibbeuse décroissante, dernier quartier, balsamique.
- Termes techniques : ingrès, station, périgée, apogée, déclinaison.
- Maîtres planétaires des signes : "Mars maître de Bélier", "Vénus maîtresse de
  Taureau et Balance", etc., quand pertinent.
- Référence sobre aux auteurs (Greene, Sasportas, Hand, Reinhart, Tarnas) si
  utile à un cadrage psychologique précis. Pas plus de 1 référence.

CONTRAINTES DE FORME
- Prose continue, pas de listes, pas de titres, pas de markdown.
- Pas de salutation, pas d'au-revoir.
- N'invente pas : appuie-toi strictement sur les données fournies.
- Vise environ ${profile.targetWords} mots.
- Si une donnée est ambiguë (orbe > 5°, aspect séparant), nuance.
- Termine sur une ouverture, pas une conclusion fermée.

VIGILANCE GRAMMATICALE
- Vérifie soigneusement les accords de GENRE et de NOMBRE.
- Vérifie l'usage de "à"/"a", "ces"/"ses", "où"/"ou", "leur"/"leurs".
- Relis-toi avant de rendre.

ANTI-REDONDANCE
- Pas de répétition d'un même aspect dans deux paragraphes.
- Évite de reciter les mêmes planètes en boucle.`;

  const user = `Données du ciel pour ${profile.scope}
Période : ${periodStart.slice(0, 10)} → ${periodEnd.slice(0, 10)}

${formatSkyContext(data, cadence)}

Rédige maintenant la "Lecture technique" du ciel pour cette période.`;

  return { system, user };
}

// ──────────────────────────────────────────────────────────
// LLM call generic
// ──────────────────────────────────────────────────────────

interface GenerateResult {
  text:  string;
  model: string;
}

async function generateSkyTextWith(
  prompt: { system: string; user: string },
  profile: CadenceProfile,
  variant: "clear" | "technical",
): Promise<GenerateResult> {
  if (DRY_RUN) {
    return {
      text: `[SKY_LLM_DRY_RUN ${variant}] Lecture placeholder.`,
      model: "dry-run",
    };
  }

  if (!xaiService.isConfigured()) {
    throw new Error("xAI not configured (XAI_API_KEY missing)");
  }

  const text = await xaiService.chat(
    [
      { role: "system", content: prompt.system },
      { role: "user",   content: prompt.user },
    ],
    {
      ...(SKY_MODEL ? { model: SKY_MODEL } : {}),
      temperature: 0.85,
      maxTokens: profile.maxTokens,
      timeoutMs: 60_000,
      userId: null,
    },
  );

  return {
    text:  text.trim(),
    model: SKY_MODEL ?? process.env["XAI_MODEL"] ?? "grok-4.3",
  };
}

// ──────────────────────────────────────────────────────────
// Persist (idempotent par champ + error-safe)
// ──────────────────────────────────────────────────────────

interface MinimalLogger {
  info:  (...a: any[]) => void;
  error: (...a: any[]) => void;
  warn?: (...a: any[]) => void;
}

/**
 * Pour chaque variant manquant (clear / technical), génère et persiste.
 * Idempotent par champ — si llmText ET llmTextAdvanced sont remplis, no-op.
 * Error-safe par variant — si l'un échoue, l'autre peut quand même réussir.
 *
 * Retourne `true` si au moins un variant a été (re)généré et persisté
 * pendant cet appel — le caller s'en sert pour déclencher la
 * revalidation du cache ISR côté web.
 */
export async function fillSkyLLMIfNeeded(
  cadence: Cadence,
  logger?: MinimalLogger,
): Promise<boolean> {
  let generated = false;
  let pub;
  try {
    pub = await getSkyPublication(cadence);
    if (!pub) {
      logger?.info?.({ cadence }, "[sky-llm] no publication yet, skipping");
      return false;
    }
  } catch (err) {
    logger?.error?.({ err, cadence }, "[sky-llm] cannot fetch publication");
    return false;
  }

  const periodStart = pub.periodStart instanceof Date
    ? pub.periodStart.toISOString()
    : String(pub.periodStart);
  const periodEnd = pub.periodEnd instanceof Date
    ? pub.periodEnd.toISOString()
    : String(pub.periodEnd);

  const profile = CADENCE_PROFILES[cadence];

  // ── Lecture claire ──
  if (!pub.llmText || pub.llmText.length === 0) {
    try {
      logger?.info?.({ cadence, variant: "clear" }, "[sky-llm] generating…");
      const startedAt = Date.now();
      const prompt = buildSkyPromptClear(cadence, pub.data, periodStart, periodEnd);
      const result = await generateSkyTextWith(prompt, profile, "clear");
      const elapsedMs = Date.now() - startedAt;

      await db
        .update(skyPublication)
        .set({
          llmText:        result.text,
          llmModel:       result.model,
          llmGeneratedAt: new Date(),
          updatedAt:      new Date(),
        })
        .where(eq(skyPublication.id, pub.id));

      generated = true;
      logger?.info?.(
        { cadence, variant: "clear", model: result.model, chars: result.text.length, elapsedMs },
        "[sky-llm] generated and persisted",
      );
    } catch (err) {
      logger?.error?.({ err, cadence, variant: "clear" }, "[sky-llm] generation failed (will retry)");
    }
  }

  // ── Lecture technique ──
  if (!pub.llmTextAdvanced || pub.llmTextAdvanced.length === 0) {
    try {
      logger?.info?.({ cadence, variant: "technical" }, "[sky-llm] generating…");
      const startedAt = Date.now();
      const prompt = buildSkyPromptTechnical(cadence, pub.data, periodStart, periodEnd);
      const result = await generateSkyTextWith(prompt, profile, "technical");
      const elapsedMs = Date.now() - startedAt;

      await db
        .update(skyPublication)
        .set({
          llmTextAdvanced:        result.text,
          llmAdvancedModel:       result.model,
          llmAdvancedGeneratedAt: new Date(),
          updatedAt:              new Date(),
        })
        .where(eq(skyPublication.id, pub.id));

      generated = true;
      logger?.info?.(
        { cadence, variant: "technical", model: result.model, chars: result.text.length, elapsedMs },
        "[sky-llm] generated and persisted",
      );
    } catch (err) {
      logger?.error?.({ err, cadence, variant: "technical" }, "[sky-llm] generation failed (will retry)");
    }
  }

  return generated;
}

// CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2 service applied

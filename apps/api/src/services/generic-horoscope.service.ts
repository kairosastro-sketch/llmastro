// ============================================================
// GENERIC-HOROSCOPES-V1
// apps/api/src/services/generic-horoscope.service.ts
// ------------------------------------------------------------
// Horoscopes génériques (12 signes solaires, non personnalisés)
// destinés à la syndication presse : générés chaque période
// (jour, semaine) depuis les FAITS du ciel (sky_publication —
// positions/aspects calculés serveur, jamais devinés), relus et
// éditables dans l'admin, servis aux quotidiens locaux via l'API
// partenaire (routes/partner.ts, clé x-api-key).
//
// Idempotence : UNIQUE(cadence, period_start, sign_idx). Un texte
// retouché à la main (edited=true) n'est jamais écrasé par la
// régénération globale — seule la régénération explicite d'un
// signe le remplace.
// ============================================================

import { and, eq, asc } from "drizzle-orm";

import { db } from "../db/index.js";
import { genericHoroscopes, type GenericHoroscopeRow } from "../db/schema.js";
import {
  ensureSkyPublication,
  getPeriodBounds,
  type Cadence,
} from "./sky-publication.service.js";
import { xaiService } from "./ai.service.js";

export type HoroscopeCadence = "day" | "week";
export const HOROSCOPE_CADENCES: readonly HoroscopeCadence[] = ["day", "week"];

export function isHoroscopeCadence(s: string): s is HoroscopeCadence {
  return s === "day" || s === "week";
}

export const SIGN_NAMES_FR = [
  "Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
  "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons",
] as const;

const PLANET_NAMES_FR: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturne", uranus: "Uranus",
  neptune: "Neptune", pluto: "Pluton", northNode: "Nœud Nord",
  southNode: "Nœud Sud", lilith: "Lilith", chiron: "Chiron",
};

// Même convention que sky-llm (SKY_LLM_DRY_RUN=1 → placeholder sans xAI).
const DRY_RUN = process.env["SKY_LLM_DRY_RUN"] === "1";
const SKY_MODEL = process.env["SKY_LLM_MODEL"] ?? undefined;

interface MinimalLogger {
  info:  (...a: any[]) => void;
  error: (...a: any[]) => void;
  warn?: (...a: any[]) => void;
}

// ──────────────────────────────────────────────────────────
// Faits du ciel → contexte compact pour le prompt
// ──────────────────────────────────────────────────────────

function formatFacts(data: any): string {
  const lines: string[] = [];

  const planets = data?.planets ?? {};
  const positions = Object.entries(planets)
    .filter(([k]) => PLANET_NAMES_FR[k])
    .map(([k, p]: [string, any]) => {
      const sign = SIGN_NAMES_FR[Math.floor((p.longitude ?? 0) / 30) % 12];
      return `${PLANET_NAMES_FR[k]} en ${sign}${p.retrograde ? " (rétrograde)" : ""}`;
    });
  lines.push(`Positions : ${positions.join(" · ")}`);

  const mp: any = data?.moonPhase;
  if (mp?.phase) {
    lines.push(`Lune : ${mp.phase}${typeof mp.illumination === "number" ? ` (${Math.round(mp.illumination * 100)} % éclairée)` : ""}`);
  }

  const aspects = (data?.aspects ?? [])
    .filter((a: any) => a.tight)
    .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 8)
    .map((a: any) =>
      `${PLANET_NAMES_FR[a.transitPlanet] ?? a.transitPlanet} ${a.typeFr ?? a.type} ${PLANET_NAMES_FR[a.natalPlanet] ?? a.natalPlanet}${a.exact ? " (exact)" : ""} [${a.tone}]`);
  if (aspects.length) lines.push(`Aspects marquants : ${aspects.join(" · ")}`);

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────
// Prompts
// ──────────────────────────────────────────────────────────

const PERIOD_LABEL: Record<HoroscopeCadence, string> = {
  day:  "du jour",
  week: "de la semaine",
};

function buildSystemPrompt(cadence: HoroscopeCadence): string {
  return `Tu écris les horoscopes ${PERIOD_LABEL[cadence]} destinés à la presse quotidienne régionale française.

REGISTRE PRESSE
- Vouvoiement ("vous"), ton chaleureux, concret et positif sans être naïf.
- Chaque texte doit être autonome, compréhensible par un lecteur non initié.
- 380 à 480 caractères par signe (espaces comprises) — format colonne de journal.
- Prose continue : pas de listes, pas de titres, pas de markdown, pas d'emoji.
- Pas de salutation ni de formule d'adresse ("Chers Béliers" interdit).

ANCRAGE DANS LES FAITS
- Appuie-toi UNIQUEMENT sur les données du ciel fournies ; n'invente ni position ni événement.
- Au plus une référence céleste concrète par signe (ex. "Vénus traverse votre signe",
  "la Lune décroissante invite au tri") — le reste en langage de la vie quotidienne
  (relations, travail, énergie, finances, intuition).
- Jamais de vocabulaire technique : "sextile", "trigone", "carré", "opposition",
  "conjonction", "orbe", "ingrès", "rétrogradation" sont interdits — traduis
  ("un appui discret", "une tension à régler", "un retour en arrière utile").
- Pas de prédiction catégorique (santé, argent, rupture) : des inclinations, pas des verdicts.

QUALITÉ
- Les 12 textes doivent être réellement DIFFÉRENTS entre eux (angles, domaines, rythme).
- Accords de genre et de nombre soignés ; relis chaque texte.
- Pas deux signes qui commencent par la même tournure.`;
}

function buildBatchUserPrompt(
  cadence: HoroscopeCadence,
  data: any,
  periodStart: string,
  periodEnd: string,
): string {
  return `Ciel ${PERIOD_LABEL[cadence]} — période ${periodStart.slice(0, 10)} → ${periodEnd.slice(0, 10)}

${formatFacts(data)}

Rédige l'horoscope ${PERIOD_LABEL[cadence]} des 12 signes, dans l'ordre zodiacal
(Bélier, Taureau, Gémeaux, Cancer, Lion, Vierge, Balance, Scorpion, Sagittaire,
Capricorne, Verseau, Poissons).

Réponds en JSON STRICT, sans aucun texte autour :
{"signs": ["texte Bélier", "texte Taureau", ..., "texte Poissons"]}
Le tableau "signs" contient exactement 12 chaînes.`;
}

function buildSingleUserPrompt(
  cadence: HoroscopeCadence,
  data: any,
  periodStart: string,
  periodEnd: string,
  signIdx: number,
): string {
  return `Ciel ${PERIOD_LABEL[cadence]} — période ${periodStart.slice(0, 10)} → ${periodEnd.slice(0, 10)}

${formatFacts(data)}

Rédige UNIQUEMENT l'horoscope ${PERIOD_LABEL[cadence]} du signe ${SIGN_NAMES_FR[signIdx]}.

Réponds en JSON STRICT, sans aucun texte autour : {"text": "..."}`;
}

// ──────────────────────────────────────────────────────────
// Génération LLM
// ──────────────────────────────────────────────────────────

function modelName(): string {
  return SKY_MODEL ?? process.env["XAI_MODEL"] ?? "unknown";
}

function checkText(t: unknown, label: string): asserts t is string {
  if (typeof t !== "string" || t.trim().length < 120 || t.length > 900) {
    throw new Error(`texte ${label} invalide (longueur ${typeof t === "string" ? t.length : "n/a"})`);
  }
}

async function generateAllTexts(
  cadence: HoroscopeCadence,
  data: any,
  periodStart: string,
  periodEnd: string,
): Promise<string[]> {
  if (DRY_RUN) {
    return SIGN_NAMES_FR.map((s) => `[DRY_RUN ${cadence}] Horoscope ${s} — placeholder de développement, longueur calibrée pour passer la validation du service de génération générique presse.`);
  }
  if (!xaiService.isConfigured()) throw new Error("xAI not configured (XAI_API_KEY missing)");

  const parsed = await xaiService.chatJSON<{ signs: string[] }>(
    [
      { role: "system", content: buildSystemPrompt(cadence) },
      { role: "user",   content: buildBatchUserPrompt(cadence, data, periodStart, periodEnd) },
    ],
    {
      ...(SKY_MODEL ? { model: SKY_MODEL } : {}),
      temperature: 0.8,
      maxTokens: 4096,
      timeoutMs: 120_000,
      userId: null,
      validate: (p) => {
        if (!Array.isArray(p.signs) || p.signs.length !== 12) {
          throw new Error(`attendu 12 signes, reçu ${Array.isArray(p?.signs) ? p.signs.length : "rien"}`);
        }
        p.signs.forEach((t, i) => checkText(t, SIGN_NAMES_FR[i]!));
      },
    },
  );
  return parsed.signs.map((t) => t.trim());
}

async function generateOneText(
  cadence: HoroscopeCadence,
  data: any,
  periodStart: string,
  periodEnd: string,
  signIdx: number,
): Promise<string> {
  if (DRY_RUN) {
    return `[DRY_RUN ${cadence}] Horoscope ${SIGN_NAMES_FR[signIdx]} régénéré — placeholder de développement, longueur calibrée pour passer la validation du service générique presse.`;
  }
  if (!xaiService.isConfigured()) throw new Error("xAI not configured (XAI_API_KEY missing)");

  const parsed = await xaiService.chatJSON<{ text: string }>(
    [
      { role: "system", content: buildSystemPrompt(cadence) },
      { role: "user",   content: buildSingleUserPrompt(cadence, data, periodStart, periodEnd, signIdx) },
    ],
    {
      ...(SKY_MODEL ? { model: SKY_MODEL } : {}),
      temperature: 0.85,
      maxTokens: 600,
      timeoutMs: 60_000,
      userId: null,
      validate: (p) => checkText(p.text, SIGN_NAMES_FR[signIdx]!),
    },
  );
  return parsed.text.trim();
}

// ──────────────────────────────────────────────────────────
// API du service
// ──────────────────────────────────────────────────────────

/** Lignes d'une édition, triées par signe (peut être vide si non générée). */
export async function getGenericHoroscopes(
  cadence: HoroscopeCadence,
  ref: Date = new Date(),
): Promise<{ periodStart: Date; periodEnd: Date; rows: GenericHoroscopeRow[] }> {
  const { start, end } = getPeriodBounds(cadence as Cadence, ref);
  const rows = await db
    .select()
    .from(genericHoroscopes)
    .where(and(eq(genericHoroscopes.cadence, cadence), eq(genericHoroscopes.periodStart, start)))
    .orderBy(asc(genericHoroscopes.signIdx));
  return { periodStart: start, periodEnd: end, rows };
}

/**
 * Génère l'édition de la période courante si elle n'existe pas encore
 * (les 12 signes en un appel LLM). Idempotent et race-safe (ON CONFLICT
 * DO NOTHING sur l'unique). Retourne true si une génération a eu lieu.
 */
export async function ensureGenericHoroscopes(
  cadence: HoroscopeCadence,
  logger?: MinimalLogger,
): Promise<boolean> {
  const { start, end, existing } = await (async () => {
    const r = await getGenericHoroscopes(cadence);
    return { start: r.periodStart, end: r.periodEnd, existing: r.rows };
  })();
  if (existing.length >= 12) return false;

  const pub = await ensureSkyPublication(cadence as Cadence);
  const texts = await generateAllTexts(
    cadence, pub.data,
    start.toISOString(), end.toISOString(),
  );

  const have = new Set(existing.map((r) => r.signIdx));
  const values = texts
    .map((text, signIdx) => ({ cadence, periodStart: start, signIdx, text, llmModel: modelName() }))
    .filter((v) => !have.has(v.signIdx));
  if (values.length > 0) {
    await db.insert(genericHoroscopes).values(values).onConflictDoNothing();
  }
  logger?.info({ cadence, periodStart: start.toISOString(), inserted: values.length }, "[generic-horoscopes] edition generated");
  return true;
}

/**
 * Régénère un signe précis (écrase, même édité — action explicite de
 * l'admin) ou toute l'édition (en préservant les textes edited=true).
 */
export async function regenerateGenericHoroscopes(
  cadence: HoroscopeCadence,
  signIdx: number | null,
  logger?: MinimalLogger,
): Promise<GenericHoroscopeRow[]> {
  const { periodStart, periodEnd, rows } = await getGenericHoroscopes(cadence);
  const pub = await ensureSkyPublication(cadence as Cadence);
  const startISO = periodStart.toISOString();
  const endISO = periodEnd.toISOString();

  if (signIdx !== null) {
    const text = await generateOneText(cadence, pub.data, startISO, endISO, signIdx);
    await db
      .insert(genericHoroscopes)
      .values({ cadence, periodStart, signIdx, text, llmModel: modelName() })
      .onConflictDoUpdate({
        target: [genericHoroscopes.cadence, genericHoroscopes.periodStart, genericHoroscopes.signIdx],
        set: { text, edited: false, llmModel: modelName(), generatedAt: new Date(), updatedAt: new Date() },
      });
  } else {
    const texts = await generateAllTexts(cadence, pub.data, startISO, endISO);
    const editedSigns = new Set(rows.filter((r) => r.edited).map((r) => r.signIdx));
    for (let i = 0; i < 12; i++) {
      if (editedSigns.has(i)) continue; // ne jamais écraser une retouche manuelle
      await db
        .insert(genericHoroscopes)
        .values({ cadence, periodStart, signIdx: i, text: texts[i]!, llmModel: modelName() })
        .onConflictDoUpdate({
          target: [genericHoroscopes.cadence, genericHoroscopes.periodStart, genericHoroscopes.signIdx],
          set: { text: texts[i]!, edited: false, llmModel: modelName(), generatedAt: new Date(), updatedAt: new Date() },
        });
    }
    logger?.info({ cadence, skippedEdited: editedSigns.size }, "[generic-horoscopes] edition regenerated");
  }

  return (await getGenericHoroscopes(cadence)).rows;
}

/** Retouche manuelle d'un texte (admin) — marque edited=true. */
export async function updateGenericHoroscopeText(
  id: string,
  text: string,
): Promise<GenericHoroscopeRow | null> {
  const updated = await db
    .update(genericHoroscopes)
    .set({ text: text.trim(), edited: true, updatedAt: new Date() })
    .where(eq(genericHoroscopes.id, id))
    .returning();
  return updated[0] ?? null;
}

// GENERIC-HOROSCOPES-V1 applied

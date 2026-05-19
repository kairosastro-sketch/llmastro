// ============================================================
// xAI (Grok) Service — client wrapper compatible OpenAI chat API
// Base URL:  https://api.x.ai/v1
// Endpoint:  POST /chat/completions
// Auth:      Authorization: Bearer $XAI_API_KEY
// ============================================================

import { logXaiCall } from "./xai-log.service.js";

export interface XaiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface XaiCallOptions {
  model?:       string;
  temperature?: number;
  maxTokens?:   number;
  jsonMode?:    boolean;
  timeoutMs?:   number;
  // ADMIN-STATS-V1-BACKEND : associe l'appel à un user pour le tracking
  userId?:      string | null;
  // HOTFIX-GROK-RETRY-V1 : nombre max de tentatives sur erreur transitoire
  maxAttempts?: number;
}

interface XaiCompletion {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const DEFAULT_MODEL    = process.env["XAI_MODEL"]    ?? "grok-4-1-fast-non-reasoning";
const DEFAULT_TIMEOUT  = parseInt(process.env["XAI_TIMEOUT_MS"] ?? "45000", 10);
const XAI_API_KEY      = process.env["XAI_API_KEY"]  ?? "";
const XAI_BASE_URL     = process.env["XAI_BASE_URL"] ?? "https://api.x.ai/v1";

// HOTFIX-GROK-RETRY-V1
// xAI renvoie régulièrement des erreurs transitoires (5xx, coupures
// réseau, timeouts) ou des réponses tronquées (finish_reason=length).
// Sans retry, l'horoscope du jour échoue en silence ("Kairos est
// silencieux") ou se fige sur une génération incomplète mise en cache.
// On retente donc côté serveur les échecs transitoires.
const DEFAULT_MAX_ATTEMPTS = Math.max(1, parseInt(process.env["XAI_MAX_ATTEMPTS"] ?? "3", 10));

const RETRIABLE_ERROR_KINDS = new Set([
  "timeout",
  "fetch_error",
  "empty_content",
  "truncated",
  "http_408",
  "http_429",
  "http_500",
  "http_502",
  "http_503",
  "http_504",
]);

// Attache le type d'erreur à l'exception pour piloter le retry.
function errorKindOf(e: unknown): string | null {
  return e && typeof e === "object" && "xaiErrorKind" in e
    ? ((e as { xaiErrorKind?: string }).xaiErrorKind ?? null)
    : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class XaiService {
  isConfigured(): boolean {
    return XAI_API_KEY.length > 0;
  }

  /**
   * Une tentative d'appel chat completion.
   * Throw une Error portant `xaiErrorKind` pour piloter le retry.
   */
  private async chatOnce(
    messages: XaiMessage[],
    options: XaiCallOptions,
  ): Promise<string> {
    const model       = options.model       ?? DEFAULT_MODEL;
    const temperature = options.temperature ?? 0.85;
    const maxTokens   = options.maxTokens   ?? 1200;
    const timeoutMs   = options.timeoutMs   ?? DEFAULT_TIMEOUT;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (options.jsonMode) {
      body["response_format"] = { type: "json_object" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // ADMIN-STATS-V1-BACKEND : tracking de l'appel
    const t0 = Date.now();
    let success = false;
    let errorKind: string | null = null;
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      const resp = await fetch(`${XAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        errorKind = `http_${resp.status}`;
        throw new Error(`xAI API error ${resp.status}: ${errText.slice(0, 300)}`);
      }

      const json = (await resp.json()) as XaiCompletion;
      const text = json.choices?.[0]?.message?.content ?? "";
      const finishReason = json.choices?.[0]?.finish_reason ?? "";
      tokensIn  = json.usage?.prompt_tokens     ?? 0;
      tokensOut = json.usage?.completion_tokens ?? 0;

      if (!text) {
        errorKind = "empty_content";
        throw new Error("xAI returned empty content");
      }

      // HOTFIX-GROK-RETRY-V1 : une réponse coupée par max_tokens donne
      // un JSON invalide ou incomplet. On la rejette pour les appels
      // jsonMode afin qu'elle soit retentée plutôt que mise en cache.
      // En texte libre (ex. teaser), une coupure reste exploitable.
      if (finishReason === "length" && options.jsonMode) {
        errorKind = "truncated";
        throw new Error("xAI response truncated (finish_reason=length)");
      }

      success = true;
      return text;
    } catch (e) {
      if (errorKind === null) {
        const msg = e instanceof Error ? e.message : "unknown";
        errorKind = msg.includes("aborted") ? "timeout" : "fetch_error";
      }
      if (e && typeof e === "object") {
        (e as { xaiErrorKind?: string }).xaiErrorKind = errorKind;
      }
      throw e;
    } finally {
      clearTimeout(timer);
      logXaiCall({
        userId:    options.userId ?? null,
        model,
        tokensIn,
        tokensOut,
        latencyMs: Date.now() - t0,
        success,
        errorKind,
      });
    }
  }

  /**
   * Appel principal — chat completion, avec retry des échecs transitoires.
   * Renvoie le texte de la réponse assistant.
   */
  async chat(
    messages: XaiMessage[],
    options: XaiCallOptions = {},
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("XAI_API_KEY is not configured on the server");
    }

    const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.chatOnce(messages, options);
      } catch (e) {
        lastErr = e;
        const kind = errorKindOf(e);
        const retriable = kind !== null && RETRIABLE_ERROR_KINDS.has(kind);
        // Un timeout coûte cher : on ne le retente qu'une seule fois.
        const timeoutBudgetSpent = kind === "timeout" && attempt >= 2;
        if (attempt >= maxAttempts || !retriable || timeoutBudgetSpent) {
          throw e;
        }
        await sleep(300 * 2 ** (attempt - 1));
      }
    }

    throw lastErr;
  }

  /**
   * Appel qui force le parsing JSON.
   * Utile pour les réponses structurées (horoscope, profil psycho).
   * Retente si la réponse n'est pas un JSON valide OU si le `validate`
   * fourni la rejette (ex. horoscope incomplet).
   *
   * HOTFIX-GROK-RETRY-V1 : `grok-4-1-fast-non-reasoning` produit parfois
   * un JSON syntaxiquement valide mais sémantiquement incomplet (champs
   * vides, thème bâclé) en s'arrêtant de lui-même — `finish_reason` vaut
   * alors "stop". Un simple parsing ne suffit pas : on laisse le caller
   * valider la forme attendue via `validate`.
   */
  async chatJSON<T = Record<string, unknown>>(
    messages: XaiMessage[],
    options: Omit<XaiCallOptions, "jsonMode"> & { validate?: (parsed: T) => void } = {},
  ): Promise<T> {
    const { validate, ...callOptions } = options;
    const maxAttempts = Math.max(1, callOptions.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const raw = await this.chat(messages, { ...callOptions, jsonMode: true });
      try {
        // Supprime d'éventuels ```json ... ```
        const cleaned = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        const parsed = JSON.parse(cleaned) as T;
        if (validate) validate(parsed);
        return parsed;
      } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown";
        lastErr = err instanceof SyntaxError
          ? new Error(`Failed to parse xAI JSON response: ${reason}\n\nRaw: ${raw.slice(0, 500)}`)
          : new Error(`xAI JSON response rejected: ${reason}`);
        if (attempt >= maxAttempts) break;
        await sleep(300 * 2 ** (attempt - 1));
      }
    }

    throw lastErr;
  }
}

export const xaiService = new XaiService();

// ADMIN-STATS-V1-BACKEND applied
// HOTFIX-GROK-RETRY-V1 applied

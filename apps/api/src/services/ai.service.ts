// ============================================================
// xAI (Grok) Service — client wrapper compatible OpenAI chat API
// Base URL:  https://api.x.ai/v1
// Endpoint:  POST /chat/completions
// Auth:      Authorization: Bearer $XAI_API_KEY
// ============================================================

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

export class XaiService {
  isConfigured(): boolean {
    return XAI_API_KEY.length > 0;
  }

  /**
   * Appel principal — chat completion.
   * Renvoie le texte de la réponse assistant.
   */
  async chat(
    messages: XaiMessage[],
    options: XaiCallOptions = {},
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("XAI_API_KEY is not configured on the server");
    }

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
        throw new Error(`xAI API error ${resp.status}: ${errText.slice(0, 300)}`);
      }

      const json = (await resp.json()) as XaiCompletion;
      const text = json.choices?.[0]?.message?.content ?? "";

      if (!text) {
        throw new Error("xAI returned empty content");
      }

      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Appel qui force le parsing JSON.
   * Utile pour les réponses structurées (horoscope, profil psycho).
   */
  async chatJSON<T = Record<string, unknown>>(
    messages: XaiMessage[],
    options: Omit<XaiCallOptions, "jsonMode"> = {},
  ): Promise<T> {
    const raw = await this.chat(messages, { ...options, jsonMode: true });
    try {
      // Supprime d'éventuels ```json ... ```
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      return JSON.parse(cleaned) as T;
    } catch (err) {
      throw new Error(
        `Failed to parse xAI JSON response: ${err instanceof Error ? err.message : "unknown"}\n\nRaw: ${raw.slice(0, 500)}`
      );
    }
  }
}

export const xaiService = new XaiService();

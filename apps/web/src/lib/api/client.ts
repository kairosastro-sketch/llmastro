import type { ApiResponse } from "@astro-platform/types";
import { maybeEmitTiersError } from "@/lib/tiers/api-hook";

/* PATCH-MENAGE-V1 tier-error-class */
/**
 * TierError — jeter par les fonctions API quand maybeEmitTiersError
 * a déjà ouvert le PaywallModal. Les composants UI peuvent faire
 * `if (e instanceof TierError) return null;` pour éviter d'afficher
 * un message d'erreur en doublon avec le modal.
 */
export class TierError extends Error {
  constructor(message = 'Tier-related error (paywall opened)') {
    super(message);
    this.name = 'TierError';
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ----------------------------------------------------------
// Core client
// ----------------------------------------------------------
class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private headers(extra?: Record<string, string>): HeadersInit {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      ...extra,
    };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string
  ): Promise<ApiResponse<T>> {
    const headers = token
      ? { ...this.headers(), Authorization: `Bearer ${token}` }
      : this.headers();

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body != null ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as ApiResponse<T>;

    if (!res.ok || !json.success) {
      if (maybeEmitTiersError(json)) throw new TierError(); // ARCHIVE-4-TIERS-UI-V1
      const err = !json.success ? json.error : { code: "HTTP_ERROR", message: res.statusText };
      throw Object.assign(new Error(err.message), {
        code:       err.code,
        statusCode: res.status,
        details:    !json.success ? json.error.details : undefined,
      });
    }

    return json;
  }

  get<T>(path: string, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, token);
  }

  post<T>(path: string, body: unknown, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body, token);
  }

  patch<T>(path: string, body: unknown, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, body, token);
  }

  delete<T>(path: string, bodyOrToken?: unknown, token?: string): Promise<ApiResponse<T>> {
    // [ACCOUNT-DELETE-V1-FIX-V1] Rétrocompat : si arg2 est une string,
    // c'est l'ancien usage delete(path, token). Sinon c'est un body.
    if (typeof bodyOrToken === "string") {
      return this.request<T>("DELETE", path, undefined, bodyOrToken);
    }
    return this.request<T>("DELETE", path, bodyOrToken, token);
  }
}

export const apiClient = new ApiClient();

// ----------------------------------------------------------
// Resource helpers
// ----------------------------------------------------------
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    apiClient.post("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    apiClient.post("/auth/login", data),

  me: (token: string) => apiClient.get("/auth/me", token),

  googleUrl:  () => `${API_BASE}/auth/google`,
  githubUrl:  () => `${API_BASE}/auth/github`,
};

export const natalApi = {
  list: (token: string) =>
    apiClient.get<{ profiles: unknown[] }>("/natal", token),

  create: (token: string, data: unknown) =>
    apiClient.post("/natal", data, token),

  get: (token: string, id: string) =>
    apiClient.get(`/natal/${id}`, token),

  update: (token: string, id: string, data: unknown) =>
    apiClient.patch(`/natal/${id}`, data, token),

  delete: (token: string, id: string) =>
    apiClient.delete(`/natal/${id}`, token),
};

export const ephemerisApi = {
  calculate: (token: string, natalId: string, houseSystem = "P") =>
    apiClient.post(`/ephemeris/calculate/${natalId}?houseSystem=${houseSystem}`, {}, token),

  getChart: (token: string, natalId: string) =>
    apiClient.get(`/ephemeris/chart/${natalId}`, token),
};


// ──────────────────────────────────────────────────────────
// Synastrie / compatibilité romantique
// ──────────────────────────────────────────────────────────

export type CompatPartnerRef =
  | { type: "saved"; natalId: string }
  | { type: "adhoc"; label: string; birthDate: string; birthTime?: string; birthCity: string };

export interface CompatRequest {
  partnerA: CompatPartnerRef;
  partnerB: CompatPartnerRef;
  locale?: "fr" | "en";
}

export const compatApi = {
  analyze: (token: string, body: CompatRequest) =>
    apiClient.post("/compat/analyze", body, token),
};

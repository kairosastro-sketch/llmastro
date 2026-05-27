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
    token?: string,
    opts?: RequestOpts,
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
      // HOROSCOPE-INLINE-PAYWALL-V1 : skipPaywall=true permet à un caller
      // d'opt-out du PaywallModal global pour gérer l'erreur tier en
      // inline (cf. /dashboard/horoscope qui affiche un teaser custom).
      // L'erreur reste throw — c'est juste le modal qui n'est pas
      // déclenché.
      if (!opts?.skipPaywall && maybeEmitTiersError(json)) throw new TierError();
      const err = !json.success ? json.error : { code: "HTTP_ERROR", message: res.statusText };
      throw Object.assign(new Error(err.message), {
        code:       err.code,
        statusCode: res.status,
        details:    !json.success ? json.error.details : undefined,
      });
    }

    return json;
  }

  get<T>(path: string, token?: string, opts?: RequestOpts): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, token, opts);
  }

  post<T>(path: string, body: unknown, token?: string, opts?: RequestOpts): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body, token, opts);
  }

  patch<T>(path: string, body: unknown, token?: string, opts?: RequestOpts): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, body, token, opts);
  }

  delete<T>(path: string, bodyOrToken?: unknown, token?: string, opts?: RequestOpts): Promise<ApiResponse<T>> {
    // [ACCOUNT-DELETE-V1-FIX-V1] Rétrocompat : si arg2 est une string,
    // c'est l'ancien usage delete(path, token). Sinon c'est un body.
    if (typeof bodyOrToken === "string") {
      return this.request<T>("DELETE", path, undefined, bodyOrToken, opts);
    }
    return this.request<T>("DELETE", path, bodyOrToken, token, opts);
  }
}

/** HOROSCOPE-INLINE-PAYWALL-V1 — options par-appel pour le client API. */
export interface RequestOpts {
  /** Si true, n'émet pas l'event tier-error qui ouvre le PaywallModal
   *  global. L'erreur est tout de même thrown (avec statusCode/code).
   *  Utile quand la page gère elle-même l'UX paywall en inline. */
  skipPaywall?: boolean;
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

// ----------------------------------------------------------
// ADMIN-FOUNDATION-V1-FRONTEND — admin business endpoints
// ----------------------------------------------------------
export const adminApi = {
  me: (token: string) =>
    apiClient.get("/admin-panel/me", token),

  listUsers: (
    token: string,
    params: { q?: string; page?: number; limit?: number } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.q)     qs.set("q",     params.q);
    if (params.page)  qs.set("page",  String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get(`/admin-panel/users${suffix}`, token);
  },

  getUser: (token: string, id: string) =>
    apiClient.get(`/admin-panel/users/${id}`, token),

  changePlan: (token: string, id: string, planCode: string) =>
    apiClient.post(`/admin-panel/users/${id}/plan`, { plan_code: planCode }, token),
};

// ADMIN-FOUNDATION-V1-FRONTEND applied

// ----------------------------------------------------------
// ADMIN-STATS-V1-FRONTEND — admin stats endpoints
// ----------------------------------------------------------
export const adminStatsApi = {
  overview: (token: string) =>
    apiClient.get("/admin-panel/stats/overview", token),

  connections: (token: string, days = 7) =>
    apiClient.get(`/admin-panel/stats/connections?days=${days}`, token),

  xai: (token: string, days = 7) =>
    apiClient.get(`/admin-panel/stats/xai?days=${days}`, token),
};

// ADMIN-STATS-V1-FRONTEND applied

// ----------------------------------------------------------
// GROWTH-V1-ADMIN-FRONTEND — admin affiliates endpoints
// ----------------------------------------------------------
export const adminAffiliatesApi = {
  list: (
    token: string,
    params: { q?: string; status?: string; page?: number; limit?: number } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.q)      qs.set("q",      params.q);
    if (params.status) qs.set("status", params.status);
    if (params.page)   qs.set("page",   String(params.page));
    if (params.limit)  qs.set("limit",  String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get(`/admin-panel/affiliates${suffix}`, token);
  },

  get: (token: string, id: string) =>
    apiClient.get(`/admin-panel/affiliates/${id}`, token),

  update: (
    token: string,
    id: string,
    body: {
      tier?:                       string;
      commission_pct_override?:    number | null;
      commission_months_override?: number | null;
      status?:                     string;
      reason?:                     string;
    },
  ) => apiClient.patch(`/admin-panel/affiliates/${id}`, body, token),

  attachUser: (token: string, id: string, email: string) =>
    apiClient.post(`/admin-panel/affiliates/${id}/attach-user`, { email }, token),
};

// GROWTH-V1-ADMIN-FRONTEND applied

// ----------------------------------------------------------
// GROWTH-V1-PARRAINAGE-UI — referral stats endpoint
// ----------------------------------------------------------
export interface ReferralStatsPayload {
  code: string;
  totals: { invited: number; activated: number; rewarded: number };
  capMonth: { used: number; max: number; resetsAt: string };
}

export const referralsApi = {
  me: (token: string) =>
    apiClient.get<ReferralStatsPayload>("/referrals/me", token),
};

// GROWTH-V1-PARRAINAGE-UI applied

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

// CONTACT-FORM-V1 — formulaire de contact public
export const contactApi = {
  send: (data: {
    name: string;
    email: string;
    subject?: string;
    message: string;
    website?: string;
  }) => apiClient.post<{ sent: boolean }>("/contact", data),
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

  // ANALYTICS-V1 — audience
  pages: (token: string, days = 7) =>
    apiClient.get(`/admin-panel/stats/pages?days=${days}`, token),

  engagement: (token: string, days = 7) =>
    apiClient.get(`/admin-panel/stats/engagement?days=${days}`, token),
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

// GROWTH-REFERRAL-CONVERSION-V1 — bons cadeaux gagnés par le parrain.
export interface GiftCodeView {
  code:       string;
  status:     "unused" | "redeemed" | "expired";
  expiresAt:  string;
  redeemedAt: string | null;
  createdAt:  string;
}

export interface GiftRedeemResult {
  grantedPlan:  string;
  grantedDays:  number;
  newPeriodEnd: string;
}

export const referralsApi = {
  me: (token: string) =>
    apiClient.get<ReferralStatsPayload>("/referrals/me", token),

  // GROWTH-REFERRAL-CONVERSION-V1 : bons « 1 mois Essentiel » gagnés.
  gifts: (token: string) =>
    apiClient.get<{ codes: GiftCodeView[] }>("/referrals/me/gifts", token),

  redeemGift: (token: string, code: string) =>
    apiClient.post<GiftRedeemResult>("/auth/redeem-gift", { code }, token, { skipPaywall: true }),
};

// GROWTH-V1-PARRAINAGE-UI applied

// ----------------------------------------------------------
// STRIPE-MVP-V1 — checkout + customer portal
// ----------------------------------------------------------
export const subscriptionsApi = {
  // PRICING-ANNUAL-V1 : `period` choisit le Price ID mensuel ou annuel côté API.
  checkout: (token: string, planCode: "essential", period: "month" | "year" = "month") =>
    apiClient.post<{ url: string }>("/subscriptions/checkout", { planCode, period }, token, { skipPaywall: true }),

  portal: (token: string) =>
    apiClient.post<{ url: string }>("/subscriptions/portal", {}, token, { skipPaywall: true }),
};
// STRIPE-MVP-V1 applied

// ----------------------------------------------------------
// PROMO-CODES-V1 — endpoints user + admin
// ----------------------------------------------------------
export type PromoKind = "subscription_days" | "feature_credits";

export interface PromoCodePayload {
  id:                   string;
  code:                 string;
  description:          string | null;
  kind:                 PromoKind;
  subscriptionPlanCode: string | null;
  subscriptionDays:     number | null;
  featureKey:           string | null;
  creditQuantity:       number | null;
  maxRedemptions:       number | null;
  maxPerUser:           number;
  redemptionsCount:     number;
  validFrom:            string | null;
  expiresAt:            string | null;
  active:               boolean;
  createdAt:            string;
  updatedAt:            string;
}

export interface PromoRedeemResult {
  kind:            PromoKind;
  planCode?:       string;
  newPeriodEnd?:   string;
  featureKey?:     string;
  creditsGranted?: number;
  description:     string | null;
}

export const promoCodesApi = {
  redeem: (token: string, code: string) =>
    apiClient.post<PromoRedeemResult>(
      "/promo-codes/redeem",
      { code },
      token,
      { skipPaywall: true },
    ),
};

export const adminPromoCodesApi = {
  list: (
    token: string,
    params: { q?: string; active?: "true" | "false" | "all"; page?: number; limit?: number } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.q)      qs.set("q",      params.q);
    if (params.active) qs.set("active", params.active);
    if (params.page)   qs.set("page",   String(params.page));
    if (params.limit)  qs.set("limit",  String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get(`/admin-panel/promo-codes${suffix}`, token);
  },

  get: (token: string, id: string) =>
    apiClient.get(`/admin-panel/promo-codes/${id}`, token),

  create: (
    token: string,
    body: {
      code:                  string;
      description?:          string | null;
      kind:                  PromoKind;
      subscriptionPlanCode?: string | null;
      subscriptionDays?:     number | null;
      featureKey?:           string | null;
      creditQuantity?:       number | null;
      maxRedemptions?:       number | null;
      maxPerUser?:           number;
      validFrom?:            string | null;
      expiresAt?:            string | null;
    },
  ) => apiClient.post(`/admin-panel/promo-codes`, body, token),

  update: (
    token: string,
    id: string,
    body: {
      description?:    string | null;
      active?:         boolean;
      maxRedemptions?: number | null;
      expiresAt?:      string | null;
    },
  ) => apiClient.patch(`/admin-panel/promo-codes/${id}`, body, token),

  archive: (token: string, id: string) =>
    apiClient.delete(`/admin-panel/promo-codes/${id}`, undefined, token),
};

// PROMO-CODES-V1 applied


// ── GENERIC-HOROSCOPES-V1 — horoscopes presse + clés partenaires ──

export interface AdminHoroscopeSign {
  id: string;
  signIdx: number;
  sign: string;
  text: string;
  edited: boolean;
  generatedAt: string;
  updatedAt: string;
}

export interface PartnerKeyPayload {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export const adminHoroscopesApi = {
  list: (token: string, cadence: "day" | "week") =>
    apiClient.get<{ cadence: string; periodStart: string; periodEnd: string; signs: AdminHoroscopeSign[] }>(
      `/admin-panel/horoscopes?cadence=${cadence}`, token),
  regenerate: (token: string, cadence: "day" | "week", signIdx?: number) =>
    apiClient.post<{ signs: AdminHoroscopeSign[] }>(
      `/admin-panel/horoscopes/regenerate`,
      signIdx === undefined ? { cadence } : { cadence, signIdx }, token),
  updateText: (token: string, id: string, text: string) =>
    apiClient.patch<AdminHoroscopeSign>(`/admin-panel/horoscopes/${id}`, { text }, token),
  listKeys: (token: string) =>
    apiClient.get<{ keys: PartnerKeyPayload[] }>(`/admin-panel/horoscopes/keys`, token),
  createKey: (token: string, name: string) =>
    apiClient.post<PartnerKeyPayload & { token: string }>(`/admin-panel/horoscopes/keys`, { name }, token),
  revokeKey: (token: string, id: string) =>
    apiClient.post<{ id: string; active: boolean }>(`/admin-panel/horoscopes/keys/${id}/revoke`, {}, token),
};

// GENERIC-HOROSCOPES-V1 client applied


// ----------------------------------------------------------
// COMMUNITY-V1-UI — stats sociales anonymes (cf. COMMUNITY-V1.md)
// Contrat aligné sur apps/api/src/services/community.service.ts.
// ----------------------------------------------------------
export type CommunityDimension = "sun" | "moon" | "ascendant";

export interface CommunityPlacement {
  planet: string;          // "Sun" | "Moon" | "Ascendant"
  sign: string;            // "Aries" … "Pisces" (anglais canonique)
  kOk: boolean;            // bucket ≥ K_MIN
  count: number | null;    // masqué (null) sous le seuil de k-anonymité
  total: number | null;
  sharePct: number | null;
}

export type CommunityPlacementStats =
  | { optedIn: false; kMin: number }
  | {
      optedIn: true;
      kMin: number;
      needsProjection?: boolean;
      placements: CommunityPlacement[];
    };

export interface CommunityDistributionBucket {
  sign: string;
  count: number;
  sharePct: number;
}

export interface CommunityDistribution {
  dimension: CommunityDimension;
  planet: string;
  kMin: number;
  total: number | null;    // masqué si un unique bucket est caché (anti-inférence)
  hiddenSigns: number;
  buckets: CommunityDistributionBucket[];
}

export const communityApi = {
  placementStats: (token: string) =>
    apiClient.get<CommunityPlacementStats>("/community/me/placement-stats", token),

  distribution: (token: string, dimension: CommunityDimension) =>
    apiClient.get<CommunityDistribution>(
      `/community/distribution?dimension=${dimension}`,
      token,
    ),

  optIn: (token: string, natalId: string) =>
    apiClient.post<CommunityPlacementStats>("/community/opt-in", { natalId }, token),

  optOut: (token: string) =>
    apiClient.delete<{ optedIn: false }>("/community/opt-in", undefined, token),
};

// COMMUNITY-V1-UI applied

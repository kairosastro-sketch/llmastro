// ARCHIVE-4-TIERS-UI-V1
// AuthContext enrichi. Modifications par rapport à l'archive 3 :
// - state contient désormais plan + entitlements (lus depuis /auth/me)
// - expose refreshTiers() pour re-fetch sans re-login (utilisé après upgrade)
// - continue à gérer l'auth (login/logout/refresh) comme avant
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  User,
  EntitlementsMap,
  SubscriptionStatus,
} from "@astro-platform/types";
import { apiClient } from "@/lib/api/client";
// HOTFIX-LOGOUT-QUERY-CACHE-V1 : hook pour purger le cache react-query au logout/login
import { useQueryClient } from "@tanstack/react-query";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
export interface UserPlanInfo {
  code:             string;         // "free" | "essential" | "premium"
  name:             string;         // "Découverte" | "Essentiel" | "Passion"
  status:           SubscriptionStatus;
  currentPeriodEnd: string | null;  // ISO, null si pas de trial ni périodique
  isTrial:          boolean;
}

interface AuthState {
  user:         User | null;
  accessToken:  string | null;
  plan:         UserPlanInfo | null;
  entitlements: EntitlementsMap;
  loading:      boolean;
  isAdmin:      boolean;
}

interface AuthContextValue extends AuthState {
  login:        (email: string, password: string) => Promise<void>;
  logout:       () => Promise<void>;
  refresh:      () => Promise<string | null>;
  refreshTiers: () => Promise<void>;
}

// Shape exact renvoyé par l'API /auth/me (archive 3 + ADMIN-FOUNDATION-V1)
interface MeResponse {
  user:         User;
  plan:         UserPlanInfo | null;
  entitlements: EntitlementsMap;
  isAdmin?:     boolean;
}

// ----------------------------------------------------------
// Context
// ----------------------------------------------------------
const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "astro:access_token";

const EMPTY_STATE: AuthState = {
  user:         null,
  accessToken:  null,
  plan:         null,
  entitlements: {},
  loading:      true,
  isAdmin:      false,
};

// ----------------------------------------------------------
// Provider
// ----------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  // HOTFIX-LOGOUT-QUERY-CACHE-V1 : accès au cache react-query pour le purger
  // quand on change d'utilisateur (login / logout).
  const queryClient = useQueryClient();

  const [state, setState] = useState<AuthState>(EMPTY_STATE);

  // --------------------------------------------------------
  // Bootstrap — restore session on mount
  // --------------------------------------------------------
  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored) {
      apiClient.setToken(stored);
      fetchMe(stored);
    } else {
      silentRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------
  // Fetch /auth/me — charge user + plan + entitlements
  // --------------------------------------------------------
  const fetchMe = useCallback(async (token: string) => {
    try {
      const res = await apiClient.get<MeResponse>("/auth/me", token);
      const data = (res as { success: true; data: MeResponse }).data;
      setState({
        user:         data.user,
        accessToken:  token,
        plan:         data.plan,
        entitlements: data.entitlements ?? {},
        loading:      false,
        isAdmin:      data.isAdmin === true,
      });
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      setState({ ...EMPTY_STATE, loading: false });
    }
  }, []);

  // --------------------------------------------------------
  // Refresh tokens (rotation) + re-fetch /auth/me
  // --------------------------------------------------------
  const refresh = useCallback(async (): Promise<string | null> => {
    try {
      const res = await apiClient.post<{ tokens: { accessToken: string; expiresIn: number } }>(
        "/auth/refresh",
        {}
      );
      const { accessToken } = (res as {
        success: true;
        data: { tokens: { accessToken: string; expiresIn: number } };
      }).data.tokens;
      apiClient.setToken(accessToken);
      sessionStorage.setItem(TOKEN_KEY, accessToken);
      await fetchMe(accessToken);
      return accessToken;
    } catch {
      setState({ ...EMPTY_STATE, loading: false });
      return null;
    }
  }, [fetchMe]);

  const silentRefresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    await refresh();
  }, [refresh]);

  // --------------------------------------------------------
  // refreshTiers — re-fetch /auth/me sans changer les tokens.
  // Utile après un upgrade/downgrade pour mettre à jour plan + entitlements.
  // --------------------------------------------------------
  const refreshTiers = useCallback(async (): Promise<void> => {
    if (!state.accessToken) return;
    await fetchMe(state.accessToken);
  }, [state.accessToken, fetchMe]);

  // --------------------------------------------------------
  // Proactive token refresh (toutes les 13 min pour tokens 15 min)
  // --------------------------------------------------------
  useEffect(() => {
    if (!state.accessToken) return;
    const interval = setInterval(refresh, 13 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.accessToken, refresh]);

  // --------------------------------------------------------
  // Login
  // --------------------------------------------------------
  const login = useCallback(
    async (email: string, password: string) => {
      // HOTFIX-LOGOUT-QUERY-CACHE-V1 : purger le cache avant d'authentifier le nouveau user.
      // Symétrique du clear() dans logout, au cas où on arriverait sur un
      // login sans avoir passé par un logout explicite (ex: cookie expiré).
      queryClient.clear();
      const res = await apiClient.post<{
        user: User;
        tokens: { accessToken: string; expiresIn: number };
      }>("/auth/login", { email, password });

      const loginData = (res as {
        success: true;
        data: { user: User; tokens: { accessToken: string; expiresIn: number } };
      }).data;
      const { accessToken } = loginData.tokens;
      apiClient.setToken(accessToken);
      sessionStorage.setItem(TOKEN_KEY, accessToken);

      // CHAT-DRAFT-PERSIST-V1 : wipe le draft d'un éventuel précédent user
      // dans cet onglet (cas user A → user B sans logout explicite).
      try { sessionStorage.removeItem("llmastro:chat-draft"); } catch { /* ignore */ }

      // login ne renvoie que user+tokens ; on charge plan+entitlements via /auth/me
      await fetchMe(accessToken);
    },
    [fetchMe, queryClient]  // HOTFIX-LOGOUT-QUERY-CACHE-V1
  );

  // --------------------------------------------------------
  // Logout
  // --------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout", {}, state.accessToken ?? undefined);
    } finally {
      apiClient.setToken(null);
      sessionStorage.removeItem(TOKEN_KEY);
      // CHAT-DRAFT-PERSIST-V1 : wipe le draft de chat au logout, conformément
      // à la décision actée (les chats non-sauvegardés disparaissent au logout).
      try { sessionStorage.removeItem("llmastro:chat-draft"); } catch { /* ignore */ }
      setState({ ...EMPTY_STATE, loading: false });
      // HOTFIX-LOGOUT-QUERY-CACHE-V1 : purger TOUT le cache react-query pour éviter que
      // les données du user précédent ne fuitent vers le suivant dans
      // le même navigateur.
      queryClient.clear();
    }
  }, [state.accessToken, queryClient]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, refresh, refreshTiers }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ----------------------------------------------------------
// Hook
// ----------------------------------------------------------
const SSR_STUB: AuthContextValue = {
  user: null, accessToken: null, plan: null, entitlements: {}, loading: true, isAdmin: false,
  login: async () => {}, logout: async () => {}, refresh: async () => null, refreshTiers: async () => {},
};
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  if (typeof window === "undefined") return SSR_STUB;
  throw new Error("useAuth must be used inside <AuthProvider>");
}

// CHAT-DRAFT-PERSIST-V1 applied

// ADMIN-FOUNDATION-V1-FRONTEND applied

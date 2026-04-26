// ARCHIVE-4-TIERS-UI-V1
// TiersContext — surcouche d'AuthContext pour la partie tiers.
// Responsable uniquement :
//  - Stocker l'état du paywall (ouvert/fermé + contexte déclencheur)
//  - S'abonner à l'error-bus pour ouvrir le paywall automatiquement
//    quand l'API renvoie 403 FEATURE_NOT_AVAILABLE ou 429 QUOTA_EXCEEDED
//
// Les données plan/entitlements restent dans AuthContext (une seule source de vérité,
// une seule requête /auth/me).
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onTiersError, type TiersErrorPayload } from "@/lib/tiers/error-bus";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
export interface PaywallState {
  open:    boolean;
  feature: string | null;           // clé feature déclenchante
  reason:  "feature_not_available" | "quota_exceeded" | "entitlement_denied" | "manual";
  message: string | null;
}

interface TiersContextValue {
  paywall:       PaywallState;
  openPaywall:   (opts?: { feature?: string; reason?: PaywallState["reason"]; message?: string }) => void;
  closePaywall:  () => void;
}

// ----------------------------------------------------------
// Default value
// ----------------------------------------------------------
const CLOSED: PaywallState = {
  open:    false,
  feature: null,
  reason:  "manual",
  message: null,
};

const TiersContext = createContext<TiersContextValue | null>(null);

// ----------------------------------------------------------
// Provider
// ----------------------------------------------------------
export function TiersProvider({ children }: { children: ReactNode }) {
  const [paywall, setPaywall] = useState<PaywallState>(CLOSED);

  // --------------------------------------------------------
  // API publique
  // --------------------------------------------------------
  const openPaywall = useCallback(
    (opts: { feature?: string; reason?: PaywallState["reason"]; message?: string } = {}) => {
      setPaywall({
        open:    true,
        feature: opts.feature ?? null,
        reason:  opts.reason ?? "manual",
        message: opts.message ?? null,
      });
    },
    []
  );

  const closePaywall = useCallback(() => {
    setPaywall(CLOSED);
  }, []);

  // --------------------------------------------------------
  // Écoute des erreurs tiers émises par le apiClient
  // --------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onTiersError((payload: TiersErrorPayload) => {
      setPaywall({
        open:    true,
        feature: payload.feature ?? null,
        reason:  payload.reason,
        message: payload.message ?? null,
      });
    });
    return unsubscribe;
  }, []);

  return (
    <TiersContext.Provider value={{ paywall, openPaywall, closePaywall }}>
      {children}
    </TiersContext.Provider>
  );
}

// ----------------------------------------------------------
// Hook
// ----------------------------------------------------------
const TIERS_SSR_STUB: TiersContextValue = {
  paywall:      { open: false, feature: null, reason: "manual", message: null },
  openPaywall:  () => {},
  closePaywall: () => {},
};

export function useTiersContext(): TiersContextValue {
  const ctx = useContext(TiersContext);
  if (ctx) return ctx;
  if (typeof window === "undefined") return TIERS_SSR_STUB;
  throw new Error("useTiersContext must be used inside <TiersProvider>");
}

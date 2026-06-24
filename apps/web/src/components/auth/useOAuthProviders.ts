"use client";

// OAUTH-APPLE-V1 — quels providers OAuth le backend a-t-il configurés ?
// Pilote l'affichage des boutons : le bouton n'apparaît que si le backend
// a les secrets (ex. Apple s'allume dès que les variables d'env sont posées).
// React Query (pas de useEffect+setState → évite react-hooks/set-state-in-effect).

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface OAuthProviders {
  google:   boolean;
  facebook: boolean;
  apple:    boolean;
}

const NONE: OAuthProviders = { google: false, facebook: false, apple: false };

export function useOAuthProviders(): OAuthProviders {
  const { data } = useQuery({
    queryKey: ["oauth-providers"],
    queryFn:  () => apiClient.get<{ providers: OAuthProviders }>("/auth/providers"),
    staleTime: 60 * 60 * 1000, // la config bouge rarement
    retry: false,
  });
  return (data as { data?: { providers?: OAuthProviders } } | undefined)?.data?.providers ?? NONE;
}

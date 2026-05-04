"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { Toaster } from "@/components/ui/Toaster";
import { TiersProvider } from "@/contexts/TiersContext";
import { PaywallModal } from "@/components/tiers";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:        60 * 1000,
            retry:            1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* TOASTER-WIRING-HOTFIX-V1 : Toaster est un Provider qui
            doit envelopper l'app pour que useToast() trouve le
            context. Avant le hotfix il était en frère de children
            → useToast() throw. */}
        <Toaster>
          <TiersProvider>
            {children}
            <PaywallModal />
          </TiersProvider>
        </Toaster>
      </AuthProvider>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

// TOASTER-WIRING-HOTFIX-V1 applied

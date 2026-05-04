"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

function CallbackInner() {
  const router      = useRouter();
  const params      = useSearchParams();
  const { refresh } = useAuth();

  useEffect(() => {
    const token = params.get("token");
    if (token && typeof window !== "undefined") {
      window.sessionStorage.setItem("astro:access_token", token);
    }
    refresh().then(() => {
      router.replace("/dashboard/natal");
    });
  }, [params, refresh, router]);

  return (
    <main className="min-h-dvh starfield flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      <p className="text-muted text-sm">Connexion en cours…</p>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <main className="min-h-dvh flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" />
      </main>
    }>
      <CallbackInner />
    </Suspense>
  );
}

// LINT-CSS-CLEANUP-V1 applied

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * La page d'accueil est désormais fusionnée avec horoscope.
 * On redirige immédiatement vers /dashboard/horoscope.
 */
export default function DashboardIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/horoscope");
  }, [router]);

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }} role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

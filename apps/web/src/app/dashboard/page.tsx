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
    }}>
      <div className="spinner" />
    </div>
  );
}

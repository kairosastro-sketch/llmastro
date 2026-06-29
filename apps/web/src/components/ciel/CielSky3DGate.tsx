// ============================================================
// apps/web/src/components/ciel/CielSky3DGate.tsx
// CIEL-SKY3D-V1 · CIEL-SKY3D-DEFAULT-V1
// ------------------------------------------------------------
// Porte d'entrée client de la roue du ciel sur /ciel.
// La roue 3D (three) est désormais le rendu PAR DÉFAUT. La roue 2D
// (EphemerisWheel) ne sert plus que de FILET de secours, affiché
// uniquement quand la 3D ne peut pas se charger (pas de WebGL) ou
// si l'on coupe la 3D via le kill-switch `?3d=0`.
// Le composant lourd (three) est chargé en dynamic ssr:false → jamais
// dans le bundle serveur ; la page reste statique SSG/ISR.
// ============================================================

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { EphemerisWheel } from "@/components/landing/EphemerisWheel";

type Cadence = "day" | "week" | "month" | "year";

interface PlanetData {
  longitude: number;
  retrograde?: boolean;
}

const CielSky3D = dynamic(
  () => import("./CielSky3D").then((m) => m.CielSky3D),
  { ssr: false },
);

export function CielSky3DGate({
  cadence,
  planets,
  ascendant = 0,
  ariaLabel,
}: {
  cadence: Cadence;
  planets: Record<string, PlanetData>;
  ascendant?: number;
  ariaLabel?: string;
}) {
  // "3d" = on tente la roue 3D ; "2d" = filet de secours roue 2D.
  const [mode, setMode] = useState<"3d" | "2d">("3d");

  useEffect(() => {
    try {
      // Kill-switch : `?3d=0` force la roue 2D (mémorisé pour la session).
      const q = new URLSearchParams(window.location.search).get("3d");
      if (q === "0") {
        sessionStorage.setItem("sky3d", "0");
        setMode("2d");
      } else if (q === "1") {
        sessionStorage.removeItem("sky3d");
      } else if (sessionStorage.getItem("sky3d") === "0") {
        setMode("2d");
      }
    } catch {
      /* pas de sessionStorage → on reste en 3D par défaut */
    }
  }, []);

  if (mode === "2d") {
    return (
      <section
        className="card"
        style={{ padding: "1rem", marginBottom: "2rem" }}
        aria-label={ariaLabel}
      >
        {/* CTA « maisons » rendu à part (CielHousesNote) → on le masque ici
            pour éviter le doublon. */}
        <EphemerisWheel planets={planets} ascendant={ascendant} showHousesCta={false} />
      </section>
    );
  }

  return (
    <section
      className="card"
      style={{ padding: "0.5rem", marginBottom: "2rem" }}
      aria-label={ariaLabel}
    >
      <CielSky3D cadence={cadence} onUnavailable={() => setMode("2d")} />
    </section>
  );
}

// CIEL-SKY3D-V1 CielSky3DGate applied
// CIEL-SKY3D-DEFAULT-V1 applied

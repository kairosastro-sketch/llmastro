// ============================================================
// apps/web/src/components/ciel/CielSky3DGate.tsx
// CIEL-SKY3D-V1
// ------------------------------------------------------------
// Porte d'entrée client de la roue 3D sur /ciel. Tant que le flag
// d'activation par défaut n'est pas posé, la 3D ne s'affiche que si
// l'URL porte `?3d=1` (lecture CÔTÉ CLIENT → la page reste statique
// SSG/ISR, le SSR n'est pas impacté). Le composant lourd (three) est
// chargé en dynamic ssr:false, donc jamais dans le bundle serveur.
// ============================================================

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

type Cadence = "day" | "week" | "month" | "year";

const CielSky3D = dynamic(
  () => import("./CielSky3D").then((m) => m.CielSky3D),
  { ssr: false },
);

export function CielSky3DGate({ cadence }: { cadence: Cadence }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      // Flag collant : `?3d=1` active la 3D et la mémorise pour la session,
      // pour qu'elle survive à la navigation entre cadences (liens en reload
      // complet qui perdraient le query param). `?3d=0` la coupe.
      const q = new URLSearchParams(window.location.search).get("3d");
      if (q === "1") sessionStorage.setItem("sky3d", "1");
      if (q === "0") sessionStorage.removeItem("sky3d");
      setOn(q === "1" || sessionStorage.getItem("sky3d") === "1");
    } catch {
      setOn(new URLSearchParams(window.location.search).get("3d") === "1");
    }
  }, []);

  if (!on) return null;

  return (
    <section className="card" style={{ padding: "0.5rem", marginBottom: "2rem" }}>
      <CielSky3D cadence={cadence} />
    </section>
  );
}

// CIEL-SKY3D-V1 CielSky3DGate applied

// ARCHIVE-LANDING-EPHEMERIDES-V2
// Wrapper autour du ZodiacWheel UI dashboard, alimenté par les positions du jour.
// Réutilise le même composant que /dashboard/transits pour cohérence visuelle.

"use client";

import { ZodiacWheel, type WheelPlanet } from "@/components/ui/ZodiacWheel";
import styles from "./dailyEphemeris.module.css";

const PLANET_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};

const PLANET_COLORS: Record<string, string> = {
  sun: "#d4a843", moon: "#b0adc8", mercury: "#60a5fa", venus: "#e879a8",
  mars: "#f87171", jupiter: "#34d399", saturn: "#a78bfa",
  uranus: "#67e8f9", neptune: "#818cf8", pluto: "#c4b5fd",
};

interface PlanetData {
  longitude: number;
  retrograde?: boolean;
}

interface EphemerisWheelProps {
  planets: Record<string, PlanetData>;
  ascendant?: number;
  /** ARCHIVE-LANDING-HERO-IMMERSIVE-V1 : "default" = wraper styles.wheelWrap, "immersive" = pleine taille sans fond */
  variant?: "default" | "immersive";
}

function dictToWheelPlanets(dict: Record<string, PlanetData>): WheelPlanet[] {
  return Object.entries(dict).map(([key, p]) => ({
    name: key,
    glyph: PLANET_GLYPHS[key] ?? key[0]!.toUpperCase(),
    longitude: p.longitude ?? 0,
    retrograde: !!p.retrograde,
    color: PLANET_COLORS[key],
  }));
}

export function EphemerisWheel({ planets, ascendant = 0, variant = "default" }: EphemerisWheelProps) {
  const wheelPlanets = dictToWheelPlanets(planets);

  // Mode immersive : pas de wrapper, fond transparent, taille pleine
  if (variant === "immersive") {
    return (
      <ZodiacWheel
        planets={wheelPlanets}
        ascendant={ascendant}
        chartName=" "
        showHouses={true}
        showAspects={true}
        showPlanets={true}
        showLayerToggles={false}
        showControls={false}
        transparentBackground={true}
      />
    );
  }

  return (
    <div className={styles.wheelWrap}>
      <ZodiacWheel
        planets={wheelPlanets}
        ascendant={ascendant}
        chartName="Ciel du jour"
        showHouses={true}
        showAspects={true}
        showPlanets={true}
        showLayerToggles={false}
        showControls={false}
      />
    </div>
  );
}

// ARCHIVE-LANDING-EPHEMERIDES-POLISH-V2 applied

// ARCHIVE-LANDING-HERO-IMMERSIVE-V1 applied

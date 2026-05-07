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
  // CIEL-PUBLIC-V1-NO-HOUSES-V1 : showHouses=false (maisons sans contexte personnel n'ont pas de sens)
  if (variant === "immersive") {
    return (
      <ZodiacWheel
        planets={wheelPlanets}
        ascendant={ascendant}
        chartName=" "
        showHouses={false}
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
        showHouses={false}
        showAspects={true}
        showPlanets={true}
        showLayerToggles={false}
        showControls={false}
      />
      {/* CIEL-PUBLIC-V1-NO-HOUSES-V1 : CTA pédagogique sur l'absence des maisons */}
      <p
        style={{
          marginTop: "1rem",
          padding: "0.85rem 1.25rem",
          background: "var(--card-bg)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--r-md)",
          fontSize: "0.85rem",
          color: "var(--muted)",
          textAlign: "center",
          lineHeight: 1.55,
        }}
      >
        <span aria-hidden style={{ marginRight: "0.4em" }}>📍</span>
        Les maisons astrologiques d&eacute;pendent de{" "}
        <strong>votre lieu et heure de naissance</strong>.{" "}
        <a
          href="/auth/register"
          style={{ color: "var(--gold)", textDecoration: "underline" }}
        >
          Cr&eacute;ez votre th&egrave;me natal pour les voir &rarr;
        </a>
      </p>
    </div>
  );
}

// ARCHIVE-LANDING-EPHEMERIDES-POLISH-V2 applied

// ARCHIVE-LANDING-HERO-IMMERSIVE-V1 applied

// CIEL-PUBLIC-V1-NO-HOUSES-V1 applied

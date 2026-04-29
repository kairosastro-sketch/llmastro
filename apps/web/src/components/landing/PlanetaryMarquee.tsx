// ARCHIVE-LANDING-HERO-IMMERSIVE-V1
// Bandeau marquee défilant des positions planétaires.
// Lit les données depuis /public/ephemeris/sky/now (déjà cacheé 10 min).
// Animation CSS pure (translateX), pause au hover.

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import styles from "./planetaryMarquee.module.css";

const PLANET_KEYS = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
] as const;

const PLANET_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};

const PLANET_NAMES: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturne", uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
};

const SIGN_NAMES = [
  "Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
  "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons",
];

interface PlanetData {
  longitude: number;
  retrograde?: boolean;
}

interface SkyPayload {
  date: string;
  planets: Record<string, PlanetData>;
}

const REFETCH_MS = 10 * 60 * 1000;

function formatDegrees(longitude: number): { deg: string; sign: string } {
  const signIdx = Math.floor(longitude / 30) % 12;
  const degInSign = longitude % 30;
  const deg = Math.floor(degInSign);
  const min = Math.floor((degInSign - deg) * 60);
  return {
    deg:  `${deg}°${String(min).padStart(2, "0")}'`,
    sign: SIGN_NAMES[signIdx] ?? "",
  };
}

export function PlanetaryMarquee() {
  const { data: res } = useQuery({
    queryKey:        ["public-ephemeris-sky"],   // même clé que DailyEphemeris : partage du cache
    queryFn:         () => apiClient.get<SkyPayload>("/public/ephemeris/sky/now"),
    staleTime:       REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry:           1,
  });

  const sky = (res as { data?: SkyPayload } | undefined)?.data;

  // Construit la liste à afficher (10 planètes ordonnées)
  const items = sky?.planets
    ? PLANET_KEYS
        .filter((k) => sky.planets[k])
        .map((k) => {
          const planet = sky.planets[k]!;
          const { deg, sign } = formatDegrees(planet.longitude);
          return {
            key:   k,
            glyph: PLANET_GLYPHS[k] ?? "",
            name:  PLANET_NAMES[k] ?? k,
            deg,
            sign,
            retro: !!planet.retrograde,
          };
        })
    : [];

  // Loading state : skeleton minimaliste pour ne pas casser le layout
  if (items.length === 0) {
    return (
      <div className={styles.marquee} aria-label="Positions planétaires en cours de chargement">
        <div className={styles.track}>
          <span className={styles.skeleton}>✦ Calcul des positions astrales…</span>
        </div>
      </div>
    );
  }

  // On duplique 2× pour créer l'effet de défilement infini sans saut visible
  const doubled = [...items, ...items];

  return (
    <section
      className={styles.marquee}
      aria-label="Positions planétaires actuelles, défilement"
    >
      <div className={styles.fadeLeft} aria-hidden />
      <div className={styles.track}>
        {doubled.map((item, idx) => (
          <span
            key={`${item.key}-${idx}`}
            className={styles.item}
            aria-hidden={idx >= items.length}
          >
            <span className={styles.glyph}>{item.glyph}</span>
            <span className={styles.name}>{item.name}</span>
            <span className={styles.deg}>{item.deg}</span>
            <span className={styles.sign}>{item.sign}</span>
            {item.retro && <span className={styles.retro} title="Rétrograde">℞</span>}
          </span>
        ))}
      </div>
      <div className={styles.fadeRight} aria-hidden />
    </section>
  );
}

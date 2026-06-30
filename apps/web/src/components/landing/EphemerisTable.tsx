// ARCHIVE-LANDING-EPHEMERIDES-V2
// Tableau des positions planétaires du moment.
// Affiche pour chaque planète : glyphe, nom, degrés/minutes, signe, R si rétrograde.

"use client";

import styles from "./dailyEphemeris.module.css";

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

interface EphemerisTableProps {
  planets: Record<string, PlanetData>;
  /** Libellé de date déjà localisé (ex. « au 1 janvier 2026 ») — lève l'ambiguïté
   *  sur les cadences longues où un instantané non daté n'a pas de sens. */
  asOf?: string;
  /** CIEL-COLLAPSE-V1 : masque l'en-tête interne quand le titre est déjà porté
   *  par le <summary> de la section repliable (évite le doublon de titre). */
  hideHeader?: boolean;
}

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

export function EphemerisTable({ planets, asOf, hideHeader }: EphemerisTableProps) {
  return (
    <div className={styles.tableSection}>
      {!hideHeader && (
        <div className={styles.tableHeader}>
          <span>
            Positions planétaires
            {asOf && (
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.82em" }}>
                {" · "}{asOf}
              </span>
            )}
          </span>
          <span className={styles.tableHeaderLine} />
        </div>
      )}

      <div className={styles.table} role="table" aria-label="Positions planétaires du moment">
        {PLANET_KEYS.map((key) => {
          const planet = planets[key];
          if (!planet) return null;

          const { deg, sign } = formatDegrees(planet.longitude);
          const name = PLANET_NAMES[key] ?? key;
          const glyph = PLANET_GLYPHS[key] ?? "";
          const retroLabel = planet.retrograde ? " (rétrograde)" : "";

          return (
            <div
              key={key}
              role="row"
              className={styles.row}
              aria-label={`${name} ${deg} ${sign}${retroLabel}`}
            >
              <span className={styles.glyph} aria-hidden>{glyph}</span>
              <span className={styles.name}>{name}</span>
              <span className={styles.degree}>
                {deg}
                {planet.retrograde && (
                  <span className={styles.retro} aria-hidden> ℞</span>
                )}
              </span>
              <span className={styles.sign}>{sign}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

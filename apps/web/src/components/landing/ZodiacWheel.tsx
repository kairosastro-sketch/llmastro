// ============================================================
// LANDING-V1 — ZodiacWheel
// Roue zodiacale animée en SVG, rotation 180s, pause au hover.
// 12 signes en glyphes Unicode, dorée sur fond nuit.
// ============================================================

import styles from "./landing.module.css";

// Les 12 signes du zodiaque (Bélier → Poissons)
const ZODIAC_SIGNS = [
  { glyph: "♈", name: "Aries"       },
  { glyph: "♉", name: "Taurus"      },
  { glyph: "♊", name: "Gemini"      },
  { glyph: "♋", name: "Cancer"      },
  { glyph: "♌", name: "Leo"         },
  { glyph: "♍", name: "Virgo"       },
  { glyph: "♎", name: "Libra"       },
  { glyph: "♏", name: "Scorpio"     },
  { glyph: "♐", name: "Sagittarius" },
  { glyph: "♑", name: "Capricorn"   },
  { glyph: "♒", name: "Aquarius"    },
  { glyph: "♓", name: "Pisces"      },
];

const SIZE = 480;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 220;
const SIGN_RADIUS = 178;
const INNER_RADIUS = 130;

export function ZodiacWheel() {
  // Calcule les positions des 12 signes (chaque signe = 30°)
  const signsWithPos = ZODIAC_SIGNS.map((sign, i) => {
    // -90 pour commencer en haut (12h), +15 pour centrer dans le secteur
    const angleDeg = -90 + i * 30 + 15;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      ...sign,
      x: CENTER + Math.cos(angleRad) * SIGN_RADIUS,
      y: CENTER + Math.sin(angleRad) * SIGN_RADIUS,
    };
  });

  // Lignes de séparation des 12 secteurs
  const sectorLines = Array.from({ length: 12 }, (_, i) => {
    const angleDeg = -90 + i * 30;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x1 = CENTER + Math.cos(angleRad) * INNER_RADIUS;
    const y1 = CENTER + Math.sin(angleRad) * INNER_RADIUS;
    const x2 = CENTER + Math.cos(angleRad) * OUTER_RADIUS;
    const y2 = CENTER + Math.sin(angleRad) * OUTER_RADIUS;
    return { x1, y1, x2, y2, key: i };
  });

  // Points fins aux degrés-clés (toutes les 30° pour le moment)
  const degreeMarkers = Array.from({ length: 12 }, (_, i) => {
    const angleDeg = -90 + i * 30;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      cx: CENTER + Math.cos(angleRad) * (OUTER_RADIUS + 4),
      cy: CENTER + Math.sin(angleRad) * (OUTER_RADIUS + 4),
      key: i,
    };
  });

  // 4 maisons cardinales (Asc, Imum Coeli, Desc, Mid-heaven)
  // Représentées en pointillé pour évoquer la croix cardinale
  const cardinalLines = [
    { x1: CENTER, y1: CENTER - INNER_RADIUS - 18, x2: CENTER, y2: CENTER + INNER_RADIUS + 18, key: "v" },
    { x1: CENTER - INNER_RADIUS - 18, y1: CENTER, x2: CENTER + INNER_RADIUS + 18, y2: CENTER, key: "h" },
  ];

  return (
    <div className={styles.zodiacWheel} aria-label="Roue du zodiaque" role="img">
      <div className={styles.heroWheelGlow} aria-hidden="true" />
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Gradient subtil pour les cercles concentriques */}
          <radialGradient id="wheelInnerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.04" />
            <stop offset="70%" stopColor="var(--gold)" stopOpacity="0.02" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Wrapper du contenu animé (rotation entière) */}
        <g className={styles.zodiacWheelInner}>
          {/* Halo intérieur diffus */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={INNER_RADIUS - 8}
            fill="url(#wheelInnerGlow)"
          />

          {/* Croix cardinale en pointillé (Asc-Desc, MC-IC) */}
          {cardinalLines.map((line) => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--gold)"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeDasharray="2 6"
            />
          ))}

          {/* Cercle intérieur */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={INNER_RADIUS}
            fill="none"
            stroke="var(--gold)"
            strokeOpacity="0.32"
            strokeWidth="1"
          />

          {/* Lignes de séparation des 12 secteurs zodiacaux */}
          {sectorLines.map((line) => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--gold)"
              strokeOpacity="0.22"
              strokeWidth="1"
            />
          ))}

          {/* Cercle médian (entre signes et intérieur) */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={SIGN_RADIUS - 28}
            fill="none"
            stroke="var(--gold)"
            strokeOpacity="0.18"
            strokeWidth="1"
          />

          {/* Cercle extérieur (bordure principale) */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_RADIUS}
            fill="none"
            stroke="var(--gold)"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />

          {/* Points marqueurs aux 12 limites de signes */}
          {degreeMarkers.map((m) => (
            <circle
              key={m.key}
              cx={m.cx}
              cy={m.cy}
              r="1.6"
              fill="var(--gold)"
              fillOpacity="0.7"
            />
          ))}

          {/* Glyphes des 12 signes */}
          {signsWithPos.map((sign) => (
            <text
              key={sign.name}
              x={sign.x}
              y={sign.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--gold)"
              fillOpacity="0.92"
              fontSize="28"
              fontFamily="Georgia, serif"
            >
              {sign.glyph}
            </text>
          ))}

          {/* Étoile centrale ✦ */}
          <text
            x={CENTER}
            y={CENTER}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--gold)"
            fontSize="24"
            fontFamily="Georgia, serif"
            opacity="0.85"
          >
            ✦
          </text>
        </g>
      </svg>
    </div>
  );
}

// ============================================================
// LANDING — CelesteWheel
// Roue zodiacale décorative du hero (thème « Céleste »).
// SVG 100% statique + planètes flottantes — aucune dépendance API,
// remplace l'ancien module éphéméride dans le Hero.
// ============================================================

import styles from "./landing.module.css";

// Sélecteur de variation U+FE0E (VS-15) : force la présentation « texte »
// monochrome des signes du zodiaque (sinon rendus en emoji couleur sous
// Windows, ce qui ignore l'attribut SVG `fill`).
const VS_TEXT = "︎";
const SIGNS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map(
  (s) => s + VS_TEXT,
);

const CX = 200;
const CY = 200;

/**
 * Coordonnées cartésiennes d'un point polaire (rayon, angle en degrés).
 * Le résultat est arrondi à 2 décimales : `Math.cos`/`Math.sin` ont une
 * précision implémentation-définie (spec ECMAScript), donc V8-Node (SSR) et
 * V8-Chrome (hydratation) divergent sur les derniers bits — l'arrondi garantit
 * des attributs SVG identiques des deux côtés et évite le mismatch React.
 */
function polar(r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  const round = (v: number) => Math.round(v * 100) / 100;
  return { x: round(CX + r * Math.cos(a)), y: round(CY + r * Math.sin(a)) };
}

export function CelesteWheel() {
  return (
    <div className={styles.orbitScene} aria-hidden="true">
      {/* Cœur lumineux pulsant */}
      <div className={styles.glowCore} />

      {/* Roue zodiacale */}
      <svg className={styles.celesteWheel} viewBox="0 0 400 400">
        {/* Anneaux concentriques */}
        <circle cx={CX} cy={CY} r={190} fill="none" stroke="var(--gold)" strokeWidth={1} opacity={0.35} />
        <circle cx={CX} cy={CY} r={162} fill="none" stroke="var(--gold)" strokeWidth={1.4} opacity={0.7} />
        <circle cx={CX} cy={CY} r={122} fill="none" stroke="var(--gold)" strokeWidth={1} opacity={0.35} />
        <circle cx={CX} cy={CY} r={70} fill="none" stroke="var(--gold)" strokeWidth={1} opacity={0.5} />

        {/* 12 secteurs : rayon de séparation + glyphe + étoile intérieure */}
        {SIGNS.map((sign, i) => {
          const base = -90 + i * 30;
          const inner = polar(122, base);
          const outer = polar(190, base);
          const glyph = polar(142, base + 15);
          const dot = polar(70, base);
          return (
            <g key={i}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="var(--gold)"
                strokeWidth={1}
                opacity={0.3}
              />
              <text
                x={glyph.x}
                y={glyph.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={20}
                fill="var(--gold-l)"
              >
                {sign}
              </text>
              <circle cx={dot.x} cy={dot.y} r={2.4} fill="var(--violet-l)" />
            </g>
          );
        })}

        {/* Croix centrale (axes) */}
        <line x1={CX} y1={130} x2={CX} y2={270} stroke="var(--violet)" strokeWidth={1} opacity={0.4} />
        <line x1={130} y1={CY} x2={270} y2={CY} stroke="var(--violet)" strokeWidth={1} opacity={0.4} />
      </svg>

      {/* Planètes flottantes (aquarelle) */}
      <div className={`${styles.planet} ${styles.pSaturn}`}>
        <span className={styles.planetRing} />
      </div>
      <div className={`${styles.planet} ${styles.pBlue}`} />
      <div className={`${styles.planet} ${styles.pMoon}`} />
    </div>
  );
}

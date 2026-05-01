"use client";

// ============================================================
// AUTH-PAGES-DESIGN-V1 — AuthStarfield
// ------------------------------------------------------------
// Starfield léger pour les pages /auth/*. Pas dépendant du
// composant <StarsBackground /> du dashboard (que je ne suis
// pas sûr d'avoir, et qui pourrait avoir d'autres dépendances).
//
// Implémentation : positions/tailles/opacités générées avec
// un PRNG déterministe (Mulberry32) seedé sur l'index, pour
// éviter un re-render erratique côté client après hydration.
//
// CSS : utilise la classe .stars-bg .star qui EXISTE dans
// globals.css (animation twinkle déjà câblée). On wrap dans
// un div .stars-bg (position: fixed; inset: 0) pour récupérer
// le z-index et le pointer-events: none gratuit.
// ============================================================

import { useMemo } from "react";

interface StarSpec {
  top:      number;   // %
  left:     number;   // %
  size:     number;   // px
  duration: number;   // s
  opacity:  number;   // 0..1 (max via --o)
  delay:    number;   // s
}

// Mulberry32 — PRNG déterministe, simple, suffisant pour positions visuelles
function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateStars(count: number, seed: number): StarSpec[] {
  const rand = mulberry32(seed);
  const stars: StarSpec[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      top:      rand() * 100,
      left:     rand() * 100,
      size:     rand() < 0.85 ? 1 : 2,             // surtout des petites
      duration: 2 + rand() * 4,                     // 2s..6s
      opacity:  0.35 + rand() * 0.55,               // 0.35..0.90
      delay:    rand() * 4,                         // 0..4s
    });
  }
  return stars;
}

export interface AuthStarfieldProps {
  count?: number;
  seed?:  number;
}

export function AuthStarfield({ count = 70, seed = 1337 }: AuthStarfieldProps) {
  const stars = useMemo(() => generateStars(count, seed), [count, seed]);

  return (
    <div
      className="stars-bg"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            position: "absolute",
            top:    `${s.top}%`,
            left:   `${s.left}%`,
            width:  s.size,
            height: s.size,
            background: "var(--stars-color)",
            borderRadius: "50%",
            // Variables consommées par l'animation @keyframes twinkle déjà
            // définie dans globals.css (.stars-bg .star utilise --d et --o)
            ["--d" as string]: `${s.duration}s`,
            ["--o" as string]: s.opacity.toFixed(2),
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// AUTH-PAGES-DESIGN-V1 applied

"use client";

// RWS-TAROT-V1 — TarotCardImage
// Affiche un arcane majeur Rider-Waite-Smith depuis /tarot/cards/major-NN.webp
// avec lazy-load natif et fallback CSS en cas d'échec de chargement.

import { useState } from "react";

interface Props {
  num: number;
  alt: string;
  size?: number;
}

export default function TarotCardImage({ num, alt, size = 95 }: Props) {
  const [errored, setErrored] = useState(false);

  const w = size;
  const h = Math.round(size * 1.55);
  const padded = num.toString().padStart(2, "0");
  const src = `/tarot/cards/major-${padded}.webp`;

  if (errored) {
    // Fallback : cadre minimal avec numéro et nom (jamais déclenché en prod
    // si l'acquisition Wikimedia s'est bien passée — sécurité défensive).
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: 10,
          background: "linear-gradient(135deg, var(--bg-raised, #1a1228), var(--card-bg, #2e1f4a))",
          color: "var(--gold, #c9a84c)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          fontSize: 11,
          textAlign: "center",
          padding: 4,
          border: "1px solid var(--border-soft, rgba(255,255,255,0.1))",
        }}
      >
        <div style={{ fontSize: 22, opacity: 0.75, fontWeight: 600 }}>{num}</div>
        <div style={{ marginTop: 8, fontSize: 9, opacity: 0.85, lineHeight: 1.2 }}>
          {alt}
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
      style={{
        display: "block",
        width: w,
        height: "auto",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    />
  );
}

// RWS-TAROT-V1 applied

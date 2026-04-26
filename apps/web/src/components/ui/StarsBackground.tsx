"use client";

import { useEffect, useRef } from "react";

/**
 * StarsBackground — couche fixe avec étoiles scintillantes
 * Rendu côté client pour éviter les problèmes d'hydratation.
 */
export function StarsBackground({ count = 90 }: { count?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    // Nettoyer au cas où
    host.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const star = document.createElement("span");
      star.className = "star";
      star.style.top  = Math.random() * 100 + "%";
      star.style.left = Math.random() * 100 + "%";
      star.style.setProperty("--d", (1.5 + Math.random() * 4).toFixed(2) + "s");
      star.style.setProperty("--o", (0.3 + Math.random() * 0.7).toFixed(2));
      host.appendChild(star);
    }
  }, [count]);

  return <div ref={ref} className="stars-bg" aria-hidden="true" />;
}

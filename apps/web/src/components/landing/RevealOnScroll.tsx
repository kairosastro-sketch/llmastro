// ============================================================
// LANDING-V1 — RevealOnScroll
// Wrapper qui révèle son enfant quand il entre dans le viewport.
// IntersectionObserver natif, pas de lib motion.
// Désactivé automatiquement si prefers-reduced-motion.
// ============================================================

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./landing.module.css";

interface RevealOnScrollProps {
  children: ReactNode;
  delay?: number; // ms
}

export function RevealOnScroll({ children, delay = 0 }: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Si l'utilisateur préfère les animations réduites, on révèle immédiatement
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting) {
          // Délai avant reveal (pour stagger entre cards)
          const timer = setTimeout(() => setRevealed(true), delay);
          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`${styles.revealOnScroll} ${revealed ? styles.revealed : ""}`}
    >
      {children}
    </div>
  );
}

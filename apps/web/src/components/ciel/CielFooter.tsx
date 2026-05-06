// ============================================================
// apps/web/src/components/ciel/CielFooter.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import Link from "next/link";

export function CielFooter() {
  return (
    <footer style={{ marginTop: "2rem", textAlign: "center" }}>
      <Link
        href="/dashboard/transits"
        className="btn-ob"
        style={{ display: "inline-block", marginBottom: "1.5rem" }}
      >
        Voir ce ciel pour vous →
      </Link>
      <p style={{ color: "var(--muted-2)", fontSize: "0.8rem", margin: 0 }}>
        Calculs : Swiss Ephemeris (positions planétaires, ±0.1″) · JPL NASA (référentiel) ·{" "}
        <Link
          href="/methode"
          style={{ color: "var(--muted-2)", textDecoration: "underline" }}
        >
          Notre méthode
        </Link>
        {" · "}
        <Link
          href="/limites"
          style={{ color: "var(--muted-2)", textDecoration: "underline" }}
        >
          Limites de Llmastro
        </Link>
      </p>
    </footer>
  );
}

// CIEL-PUBLIC-V1-PAGES footer applied

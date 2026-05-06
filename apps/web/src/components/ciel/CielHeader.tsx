// ============================================================
// apps/web/src/components/ciel/CielHeader.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import type { Cadence, MoonPhase } from "@/lib/server/sky-fetch";

const CADENCE_LABELS: Record<Cadence, { eyebrow: string; title: string }> = {
  day: {
    eyebrow: "✦ Le ciel aujourd'hui",
    title:   "État du ciel — aujourd'hui",
  },
  week: {
    eyebrow: "✦ Le ciel cette semaine",
    title:   "État du ciel — cette semaine",
  },
  month: {
    eyebrow: "✦ Le ciel ce mois",
    title:   "État du ciel — ce mois",
  },
  year: {
    eyebrow: "✦ Le ciel cette année",
    title:   "État du ciel — cette année",
  },
};

function formatRefDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day:     "numeric",
      month:   "long",
      year:    "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

interface CielHeaderProps {
  cadence:       Cadence;
  referenceDate: string;
  periodStart:   string;
  periodEnd:     string;
  moonPhase:     MoonPhase | null;
}

export function CielHeader({ cadence, referenceDate, periodStart, periodEnd, moonPhase }: CielHeaderProps) {
  const labels = CADENCE_LABELS[cadence];
  const rangeFr = `${formatRefDate(periodStart)} → ${formatRefDate(periodEnd)}`;

  return (
    <header style={{ marginBottom: "2rem", textAlign: "center" }}>
      <p
        style={{
          color: "var(--gold)",
          fontSize: "0.85rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {labels.eyebrow}
      </p>
      <h1
        style={{
          margin: "0.5rem 0 0.75rem",
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
          fontWeight: 400,
          color: "var(--gold)",
        }}
      >
        {labels.title}
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.95rem", margin: "0 0 0.5rem" }}>
        Période : {rangeFr}
      </p>
      <p style={{ color: "var(--muted-2)", fontSize: "0.8rem", margin: 0 }}>
        Calculé le {formatRefDate(referenceDate)} · positions pour Paris (Europe/UTC)
      </p>

      {moonPhase && moonPhase.phase && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.75rem",
            marginTop: "1.5rem",
            padding: "0.75rem 1.25rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            background: "var(--card-bg)",
          }}
        >
          <span style={{ fontSize: "1.8rem", lineHeight: 1 }} aria-hidden>
            {moonPhase.emoji ?? "🌙"}
          </span>
          <div style={{ textAlign: "left" }}>
            <div style={{ color: "var(--gold-l)", fontSize: "0.95rem" }}>
              Lune : {moonPhase.phase}
              {typeof moonPhase.illumination === "number" && (
                <span style={{ color: "var(--muted)" }}>
                  {" "}· {Math.round(moonPhase.illumination * 100)}% éclairée
                </span>
              )}
            </div>
            {moonPhase.description && (
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {moonPhase.description}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

// CIEL-PUBLIC-V1-PAGES header applied

// ============================================================
// apps/web/src/components/ciel/EventsList.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import type {
  SkyEvents,
  IngressEvent,
  StationEvent,
  LunationEvent,
  EclipseEvent,
} from "@/lib/server/sky-fetch";

const PLANET_NAMES_FR: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturne",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
  northNode: "Nœud Nord", southNode: "Nœud Sud",
};

const SIGN_NAMES_FR = [
  "Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
  "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons",
];

const LUNATION_LABELS: Record<LunationEvent["phase"], string> = {
  new:           "Nouvelle Lune",
  first_quarter: "Premier Quartier",
  full:          "Pleine Lune",
  last_quarter:  "Dernier Quartier",
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day:   "numeric",
      month: "long",
      year:  "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${date} à ${hh}h${mm} UTC`;
  } catch {
    return iso;
  }
}

interface EventsListProps {
  events?: SkyEvents | undefined;
}

export function EventsList({ events }: EventsListProps) {
  if (!events) {
    return null;
  }

  const { ingresses, stations, lunations, eclipses } = events;
  const total =
    (ingresses?.length ?? 0) +
    (stations?.length ?? 0) +
    (lunations?.length ?? 0) +
    (eclipses?.length ?? 0);

  if (total === 0) {
    return null;
  }

  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "1.5rem",
          fontWeight: 400,
          color: "var(--gold)",
          marginBottom: "1rem",
        }}
      >
        Événements de la période
      </h2>

      {(eclipses?.length ?? 0) > 0 && (
        <SubSection title={`Éclipses (${eclipses.length})`}>
          {eclipses.map((e, i) => (
            <Row
              key={`ecl-${i}`}
              date={e.date}
              text={e.kind === "solar" ? "Éclipse solaire" : "Éclipse lunaire"}
              accent
            />
          ))}
        </SubSection>
      )}

      {(lunations?.length ?? 0) > 0 && (
        <SubSection title={`Lunaisons (${lunations.length})`}>
          {lunations.map((l, i) => (
            <Row
              key={`lun-${i}`}
              date={l.date}
              text={`${LUNATION_LABELS[l.phase]} en ${SIGN_NAMES_FR[l.sign] ?? "?"}`}
            />
          ))}
        </SubSection>
      )}

      {(stations?.length ?? 0) > 0 && (
        <SubSection title={`Stations rétrogrades (${stations.length})`}>
          {stations.map((s, i) => {
            const planet = PLANET_NAMES_FR[s.planet] ?? s.planet;
            const verb = s.direction === "retrograde" ? "passe rétrograde" : "redevient direct";
            return <Row key={`stn-${i}`} date={s.date} text={`${planet} ${verb}`} />;
          })}
        </SubSection>
      )}

      {(ingresses?.length ?? 0) > 0 && (
        <SubSection title={`Ingrès (${ingresses.length})`} collapseLong>
          {ingresses.map((g, i) => {
            const planet = PLANET_NAMES_FR[g.planet] ?? g.planet;
            const sign   = SIGN_NAMES_FR[g.toSign] ?? "?";
            return <Row key={`ing-${i}`} date={g.date} text={`${planet} entre en ${sign}`} />;
          })}
        </SubSection>
      )}
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// Subsection wrapper (with optional <details> if collapseLong)
// ──────────────────────────────────────────────────────────

function SubSection({
  title,
  children,
  collapseLong,
}: {
  title: string;
  children: React.ReactNode;
  collapseLong?: boolean;
}) {
  const inner = (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{children}</ul>
  );

  // Pour les ingrès qui peuvent dépasser 100 entrées sur "year", on collapse.
  if (collapseLong) {
    return (
      <details
        className="card"
        style={{ padding: "1rem 1.25rem", marginBottom: "0.75rem" }}
      >
        <summary
          style={{
            cursor: "pointer",
            color: "var(--gold-l)",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "1.05rem",
            outline: "none",
          }}
        >
          {title}
        </summary>
        <div style={{ marginTop: "0.75rem" }}>{inner}</div>
      </details>
    );
  }

  return (
    <section
      className="card"
      style={{ padding: "1rem 1.25rem", marginBottom: "0.75rem" }}
    >
      <h3
        style={{
          margin: "0 0 0.6rem",
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "1.05rem",
          color: "var(--gold-l)",
          fontWeight: 400,
        }}
      >
        {title}
      </h3>
      {inner}
    </section>
  );
}

function Row({
  date,
  text,
  accent,
}: {
  date: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "0.75rem",
        padding: "0.4rem 0",
        borderTop: "1px solid var(--border-soft)",
        fontSize: "0.95rem",
      }}
    >
      <span
        style={{
          color: "var(--muted-2)",
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.85rem",
          minWidth: "11em",
        }}
      >
        {fmtDateTime(date)}
      </span>
      <span style={{ color: accent ? "var(--gold)" : "var(--gold-l)" }}>
        {text}
      </span>
    </li>
  );
}

// CIEL-PUBLIC-V1-PAGES events applied

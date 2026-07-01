// ============================================================
// apps/web/src/components/ciel/EventsList.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import type {
  SkyEvents,
  LunationEvent,
  EclipseEvent,
} from "@/lib/server/sky-fetch";
import { getT, type Locale, type TranslationKey } from "@/lib/i18n/translations";
import styles from "@/components/ciel/ciel.module.css"; // CIEL-POLISH-V1

const PLANET_NAMES: Record<Locale, Record<string, string>> = {
  fr: {
    sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
    mars: "Mars", jupiter: "Jupiter", saturn: "Saturne",
    uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
    northNode: "Nœud Nord", southNode: "Nœud Sud",
  },
  en: {
    sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus",
    mars: "Mars", jupiter: "Jupiter", saturn: "Saturn",
    uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
    northNode: "North Node", southNode: "South Node",
  },
};

const SIGN_NAMES: Record<Locale, string[]> = {
  fr: [
    "Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
    "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons",
  ],
  en: [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ],
};

// ECLIPSE-MAGNITUDE-V1 : libellé d'éclipse enrichi avec magnitude
// précise Swiss Ephemeris quand dispo. Fallback sur le wording
// neutre si le payload backend tourne en mode astracore (kind
// précis et magnitude précise absents).
const ECLIPSE_KIND_KEY: Record<string, TranslationKey> = {
  total:     "ciel_eclipse_total",
  annular:   "ciel_eclipse_annular",
  partial:   "ciel_eclipse_partial",
  hybrid:    "ciel_eclipse_hybrid",
  penumbral: "ciel_eclipse_penumbral",
};

const LUNATION_KEY: Record<LunationEvent["phase"], TranslationKey> = {
  new:           "ciel_lunation_new",
  first_quarter: "ciel_lunation_first",
  full:          "ciel_lunation_full",
  last_quarter:  "ciel_lunation_last",
};

type T = (key: TranslationKey) => string;

function formatEclipseLabel(e: EclipseEvent, t: T): string {
  const base = e.kind === "solar" ? t("ciel_eclipse_solar") : t("ciel_eclipse_lunar");
  const kindWord = e.kindPrecise ? t(ECLIPSE_KIND_KEY[e.kindPrecise]) : null;
  // magnitude affichée à 2 décimales — au-delà c'est du bruit
  // (Swiss Ephemeris est précis ~1e-3 sur les éclipses récentes).
  const magNum = typeof e.magnitudePrecise === "number"
    ? ` (mag. ${e.magnitudePrecise.toFixed(2)})`
    : "";
  if (kindWord) return `${base} ${kindWord}${magNum}`;
  return base;
}

function fmtDateTime(iso: string, lang: Locale, t: T): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", { day: "numeric", month: "long" });
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    const time = lang === "en" ? `${hh}:${mm}` : `${hh}h${mm}`;
    return `${date} ${t("ciel_time_at")} ${time} UTC`;
  } catch {
    return iso;
  }
}

interface EventsListProps {
  events?: SkyEvents | undefined;
  lang:    Locale;
}

export function EventsList({ events, lang }: EventsListProps) {
  if (!events) {
    return null;
  }

  const t = getT(lang);
  const planetNames = PLANET_NAMES[lang];
  const signNames = SIGN_NAMES[lang];

  const { ingresses, stations, lunations, eclipses } = events;
  const total =
    (ingresses?.length ?? 0) +
    (stations?.length ?? 0) +
    (lunations?.length ?? 0) +
    (eclipses?.length ?? 0);

  if (total === 0) {
    return null;
  }

  // CIEL-POLISH-V1 : plus de repli — le contenu des événements s'affiche
  // directement, avec un titre cohérent avec Positions / Aspects.
  return (
    <section aria-label={t("ciel_events_title")} style={{ marginBottom: "2rem" }}>
      <h2 className={styles.dataTitle}>{t("ciel_events_title")}</h2>
      <p className={styles.dataSub}>{t("ciel_head_realtime_2")}</p>
      {(eclipses?.length ?? 0) > 0 && (
        <SubSection title={`${t("ciel_events_eclipses")} (${eclipses.length})`}>
          {eclipses.map((e, i) => (
            <Row
              key={`ecl-${i}`}
              date={e.date}
              text={formatEclipseLabel(e, t)}
              lang={lang}
              t={t}
              accent
            />
          ))}
        </SubSection>
      )}

      {(lunations?.length ?? 0) > 0 && (
        <SubSection title={`${t("ciel_events_lunations")} (${lunations.length})`}>
          {lunations.map((l, i) => (
            <Row
              key={`lun-${i}`}
              date={l.date}
              text={`${t(LUNATION_KEY[l.phase])} ${t("ciel_event_in")} ${signNames[l.sign] ?? "?"}`}
              lang={lang}
              t={t}
            />
          ))}
        </SubSection>
      )}

      {(stations?.length ?? 0) > 0 && (
        <SubSection title={`${t("ciel_events_stations")} (${stations.length})`}>
          {stations.map((s, i) => {
            const planet = planetNames[s.planet] ?? s.planet;
            const verb = s.direction === "retrograde" ? t("ciel_station_retro") : t("ciel_station_direct");
            return <Row key={`stn-${i}`} date={s.date} text={`${planet} ${verb}`} lang={lang} t={t} />;
          })}
        </SubSection>
      )}

      {(ingresses?.length ?? 0) > 0 && (
        <SubSection title={`${t("ciel_events_ingresses")} (${ingresses.length})`}>
          {ingresses.map((g, i) => {
            const planet = planetNames[g.planet] ?? g.planet;
            const sign   = signNames[g.toSign] ?? "?";
            return <Row key={`ing-${i}`} date={g.date} text={`${planet} ${t("ciel_event_enters")} ${sign}`} lang={lang} t={t} />;
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
}: {
  title: string;
  children: React.ReactNode;
}) {
  const inner = (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{children}</ul>
  );

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
  lang,
  t,
  accent,
}: {
  date: string;
  text: string;
  lang: Locale;
  t: T;
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
        {fmtDateTime(date, lang, t)}
      </span>
      <span style={{ color: accent ? "var(--gold)" : "var(--gold-l)" }}>
        {text}
      </span>
    </li>
  );
}

// CIEL-PUBLIC-V1-PAGES events applied

// CIEL-I18N-V1 EventsList applied

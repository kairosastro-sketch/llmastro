// ============================================================
// apps/web/src/components/ciel/CielHeader.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import type { Cadence, MoonPhase } from "@/lib/server/sky-fetch";
import { getT, type Locale, type TranslationKey } from "@/lib/i18n/translations";

const HEAD_KEYS: Record<Cadence, { eyebrow: TranslationKey; title: TranslationKey }> = {
  day:   { eyebrow: "ciel_head_day_eyebrow",   title: "ciel_head_day_title" },
  week:  { eyebrow: "ciel_head_week_eyebrow",  title: "ciel_head_week_title" },
  month: { eyebrow: "ciel_head_month_eyebrow", title: "ciel_head_month_title" },
  year:  { eyebrow: "ciel_head_year_eyebrow",  title: "ciel_head_year_title" },
};

function formatRefDate(iso: string, locale: Locale): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
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
  lang:          Locale;
}

export function CielHeader({ cadence, periodStart, periodEnd, moonPhase, lang }: CielHeaderProps) {
  const t = getT(lang);
  const keys = HEAD_KEYS[cadence];
  const homeHref = lang === "en" ? "/en" : "/";
  const rangeStr = `${formatRefDate(periodStart, lang)} → ${formatRefDate(periodEnd, lang)}`;

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
        {t(keys.eyebrow)}
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
        {t(keys.title)}
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.95rem", margin: "0 0 0.5rem" }}>
        {t("ciel_head_period")} {rangeStr}
      </p>
      <p
        style={{
          color: "var(--gold-l)",
          fontSize: "0.85rem",
          fontStyle: "italic",
          margin: "0.75rem 0 0.4rem",
        }}
      >
        {t("ciel_head_photo_pre")}{" "}
        <strong>{formatRefDate(periodStart, lang)}</strong> {t("ciel_head_photo_mid")}{" "}
        <strong>{t("ciel_head_photo_utc")}</strong>.
      </p>
      <p style={{ color: "var(--muted-2)", fontSize: "0.78rem", margin: 0, lineHeight: 1.5 }}>
        {t("ciel_head_realtime_1")}{" "}
        <a href={homeHref} style={{ color: "var(--gold)", textDecoration: "underline" }}>
          {t("ciel_head_realtime_link")}
        </a>.<br />
        {t("ciel_head_realtime_2")}
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
              {t("ciel_head_moon")} {moonPhase.phase}
              {typeof moonPhase.illumination === "number" && (
                <span style={{ color: "var(--muted)" }}>
                  {" "}· {Math.round(moonPhase.illumination * 100)}% {t("ciel_head_moon_lit")}
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

// CIEL-PUBLIC-V1-CLARITY-V1 CielHeader applied

// CIEL-I18N-V1 CielHeader applied

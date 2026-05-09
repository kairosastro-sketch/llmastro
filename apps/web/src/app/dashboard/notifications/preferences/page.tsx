// ============================================================
// apps/web/src/app/dashboard/notifications/preferences/page.tsx
// PHASE-1F preferences UI
// ------------------------------------------------------------
// Page de configuration des préférences de notifications.
//
// 4 sections :
//   1. Types d'événements   (4 toggles : eclipses / lunations / stations / ingresses)
//   2. Sensibilité          (radio : low / medium / high)
//   3. Notifications email  (radio : never / weekly / instant + checkbox critical)
//   4. Langue               (radio : fr / en)
//
// Stations + ingresses + email sont persistés mais marqués "Bientôt"
// car le dispatcher (Phase 1D) ne les gère pas encore et il n'y a
// pas de canal email (Phase 2).
//
// Mutations optimistic via useUpdateNotificationPreferences. Pas de
// bouton "Save" : chaque toggle PATCH immédiatement.
// ============================================================

"use client";

import Link from "next/link";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/useNotifications";
import { useApp } from "@/lib/i18n";
import type { UserPreferences } from "@/lib/api/notifications";

const T = {
  fr: {
    pageTitle:        "Préférences de notifications",
    pageHint:         "Personnalise les évènements cosmiques que tu reçois et leur sensibilité.",
    backToDashboard:  "← Retour au tableau de bord",
    sectionEvents:    "Types d'évènements",
    eventsHint:       "Active les types qui t'intéressent.",
    eclipses:         "Éclipses",
    eclipsesHint:     "Solaires & lunaires (~4 par an, fort impact).",
    lunations:        "Lunaisons",
    lunationsHint:    "Nouvelles lunes, premiers/derniers quartiers, pleines lunes (4 par mois).",
    stations:         "Stations planétaires",
    stationsHint:     "Quand une planète passe en rétrograde ou en direct.",
    ingresses:        "Ingrès",
    ingressesHint:    "Quand une planète change de signe.",
    sectionThreshold: "Sensibilité",
    thresholdHint:    "Plus la sensibilité est haute, moins tu recevras de notifications, mais plus elles seront marquantes pour ton thème natal.",
    low:              "Basse",
    lowHint:          "Reçois toutes les alertes pertinentes.",
    medium:           "Moyenne",
    mediumHint:       "Filtre les évènements peu impactants.",
    high:             "Haute",
    highHint:         "Uniquement les évènements forts pour ton thème.",
    sectionEmail:     "Notifications email",
    emailHint:        "Bientôt disponible — tes préférences sont enregistrées dès maintenant.",
    emailNever:       "Jamais",
    emailWeekly:      "Récap hebdomadaire",
    emailInstant:     "À chaque évènement",
    emailCritical:    "M'envoyer un email pour les évènements critiques uniquement",
    sectionLocale:    "Langue",
    localeHint:       "Langue des titres et textes générés (Kairos LLM).",
    localeFr:         "Français",
    localeEn:         "English",
    soon:             "Bientôt",
    loading:          "Chargement...",
    error:            "Erreur de chargement des préférences.",
  },
  en: {
    pageTitle:        "Notification preferences",
    pageHint:         "Customize which cosmic events you receive and their sensitivity.",
    backToDashboard:  "← Back to dashboard",
    sectionEvents:    "Event types",
    eventsHint:       "Toggle the types that interest you.",
    eclipses:         "Eclipses",
    eclipsesHint:     "Solar & lunar (~4/year, strong impact).",
    lunations:        "Lunations",
    lunationsHint:    "New moons, first/last quarters, full moons (4 per month).",
    stations:         "Planetary stations",
    stationsHint:     "When a planet turns retrograde or direct.",
    ingresses:        "Ingresses",
    ingressesHint:    "When a planet changes sign.",
    sectionThreshold: "Sensitivity",
    thresholdHint:    "Higher sensitivity = fewer notifications, but only the most relevant for your chart.",
    low:              "Low",
    lowHint:          "Receive all relevant alerts.",
    medium:           "Medium",
    mediumHint:       "Filter out minor events.",
    high:             "High",
    highHint:         "Only highly impactful events for your chart.",
    sectionEmail:     "Email notifications",
    emailHint:        "Coming soon — your preferences are saved now.",
    emailNever:       "Never",
    emailWeekly:      "Weekly digest",
    emailInstant:     "Each event",
    emailCritical:    "Email me only for critical events",
    sectionLocale:    "Language",
    localeHint:       "Language of generated titles & texts (Kairos LLM).",
    localeFr:         "Français",
    localeEn:         "English",
    soon:             "Soon",
    loading:          "Loading...",
    error:            "Failed to load preferences.",
  },
} as const;

export default function NotificationPreferencesPage() {
  const { locale } = useApp();
  const lang = locale === "en" ? "en" : "fr";
  const t = T[lang];

  const { data: prefs, isLoading, error } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        <div className="spinner" />
        <div style={{ marginTop: 12 }}>{t.loading}</div>
      </div>
    );
  }

  if (error || !prefs) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--tension)" }}>
        {t.error}
      </div>
    );
  }

  const patch = (p: UserPreferences) => update.mutate(p);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 80px" }}>
      <Link
        href="/dashboard"
        style={{
          color: "var(--muted)",
          fontSize: 13,
          textDecoration: "none",
          display: "inline-block",
          marginBottom: 16,
        }}
      >
        {t.backToDashboard}
      </Link>

      <h1
        style={{
          margin: "0 0 6px",
          fontSize: 24,
          fontFamily: "var(--font-display, serif)",
          color: "var(--star)",
        }}
      >
        {t.pageTitle}
      </h1>
      <p style={{ margin: "0 0 28px", color: "var(--muted)", fontSize: 14, lineHeight: 1.5 }}>
        {t.pageHint}
      </p>

      {/* Section 1 — Types d'évènements */}
      <Section title={t.sectionEvents} hint={t.eventsHint}>
        <ToggleRow
          label={t.eclipses}
          hint={t.eclipsesHint}
          checked={prefs.notify_events.eclipses}
          onChange={(v) => patch({ notify_events: { eclipses: v } })}
        />
        <ToggleRow
          label={t.lunations}
          hint={t.lunationsHint}
          checked={prefs.notify_events.lunations}
          onChange={(v) => patch({ notify_events: { lunations: v } })}
        />
        <ToggleRow
          label={t.stations}
          hint={t.stationsHint}
          checked={prefs.notify_events.stations}
          onChange={(v) => patch({ notify_events: { stations: v } })}
          soonLabel={t.soon}
        />
        <ToggleRow
          label={t.ingresses}
          hint={t.ingressesHint}
          checked={prefs.notify_events.ingresses}
          onChange={(v) => patch({ notify_events: { ingresses: v } })}
          soonLabel={t.soon}
        />
      </Section>

      {/* Section 2 — Sensibilité */}
      <Section title={t.sectionThreshold} hint={t.thresholdHint}>
        <RadioRow
          name="threshold"
          options={[
            { value: "low",    label: t.low,    hint: t.lowHint    },
            { value: "medium", label: t.medium, hint: t.mediumHint },
            { value: "high",   label: t.high,   hint: t.highHint   },
          ]}
          value={prefs.notify_threshold}
          onChange={(v) => patch({ notify_threshold: v as "low" | "medium" | "high" })}
        />
      </Section>

      {/* Section 3 — Email (placeholder) */}
      <Section title={t.sectionEmail} hint={t.emailHint} soonLabel={t.soon}>
        <RadioRow
          name="email_freq"
          options={[
            { value: "never",   label: t.emailNever   },
            { value: "weekly",  label: t.emailWeekly  },
            { value: "instant", label: t.emailInstant },
          ]}
          value={prefs.notify_email_frequency}
          onChange={(v) =>
            patch({
              notify_email_frequency: v as "never" | "weekly" | "instant",
            })
          }
        />
        <ToggleRow
          label={t.emailCritical}
          checked={prefs.notify_email_critical}
          onChange={(v) => patch({ notify_email_critical: v })}
        />
      </Section>

      {/* Section 4 — Langue */}
      <Section title={t.sectionLocale} hint={t.localeHint}>
        <RadioRow
          name="locale"
          options={[
            { value: "fr", label: t.localeFr },
            { value: "en", label: t.localeEn },
          ]}
          value={prefs.locale}
          onChange={(v) => patch({ locale: v as "fr" | "en" })}
        />
      </Section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Sous-composants présentationnels
// ──────────────────────────────────────────────────────────

interface SectionProps {
  title:     string;
  hint?:     string;
  soonLabel?: string;
  children:  React.ReactNode;
}

function Section({ title, hint, soonLabel, children }: SectionProps) {
  return (
    <section
      style={{
        marginBottom:    24,
        padding:         "20px 18px",
        background:      "var(--card-bg)",
        border:          "1px solid var(--card-border)",
        borderRadius:    12,
      }}
    >
      <div
        style={{
          display:    "flex",
          alignItems: "center",
          gap:        8,
          marginBottom: 4,
        }}
      >
        <h2
          style={{
            margin:       0,
            fontSize:     15,
            fontFamily:   "var(--font-display, serif)",
            color:        "var(--gold)",
            letterSpacing: ".5px",
          }}
        >
          {title}
        </h2>
        {soonLabel && (
          <span
            style={{
              fontSize:    10,
              padding:     "2px 8px",
              borderRadius: 999,
              border:      "1px solid var(--border-mid)",
              color:       "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: ".5px",
            }}
          >
            {soonLabel}
          </span>
        )}
      </div>
      {hint && (
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

interface ToggleRowProps {
  label:     string;
  hint?:     string;
  checked:   boolean;
  onChange:  (v: boolean) => void;
  soonLabel?: string;
}

function ToggleRow({ label, hint, checked, onChange, soonLabel }: ToggleRowProps) {
  return (
    <label
      style={{
        display:        "flex",
        alignItems:     "flex-start",
        gap:            12,
        padding:        "8px 0",
        cursor:         "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          marginTop: 3,
          width:  16,
          height: 16,
          accentColor: "var(--gold)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--star)", fontSize: 14 }}>{label}</span>
          {soonLabel && (
            <span
              style={{
                fontSize:    10,
                padding:     "1px 6px",
                borderRadius: 999,
                border:      "1px solid var(--border-mid)",
                color:       "var(--muted-2)",
                textTransform: "uppercase",
                letterSpacing: ".5px",
              }}
            >
              {soonLabel}
            </span>
          )}
        </div>
        {hint && (
          <div style={{ color: "var(--muted-2)", fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
            {hint}
          </div>
        )}
      </div>
    </label>
  );
}

interface RadioOption {
  value: string;
  label: string;
  hint?: string;
}
interface RadioRowProps {
  name:     string;
  options:  RadioOption[];
  value:    string;
  onChange: (v: string) => void;
}

function RadioRow({ name, options, value, onChange }: RadioRowProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((opt) => (
        <label
          key={opt.value}
          style={{
            display:    "flex",
            alignItems: "flex-start",
            gap:        12,
            padding:    "8px 10px",
            cursor:     "pointer",
            background: value === opt.value ? "var(--bg-raised)" : "transparent",
            borderRadius: 6,
            border: value === opt.value
              ? "1px solid var(--border-mid)"
              : "1px solid transparent",
          }}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{
              marginTop: 3,
              accentColor: "var(--gold)",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--star)", fontSize: 14 }}>{opt.label}</div>
            {opt.hint && (
              <div style={{ color: "var(--muted-2)", fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
                {opt.hint}
              </div>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

// PHASE-1F preferences page applied

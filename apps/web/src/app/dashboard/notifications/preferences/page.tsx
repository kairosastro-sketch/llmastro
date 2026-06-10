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
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useApp } from "@/lib/i18n";
import type { UserPreferences } from "@/lib/api/notifications";

const T = {
  fr: {
    pageTitle:        "Préférences de notifications",
    pageHint:         "Kairos t'écrit quand le ciel touche ton thème natal — choisis ici les évènements que tu reçois et leur sensibilité.",
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
    dailyHoroscope:   "Horoscope quotidien",
    dailyHoroscopeHint: "Une notification chaque matin à 8h (fuseau horaire local) avec un teaser personnalisé.",
    sectionThreshold: "Sensibilité",
    thresholdHint:    "Plus la sensibilité est haute, moins tu recevras de notifications, mais plus elles seront marquantes pour ton thème natal.",
    low:              "Basse",
    lowHint:          "Reçois toutes les alertes pertinentes.",
    medium:           "Moyenne",
    mediumHint:       "Filtre les évènements peu impactants.",
    high:             "Haute",
    highHint:         "Uniquement les évènements forts pour ton thème.",
    sectionPush:      "Notifications navigateur",
    pushHint:         "Reçois les notifications directement sur ce navigateur, même quand Llmastro n'est pas ouvert.",
    pushStatusOff:    "Désactivées sur ce navigateur",
    pushStatusOn:     "Activées sur ce navigateur",
    pushStatusDenied: "Bloquées par le navigateur. Tu peux les ré-autoriser dans les paramètres du site.",
    pushStatusUnsup:  "Ce navigateur ne supporte pas les push notifications.",
    pushStatusNoConf: "Indisponible pour le moment (configuration côté serveur manquante).",
    pushEnable:       "Activer",
    pushDisable:      "Désactiver",
    pushBusy:         "…",
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
    pageHint:         "Kairos writes to you when the sky touches your natal chart — choose which events you receive and their sensitivity.",
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
    dailyHoroscope:   "Daily horoscope",
    dailyHoroscopeHint: "A notification every morning at 8 AM (local timezone) with a personalized teaser.",
    sectionThreshold: "Sensitivity",
    thresholdHint:    "Higher sensitivity = fewer notifications, but only the most relevant for your chart.",
    low:              "Low",
    lowHint:          "Receive all relevant alerts.",
    medium:           "Medium",
    mediumHint:       "Filter out minor events.",
    high:             "High",
    highHint:         "Only highly impactful events for your chart.",
    sectionPush:      "Browser notifications",
    pushHint:         "Receive notifications directly on this browser, even when Llmastro is not open.",
    pushStatusOff:    "Disabled on this browser",
    pushStatusOn:     "Enabled on this browser",
    pushStatusDenied: "Blocked by your browser. You can re-allow them in site settings.",
    pushStatusUnsup:  "This browser doesn't support push notifications.",
    pushStatusNoConf: "Currently unavailable (server-side configuration missing).",
    pushEnable:       "Enable",
    pushDisable:      "Disable",
    pushBusy:         "…",
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
  const push   = usePushSubscription();

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
        <ToggleRow
          label={t.dailyHoroscope}
          hint={t.dailyHoroscopeHint}
          checked={prefs.notify_daily_horoscope}
          onChange={(v) => patch({ notify_daily_horoscope: v })}
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

      {/* Section 3 — Push browser (WEB-PUSH-V1) */}
      <Section title={t.sectionPush} hint={t.pushHint}>
        <PushControlRow
          status={push.status}
          error={push.error}
          onEnable={() => void push.enable()}
          onDisable={() => void push.disable()}
          labels={{
            statusOff:    t.pushStatusOff,
            statusOn:     t.pushStatusOn,
            statusDenied: t.pushStatusDenied,
            statusUnsup:  t.pushStatusUnsup,
            statusNoConf: t.pushStatusNoConf,
            enable:       t.pushEnable,
            disable:      t.pushDisable,
            busy:         t.pushBusy,
          }}
        />
      </Section>

      {/* Section 4 — Email (placeholder) */}
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

// ──────────────────────────────────────────────────────────
// WEB-PUSH-V1 — sous-composant dédié au toggle push browser
// ──────────────────────────────────────────────────────────

interface PushControlLabels {
  statusOff:    string;
  statusOn:     string;
  statusDenied: string;
  statusUnsup:  string;
  statusNoConf: string;
  enable:       string;
  disable:      string;
  busy:         string;
}

interface PushControlProps {
  status:    string;
  error:     string | null;
  onEnable:  () => void;
  onDisable: () => void;
  labels:    PushControlLabels;
}

function PushControlRow({ status, error, onEnable, onDisable, labels }: PushControlProps) {
  // Mapping status (string typé "loading"|"unsupported"|...) → label + action affichée.
  let statusLabel: string;
  let actionLabel: string | null;
  let actionHandler: (() => void) | null;
  let actionDisabled = false;

  switch (status) {
    case "loading":
      statusLabel    = labels.busy;
      actionLabel    = null;
      actionHandler  = null;
      break;
    case "unsupported":
      statusLabel    = labels.statusUnsup;
      actionLabel    = null;
      actionHandler  = null;
      break;
    case "not-configured":
      statusLabel    = labels.statusNoConf;
      actionLabel    = null;
      actionHandler  = null;
      break;
    case "denied":
      statusLabel    = labels.statusDenied;
      actionLabel    = null;
      actionHandler  = null;
      break;
    case "subscribed":
      statusLabel    = labels.statusOn;
      actionLabel    = labels.disable;
      actionHandler  = onDisable;
      break;
    case "subscribing":
    case "unsubscribing":
      statusLabel    = labels.busy;
      actionLabel    = labels.busy;
      actionHandler  = null;
      actionDisabled = true;
      break;
    case "error":
    case "idle":
    default:
      statusLabel    = labels.statusOff;
      actionLabel    = labels.enable;
      actionHandler  = onEnable;
  }

  return (
    <div
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        12,
        padding:    "8px 0",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--star)", fontSize: 14 }}>{statusLabel}</div>
        {status === "error" && error && (
          <div style={{ color: "var(--tension)", fontSize: 11, marginTop: 2 }}>
            {error}
          </div>
        )}
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={actionHandler ?? undefined}
          disabled={actionDisabled || !actionHandler}
          style={{
            background:   status === "subscribed" ? "transparent" : "var(--gold)",
            color:        status === "subscribed" ? "var(--muted)" : "var(--bg-2)",
            border:       status === "subscribed"
              ? "1px solid var(--border-mid)"
              : "1px solid var(--gold)",
            borderRadius: 999,
            padding:      "5px 14px",
            fontSize:     12,
            fontWeight:   600,
            cursor:       actionDisabled ? "default" : "pointer",
            opacity:      actionDisabled ? 0.6 : 1,
            whiteSpace:   "nowrap",
            flexShrink:   0,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// PHASE-1F preferences page applied
// WEB-PUSH-V1 preferences section applied
// KAIROS-VOICE-V1 applied (pageHint nomme Kairos)

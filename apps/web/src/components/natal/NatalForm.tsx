"use client";

// ============================================================
// NatalForm — formulaire de création OU édition d'un profil natal
// ------------------------------------------------------------
// Deux modes automatiques :
//   • Création : aucun `initialProfile` passé → POST /natal
//   • Édition  : `initialProfile` fourni → PATCH /natal/:id
//
// Champs gérés :
//   label, birthDate, birthTime (+ timeUnknown), birthCity,
//   gender (male / female / unspecified),
//   relationshipStatus (single / couple / unspecified).
//
// Les deux exports secondaires (BirthTimeUnknownBadge,
// BirthTimeApproxBanner) sont préservés à l'identique — ils sont
// utilisés par /dashboard/natal/page.tsx.
// ============================================================

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi } from "@/lib/api/client";
import { useT, useApp } from "@/lib/i18n";

// ──────────────────────────────────────────────────────────
// Villes avec IANA tz — doit refléter la base backend cities.ts
// ──────────────────────────────────────────────────────────

const CITIES: Record<string, { lat: number; lng: number; ianaTz: string }> = {
  "Paris": { lat: 48.857, lng: 2.352, ianaTz: "Europe/Paris" },
  "Lyon": { lat: 45.764, lng: 4.836, ianaTz: "Europe/Paris" },
  "Marseille": { lat: 43.297, lng: 5.37, ianaTz: "Europe/Paris" },
  "Toulouse": { lat: 43.605, lng: 1.444, ianaTz: "Europe/Paris" },
  "Nice": { lat: 43.71, lng: 7.262, ianaTz: "Europe/Paris" },
  "Bordeaux": { lat: 44.838, lng: -0.579, ianaTz: "Europe/Paris" },
  "Lille": { lat: 50.633, lng: 3.058, ianaTz: "Europe/Paris" },
  "Strasbourg": { lat: 48.573, lng: 7.752, ianaTz: "Europe/Paris" },
  "Nantes": { lat: 47.218, lng: -1.554, ianaTz: "Europe/Paris" },
  "Rennes": { lat: 48.117, lng: -1.678, ianaTz: "Europe/Paris" },
  "Montpellier": { lat: 43.611, lng: 3.877, ianaTz: "Europe/Paris" },
  "Grenoble": { lat: 45.189, lng: 5.724, ianaTz: "Europe/Paris" },
  "Dijon": { lat: 47.322, lng: 5.041, ianaTz: "Europe/Paris" },
  "Ajaccio": { lat: 41.927, lng: 8.737, ianaTz: "Europe/Paris" },
  "Cayenne": { lat: 4.933, lng: -52.327, ianaTz: "America/Cayenne" },
  "Fort-de-France": { lat: 14.616, lng: -61.058, ianaTz: "America/Martinique" },
  "Pointe-à-Pitre": { lat: 16.241, lng: -61.533, ianaTz: "America/Guadeloupe" },
  "Mamoudzou": { lat: -12.78, lng: 45.228, ianaTz: "Indian/Mayotte" },
  "Saint-Denis (974)": { lat: -20.882, lng: 55.451, ianaTz: "Indian/Reunion" },
  "Nouméa": { lat: -22.275, lng: 166.458, ianaTz: "Pacific/Noumea" },
  "Papeete": { lat: -17.551, lng: -149.558, ianaTz: "Pacific/Tahiti" },
  "Bruxelles": { lat: 50.85, lng: 4.352, ianaTz: "Europe/Brussels" },
  "Genève": { lat: 46.204, lng: 6.143, ianaTz: "Europe/Zurich" },
  "Luxembourg": { lat: 49.612, lng: 6.13, ianaTz: "Europe/Luxembourg" },
  "Monaco": { lat: 43.731, lng: 7.42, ianaTz: "Europe/Monaco" },
  "Londres": { lat: 51.507, lng: -0.128, ianaTz: "Europe/London" },
  "Berlin": { lat: 52.52, lng: 13.405, ianaTz: "Europe/Berlin" },
  "Madrid": { lat: 40.417, lng: -3.704, ianaTz: "Europe/Madrid" },
  "Rome": { lat: 41.902, lng: 12.496, ianaTz: "Europe/Rome" },
  "Montréal": { lat: 45.502, lng: -73.567, ianaTz: "America/Toronto" },
  "New York": { lat: 40.713, lng: -74.006, ianaTz: "America/New_York" },
  "Tokyo": { lat: 35.6895, lng: 139.6917, ianaTz: "Asia/Tokyo" },
  "Sydney": { lat: -33.8688, lng: 151.2093, ianaTz: "Australia/Sydney" },
  "Dakar": { lat: 14.692, lng: -17.446, ianaTz: "Africa/Dakar" },
  "Casablanca": { lat: 33.573, lng: -7.589, ianaTz: "Africa/Casablanca" },
};

const CITY_NAMES = Object.keys(CITIES).sort((a, b) =>
  a.localeCompare(b, "fr", { sensitivity: "base" }),
);

// ──────────────────────────────────────────────────────────
// Types publics (pour édition)
// ──────────────────────────────────────────────────────────

export type GenderValue = "male" | "female" | "unspecified";
export type RelationshipValue = "single" | "couple" | "unspecified";

export interface InitialNatalProfile {
  id:                  string;
  label:               string;
  birthDate:           string;
  birthTime:           string;
  birthCity:           string;
  birthTimeUnknown?:   boolean;
  gender?:             GenderValue;
  relationshipStatus?: RelationshipValue;
}

// ──────────────────────────────────────────────────────────
// Badge "heure inconnue" — (exporté, utilisé sur la fiche natale)
// ──────────────────────────────────────────────────────────

export function BirthTimeUnknownBadge({ locale }: { locale: "fr" | "en" }) {
  return (
    <span
      className="badge-approx"
      title={locale === "fr"
        ? "Heure de naissance non renseignée — Ascendant, MC, maisons et Lune peuvent être approximatifs."
        : "Birth time not provided — Ascendant, MC, houses and Moon may be approximate."}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        background: "rgba(229, 180, 69, 0.12)",
        color: "var(--gold)",
        border: "1px solid rgba(229, 180, 69, 0.3)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      <span aria-hidden>⚠</span>
      {locale === "fr" ? "Heure inconnue" : "Time unknown"}
    </span>
  );
}

// ──────────────────────────────────────────────────────────
// Bandeau d'avertissement au-dessus de l'analyse IA
// ──────────────────────────────────────────────────────────

export function BirthTimeApproxBanner({ locale }: { locale: "fr" | "en" }) {
  return (
    <div
      role="note"
      style={{
        padding: "10px 14px",
        marginBottom: 16,
        borderRadius: 8,
        background: "rgba(229, 180, 69, 0.08)",
        borderLeft: "3px solid var(--gold)",
        color: "var(--text)",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ color: "var(--gold)" }}>
        {locale === "fr" ? "⚠ Interprétation approximative" : "⚠ Approximate interpretation"}
      </strong>
      <p style={{ margin: "4px 0 0", opacity: 0.9 }}>
        {locale === "fr"
          ? "L'heure de naissance n'est pas renseignée. L'Ascendant, le MC, les maisons et la position de la Lune peuvent être imprécis. Les interprétations sur la carrière, le foyer et les relations sont donc à prendre avec nuance."
          : "Birth time is not provided. Ascendant, MC, houses and Moon position may be inaccurate. Interpretations about career, home and relationships should be taken with caveats."}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Segmented field — bouton multi-option, style pill
// ──────────────────────────────────────────────────────────

function SegmentedField<T extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        {options.map(opt => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: active ? "var(--gold)" : "var(--border)",
                background:  active ? "rgba(229,180,69,0.12)" : "transparent",
                color:       active ? "var(--gold)" : "var(--muted)",
                fontSize: 12,
                fontFamily: "var(--font-display)",
                letterSpacing: 0.3,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Formulaire — création ou édition
// ──────────────────────────────────────────────────────────

export function NatalForm({
  initialProfile,
  onCancel,
  onSaved,
}: {
  initialProfile?: InitialNatalProfile;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const isEdit = !!initialProfile;
  const { accessToken } = useAuth();
  const { locale } = useApp();
  const t = useT();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    label:              initialProfile?.label              ?? "",
    birthDate:          initialProfile?.birthDate          ?? "",
    birthTime:          initialProfile?.birthTime          ?? "12:00",
    birthCity:          initialProfile?.birthCity          ?? "Paris",
    timeUnknown:        initialProfile?.birthTimeUnknown   ?? false,
    gender:             (initialProfile?.gender ?? "unspecified") as GenderValue,
    relationshipStatus: (initialProfile?.relationshipStatus ?? "unspecified") as RelationshipValue,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredCities = useMemo(() => {
    const q = form.birthCity.toLowerCase().trim();
    if (!q) return CITY_NAMES.slice(0, 10);
    return CITY_NAMES.filter(n => n.toLowerCase().includes(q)).slice(0, 10);
  }, [form.birthCity]);

  const cityResolved = CITIES[form.birthCity];

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      setSuccessMsg(null);
      setSuggestions([]);

      const city = CITIES[form.birthCity];
      if (!city) {
        const near = CITY_NAMES
          .filter(n => n.toLowerCase().includes(form.birthCity.toLowerCase().slice(0, 3)))
          .slice(0, 3);
        setSuggestions(near);
        throw new Error(
          locale === "fr"
            ? `Ville inconnue : "${form.birthCity}". Essaie l'une des suggestions.`
            : `Unknown city: "${form.birthCity}". Try one of the suggestions.`,
        );
      }

      const payload = {
        label:              form.label,
        birthDate:          form.birthDate,
        birthTime:          form.timeUnknown ? "12:00" : form.birthTime,
        birthTimeUnknown:   form.timeUnknown,
        latitude:           city.lat,
        longitude:          city.lng,
        timezone:           city.ianaTz,
        birthCity:          form.birthCity,
        birthCountry:       "France",
        gender:             form.gender,
        relationshipStatus: form.relationshipStatus,
      };

      try {
        const res = isEdit && initialProfile
          ? await natalApi.update(accessToken!, initialProfile.id, payload)
          : await natalApi.create(accessToken!, payload);
        return res;
      } catch (err: any) {
        const code = err?.response?.data?.error?.code;
        if (code === "CITY_NOT_FOUND") {
          const s = err?.response?.data?.error?.suggestions ?? [];
          setSuggestions(s);
        }
        const msg = err?.message
          ?? err?.response?.data?.error?.message
          ?? (locale === "fr" ? "Erreur inconnue" : "Unknown error");
        throw new Error(msg);
      }
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["natal"] });
      qc.invalidateQueries({ queryKey: ["chart"] });
      qc.invalidateQueries({ queryKey: ["horoscope"] });
      const newId =
        initialProfile?.id ??
        res?.data?.profile?.id ??
        res?.data?.natal?.id ??
        res?.data?.id ??
        res?.id;
      setSuccessMsg(
        locale === "fr"
          ? (isEdit ? "Profil mis à jour ✦" : "Profil créé ✦")
          : (isEdit ? "Profile saved ✦" : "Profile created ✦"),
      );
      if (newId) onSaved(newId);
    },
    onError: (err: any) => {
      setErrorMsg(err?.message ?? (locale === "fr" ? "Erreur lors de la sauvegarde" : "Error saving profile"));
    },
  });

  const isValid =
    form.label.trim().length > 0 &&
    form.birthDate &&
    cityResolved;

  const title = isEdit
    ? (locale === "fr" ? "Éditer mon profil" : "Edit my profile")
    : t("natal_new");

  const saveLabel = isEdit
    ? (locale === "fr" ? "Sauvegarder" : "Save")
    : `${t("natal_calc")} ✦`;

  return (
    <div className="page-root" style={{ maxWidth: 480 }}>
      <div className="hero animate-fade-up" style={{ padding: "8px 0 16px" }}>
        <div style={{ fontSize: 38, color: "var(--gold)", marginBottom: 6 }}>✦</div>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: 26, color: "var(--gold)", letterSpacing: 2,
        }}>
          {title}
        </h1>
      </div>

      <div className="animate-fade-up delay-100" style={{
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div>
          <label className="form-label">{t("natal_name")}</label>
          <input
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder="Marie"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="form-label">{t("natal_birthdate")}</label>
          <input
            type="date"
            value={form.birthDate}
            onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">{t("natal_birthtime")}</label>
            <input
              type="time"
              value={form.birthTime}
              onChange={e => setForm(f => ({ ...f, birthTime: e.target.value }))}
              disabled={form.timeUnknown}
            />
            <label style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 6,
              cursor: "pointer", fontSize: 11, color: "var(--muted)",
            }}>
              <input
                type="checkbox"
                checked={form.timeUnknown}
                onChange={e => setForm(f => ({ ...f, timeUnknown: e.target.checked }))}
                style={{ accentColor: "var(--gold)", width: "auto" }}
              />
              <span>{t("natal_unknown")}</span>
            </label>
            {form.timeUnknown && (
              <p style={{
                margin: "6px 0 0", fontSize: 11, color: "var(--muted)",
                fontStyle: "italic",
              }}>
                {locale === "fr"
                  ? "Ton thème utilisera 12:00 mais l'Ascendant, les maisons et la Lune resteront approximatifs."
                  : "Chart will use 12:00 but Ascendant, houses and Moon will remain approximate."}
              </p>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <label className="form-label">{t("natal_city")}</label>
            <input
              type="text"
              list="city-suggestions"
              value={form.birthCity}
              onChange={e => {
                setForm(f => ({ ...f, birthCity: e.target.value }));
                setSuggestions([]);
              }}
              placeholder={locale === "fr" ? "Commence à taper…" : "Start typing…"}
              autoComplete="off"
              style={{
                borderColor: !cityResolved && form.birthCity
                  ? "var(--tension)"
                  : undefined,
              }}
            />
            <datalist id="city-suggestions">
              {filteredCities.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {!cityResolved && form.birthCity && (
              <p style={{
                margin: "4px 0 0", fontSize: 11, color: "var(--tension)",
              }}>
                {locale === "fr"
                  ? "Ville non reconnue dans la base."
                  : "City not recognized in database."}
              </p>
            )}
          </div>
        </div>

        <SegmentedField<GenderValue>
          label={locale === "fr" ? "Genre" : "Gender"}
          value={form.gender}
          onChange={v => setForm(f => ({ ...f, gender: v }))}
          options={[
            { value: "male",        label: locale === "fr" ? "Homme"       : "Male" },
            { value: "female",      label: locale === "fr" ? "Femme"       : "Female" },
            { value: "unspecified", label: locale === "fr" ? "Non précisé" : "Unspecified" },
          ]}
        />

        <SegmentedField<RelationshipValue>
          label={locale === "fr" ? "Situation amoureuse" : "Relationship"}
          value={form.relationshipStatus}
          onChange={v => setForm(f => ({ ...f, relationshipStatus: v }))}
          options={[
            { value: "single",      label: locale === "fr" ? "Célibataire" : "Single" },
            { value: "couple",      label: locale === "fr" ? "En couple"   : "In couple" },
            { value: "unspecified", label: locale === "fr" ? "Non précisé" : "Unspecified" },
          ]}
        />

        {suggestions.length > 0 && (
          <div style={{
            padding: "8px 12px", borderRadius: 6,
            background: "rgba(229, 180, 69, 0.08)",
            fontSize: 12, color: "var(--muted)",
          }}>
            <strong>{locale === "fr" ? "Suggestions : " : "Did you mean: "}</strong>
            {suggestions.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm(f => ({ ...f, birthCity: s }))}
                style={{
                  background: "none", border: "none",
                  color: "var(--gold)", cursor: "pointer",
                  padding: "0 4px", textDecoration: "underline",
                }}
              >
                {s}{i < suggestions.length - 1 ? "," : ""}
              </button>
            ))}
          </div>
        )}

        {errorMsg && (
          <div className="alert-banner" style={{
            background: "rgba(229, 69, 69, 0.08)",
            borderColor: "rgba(229, 69, 69, 0.25)",
            color: "var(--tension)",
          }}>
            <span className="ab-ico">⚠</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-banner" style={{
            background: "rgba(52, 211, 153, 0.08)",
            borderColor: "rgba(52, 211, 153, 0.25)",
            color: "var(--harmony)",
          }}>
            <span className="ab-ico">✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        <button
          className="btn-ob"
          onClick={() => mutation.mutate()}
          disabled={!isValid || mutation.isPending}
          style={{ marginTop: 8 }}
        >
          {mutation.isPending ? t("natal_loading") : saveLabel}
        </button>

        <button className="btn-ghost" onClick={onCancel}>
          {t("natal_cancel")}
        </button>
      </div>
    </div>
  );
}

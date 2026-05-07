"use client";

// ============================================================
// apps/web/src/components/natal/NatalForm.tsx
// ------------------------------------------------------------
// Formulaire création / édition d'un profil natal.
//
// Champs :
//   label, birthDate, birthTime (+ timeUnknown), birthCity,
//   gender, relationshipStatus.
//
// Note : depuis le patch CITIES-MONDIALES, le sélecteur de
// ville utilise <CityAutocomplete> branché sur la table cities
// (231 000+ villes mondiales avec timezone IANA officielle).
// Les anciennes constantes CITIES / CITY_NAMES hardcodées ont
// été supprimées.
// ============================================================

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useT, useApp } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi } from "@/lib/api/client";
import type { NatalData } from "@astro-platform/types";
import { CityAutocomplete, type CityValue } from "./CityAutocomplete";
import { useToast } from "@/components/ui/Toaster";  // TOASTER-WIRING-V1

// ──────────────────────────────────────────────────────────
// Types métier
// ──────────────────────────────────────────────────────────

type GenderValue       = "male" | "female" | "unspecified";
type RelationshipValue = "single" | "couple" | "unspecified";

interface InitialNatalProfile {
  id?:                   string;
  label?:                string;
  birthDate?:            string;
  birthTime?:            string;
  birthCity?:            string;
  birthCountry?:         string;
  birthTimeUnknown?:     boolean;
  latitude?:             number;
  longitude?:            number;
  timezone?:             string;
  // NATAL-FORM-UX-POLISH-V1 : champs optionnels pour reconstituer
  // un CityValue en mode édition (drapeau + région).
  // Non stockés en DB aujourd'hui — peuvent être passés vides.
  countryCode?:          string;
  admin1Name?:           string;
  gender?:               GenderValue;
  relationshipStatus?:   RelationshipValue;
}

interface NatalFormProps {
  mode?:          "create" | "edit";
  initialProfile?: InitialNatalProfile;
  onSuccess?:     (profile: NatalData) => void;
  onCancel?:      () => void;
  hideHeader?:    boolean;
}

interface FormState {
  label:               string;
  birthDate:           string;
  birthTime:           string;
  selectedCity:        CityValue | null;
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
        borderRadius: 8,
        background: "rgba(229, 180, 69, 0.08)",
        border: "1px solid rgba(229, 180, 69, 0.25)",
        color: "var(--gold)",
        fontSize: 12,
        lineHeight: 1.5,
        marginBottom: 12,
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>
        {locale === "fr" ? "⚠ Heure de naissance approximative" : "⚠ Approximate birth time"}
      </strong>
      {locale === "fr"
        ? "Sans heure exacte, l'Ascendant, le Milieu du Ciel, les maisons et la position fine de la Lune sont indicatifs. Le Soleil et les autres planètes restent fiables."
        : "Without exact birth time, the Ascendant, Midheaven, houses and fine Moon position are indicative only. Sun and other planets remain reliable."}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Petit composant interne SegmentedField (boutons radio horizontaux)
// ──────────────────────────────────────────────────────────

interface SegmentedFieldProps<V extends string> {
  label:    string;
  value:    V;
  onChange: (v: V) => void;
  options:  Array<{ value: V; label: string }>;
}

function SegmentedField<V extends string>({ label, value, onChange, options }: SegmentedFieldProps<V>) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div role="radiogroup" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              minWidth: 90,
              padding: "8px 12px",
              borderRadius: 6,
              border: value === opt.value
                ? "1px solid var(--gold)"
                : "1px solid var(--border)",
              background: value === opt.value
                ? "rgba(229, 180, 69, 0.14)"
                : "transparent",
              color: value === opt.value ? "var(--gold)" : "var(--star)",
              fontSize: 13,
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Composant principal
// ──────────────────────────────────────────────────────────

export function NatalForm({
  mode = "create",
  initialProfile,
  onSuccess,
  onCancel,
  hideHeader = false,
}: NatalFormProps) {
  // NATAL-FORM-CONTRACT-V1 : alias interne pour minimiser le diff
  // sur les références internes (initialProfile?.id, header, label).
  const isEdit = mode === "edit";
  const { accessToken } = useAuth();
  const router = useRouter();
  const { locale } = useApp();
  const t = useT();
  const qc = useQueryClient();
  const { toast } = useToast();  // TOASTER-WIRING-V1

  // NATAL-FORM-UX-POLISH-V1 : pré-remplit selectedCity en mode édition
  // si tous les champs city de initialProfile sont présents (lat/lng/tz/name).
  // geonameid factice -1 pour signaler "pas un vrai geonameid GeoNames"
  // (le backend ne s'en sert pas pour les calculs, il prend les coords directes).
  const initialSelectedCity =
    initialProfile?.birthCity &&
    initialProfile?.latitude !== undefined &&
    initialProfile?.longitude !== undefined &&
    initialProfile?.timezone
      ? {
          geonameid:   -1,
          name:        initialProfile.birthCity,
          countryCode: initialProfile.countryCode ?? "",
          admin1Name:  initialProfile.admin1Name ?? "",
          latitude:    initialProfile.latitude,
          longitude:   initialProfile.longitude,
          ianaTz:      initialProfile.timezone,
        }
      : null;

  const [form, setForm] = useState<FormState>({
    label:              initialProfile?.label              ?? "",
    birthDate:          initialProfile?.birthDate          ?? "",
    birthTime:          initialProfile?.birthTime          ?? "12:00",
    selectedCity:       initialSelectedCity,
    birthTimeUnknown:   initialProfile?.birthTimeUnknown   ?? false,
    gender:             (initialProfile?.gender ?? "unspecified") as GenderValue,
    relationshipStatus: (initialProfile?.relationshipStatus ?? "unspecified") as RelationshipValue,
  });
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      setSuccessMsg(null);

      if (!form.selectedCity) {
        throw new Error(
          locale === "fr"
            ? "Sélectionne une ville dans la liste de suggestions."
            : "Please select a city from the suggestions list.",
        );
      }

      const c = form.selectedCity;
      const payload = {
        label:              form.label,
        birthDate:          form.birthDate,
        birthTime:          form.birthTimeUnknown ? "12:00" : form.birthTime,
        birthTimeUnknown:   form.birthTimeUnknown ?? false,
        latitude:           c.latitude,
        longitude:          c.longitude,
        timezone:           c.ianaTz,
        birthCity:          c.name,
        birthCountry:       c.countryCode,
        gender:             form.gender,
        relationshipStatus: form.relationshipStatus,
      };

      try {
        const res = isEdit && initialProfile?.id
          ? await natalApi.update(accessToken!, initialProfile.id, payload)
          : await natalApi.create(accessToken!, payload);
        return res;
      } catch (err: any) {
        const code = err?.response?.data?.error?.code;
        if (code === "CITY_NOT_FOUND") {
          throw new Error(
            locale === "fr"
              ? "Ville inconnue côté serveur. Réessaie en tapant le nom dans le champ."
              : "Unknown city on server. Please retype it in the field.",
          );
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      // NATAL-FORM-CONTRACT-V1 : tous les callers utilisent queryKey ["natal"],
      // pas ["natal-list"] qui n'existait nulle part — invalidation cassée.
      qc.invalidateQueries({ queryKey: ["natal"] });
      // TOASTER-WIRING-V1 : feedback utilisateur via toast (success).
      toast(locale === "fr" ? "Profil enregistré ✨" : "Profile saved ✨", "success");
      setSuccessMsg(locale === "fr" ? "Profil enregistré ✨" : "Profile saved ✨");
      // Extrait le profile de la response { success: true, data: { profile } }
      // pour que onSuccess(profile) corresponde au contrat typé.
      const profile = (data as any)?.data?.profile;
      if (onSuccess && profile) {
        onSuccess(profile);
      } else if (!onSuccess) {
        setTimeout(() => router.push("/dashboard"), 600);
      }
    },
    onError: (err: any) => {
      setErrorMsg(err?.message ?? (locale === "fr" ? "Erreur" : "Error"));
    },
  });

  // Validation simple des champs requis
  const canSubmit =
    form.label.trim().length > 0 &&
    form.birthDate.length === 10 &&
    !!form.selectedCity;

  // ──────────────────────────────────────────────────────────
  // Rendu
  // ──────────────────────────────────────────────────────────

  return (
    <div className="card" style={{ maxWidth: 600, margin: "0 auto" }}>
      {!hideHeader && (
        <header style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>
            {isEdit
              ? (locale === "fr" ? "Modifier le profil natal" : "Edit natal profile")
              : (locale === "fr" ? "Créer un profil natal" : "Create natal profile")}
          </h2>
          <p style={{ margin: "4px 0 0", opacity: 0.9 }}>
            {locale === "fr"
              ? "Renseigne les informations de naissance pour calculer le thème astral."
              : "Fill in birth information to compute the natal chart."}
          </p>
        </header>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div>
          <label className="form-label">{t("natal_name")}</label>
          <input
            type="text"
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder={locale === "fr" ? "Mon thème" : "My chart"}
            maxLength={50}
          />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="form-label">{t("natal_birthdate")}</label>
            <input
              type="date"
              value={form.birthDate}
              onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="form-label">
              {t("natal_birthtime")}
              {" "}
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                ({locale === "fr" ? "locale" : "local"})
              </span>
            </label>
            <input
              type="time"
              value={form.birthTime}
              onChange={e => setForm(f => ({ ...f, birthTime: e.target.value }))}
              disabled={form.birthTimeUnknown}
              style={{ opacity: form.birthTimeUnknown ? 0.4 : 1 }}
            />
            <label style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, marginTop: 4, opacity: 0.85, cursor: "pointer",
            }}>
              <input
                type="checkbox"
                checked={!!form.birthTimeUnknown}
                onChange={e => setForm(f => ({ ...f, birthTimeUnknown: e.target.checked }))}
              />
              {locale === "fr" ? "Heure inconnue" : "Time unknown"}
            </label>
            {form.birthTimeUnknown && (
              <p style={{
                margin: "4px 0 0", fontSize: 11,
                color: "var(--gold)", opacity: 0.85,
              }}>
                {locale === "fr"
                  ? "L'Ascendant, le MC et les maisons seront approximatifs."
                  : "Ascendant, MC and houses will be approximate."}
              </p>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <CityAutocomplete
              label={t("natal_city")}
              placeholder={locale === "fr" ? "Commence à taper…" : "Start typing…"}
              locale={locale === "en" ? "en" : "fr"}
              value={form.selectedCity}
              onChange={(city) => setForm(f => ({ ...f, selectedCity: city }))}
              required
            />
            {isEdit && initialProfile?.birthCity && !form.selectedCity && (
              <p style={{
                margin: "4px 0 0", fontSize: 11, color: "var(--muted)",
              }}>
                {locale === "fr"
                  ? `Profil actuel : ${initialProfile.birthCity}. Retape pour resélectionner.`
                  : `Current profile: ${initialProfile.birthCity}. Retype to reselect.`}
              </p>
            )}
          </div>
        </div>

        <SegmentedField<GenderValue>
          label={locale === "fr" ? "Genre" : "Gender"}
          value={(form.gender ?? "unspecified") as GenderValue}
          onChange={v => setForm(f => ({ ...f, gender: v }))}
          options={[
            { value: "male",        label: locale === "fr" ? "Homme"       : "Male" },
            { value: "female",      label: locale === "fr" ? "Femme"       : "Female" },
            { value: "unspecified", label: locale === "fr" ? "Non précisé" : "Unspecified" },
          ]}
        />

        <SegmentedField<RelationshipValue>
          label={locale === "fr" ? "Situation amoureuse" : "Relationship"}
          value={(form.relationshipStatus ?? "unspecified") as RelationshipValue}
          onChange={v => setForm(f => ({ ...f, relationshipStatus: v }))}
          options={[
            { value: "single",      label: locale === "fr" ? "Célibataire" : "Single" },
            { value: "couple",      label: locale === "fr" ? "En couple"   : "In couple" },
            { value: "unspecified", label: locale === "fr" ? "Non précisé" : "Unspecified" },
          ]}
        />

        {errorMsg && (
          <div className="alert-banner" style={{
            background: "rgba(229, 69, 69, 0.08)",
            border: "1px solid rgba(229, 69, 69, 0.25)",
            color: "#ff8a8a",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 13,
          }}>
            {errorMsg}
          </div>
        )}

        {/* TOASTER-WIRING-V1 : successMsg affiché via toast (cf. mutation.onSuccess) */}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-ghost"
              style={{ flex: "0 0 auto" }}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit || mutation.isPending}
            className="btn-ob"
            style={{ flex: 1 }}
          >
            {mutation.isPending
              ? (locale === "fr" ? "Enregistrement…" : "Saving…")
              : isEdit
                ? (locale === "fr" ? "Mettre à jour" : "Update")
                : (locale === "fr" ? "Créer le profil" : "Create profile")}
          </button>
        </div>
      </form>
    </div>
  );
}

// NATAL-FORM-CONTRACT-V1 applied

// NATAL-FORM-UX-POLISH-V1 applied

// LINT-CSS-CLEANUP-V1 applied

// CI-DEBT-PURGE-V1-D applied

// TOASTER-WIRING-V1 applied

"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, apiClient, TierError } from "@/lib/api/client";
import { CityAutocomplete, type CityValue } from "@/components/natal/CityAutocomplete";
import { useT, useApp } from "@/lib/i18n";
import { useRouter, useSearchParams } from "next/navigation";
// RWS-TAROT-V1 import
import TarotCardImage from "@/components/tarot/TarotCardImage";
// PAYWALL-FRONT-V2 : indicateurs de quota visibles sur Tarot/Compat
import { QuotaIndicator } from "@/components/tiers/QuotaIndicator";
// TAROT-PERSISTENCE-V1 : sauvegarde des tirages de tarot
import { useTiers } from "@/hooks/useTiers";
import { SaveTarotButton } from "@/components/tarot/SaveTarotButton";
import { TarotDrawer } from "@/components/tarot/TarotDrawer";
import { TarotDrawerToggle } from "@/components/tarot/TarotDrawerToggle";
import { TarotQuotaIndicator } from "@/components/tarot/TarotQuotaIndicator";
// AUDIT-UX-GLOSSARY-V1 : données du glossaire partagées avec GlossaryPanel
import { GLOSSARY } from "@/lib/astro/glossary";

type Tab = "compat" | "tarot" | "learn";

export default function ExplorePage() {
  // PATCH-MENU-NAV-V1 + HOTFIX-MENU-NAV-TAB-SYNC : l'URL est la source de
  // vérité. On dérive `tab` directement du query param et on met à jour
  // l'URL via router.replace quand l'utilisateur clique. Évite le cycle
  // useEffect → setTab → setState-in-effect.
  const searchParams = useSearchParams();
  const router       = useRouter();
  const t            = useT();

  const rawTab = searchParams.get("tab");
  const tab: Tab = rawTab === "tarot" || rawTab === "compat" || rawTab === "learn"
    ? rawTab
    : "compat";

  const setTab = (next: Tab) => {
    router.replace(`?tab=${next}`, { scroll: false });
  };

  return (
    <div className="page-root">
      <div className="explore-nav">
        {(["compat", "tarot", "learn"] as Tab[]).map(k => (
          <button
            key={k}
            className={`subnav-tab${tab === k ? " active" : ""}`}
            onClick={() => setTab(k)}
          >
            {k === "compat" ? t("tab_compat") : k === "tarot" ? t("tab_tarot") : t("tab_glossary")}
          </button>
        ))}
      </div>

      {tab === "compat" && <CompatTab />}
      {tab === "tarot"  && <TarotTab />}
      {tab === "learn"  && <GlossaryTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// COMPAT — Synastrie (V1)
// >>> COMPAT_TAB_V1_MARKER <<<
// ══════════════════════════════════════════════════════════
function CompatTab() {
  const { accessToken, refreshTiers } = useAuth();
  const { locale } = useApp();
  const t = useT();
  const qc = useQueryClient();

  // Mode sélectionné
  type Mode = "adhoc" | "mixed" | "saved";
  const [mode, setMode] = useState<Mode>("adhoc");

  // État des formulaires
  // COMPAT-BIRTHTIME-CHECKBOX-V1 : ajout birthTimeUnknown pour permettre à
  // l'utilisateur de déclarer explicitement qu'il ne connaît pas son heure
  // de naissance (cohérent avec le pattern NatalForm).
  const emptyAdhoc = { label: "", birthDate: "", birthTime: "", birthTimeUnknown: false, selectedCity: null as CityValue | null };
  const [formA, setFormA]       = useState({ ...emptyAdhoc });
  const [formB, setFormB]       = useState({ ...emptyAdhoc });
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [savedPartnerId, setSavedPartnerId] = useState<string | null>(null);

  // Profils natals (utile pour les modes mixed et saved)
  const { data: profilesRes } = useQuery({
    queryKey: ["natal"],
    queryFn:  () => natalApi.list(accessToken!),
    enabled:  !!accessToken,
  });
  const profiles = useMemo(
    () => (profilesRes as any)?.data?.profiles ?? [],
    [profilesRes],
  );

  // Auto-sélection : 1er profil pour la slot A, 2e pour la slot B en mode saved.
  // Dérivés pendant le render plutôt que via un useEffect (évite setState-in-effect).
  // L'utilisateur peut overrider en changeant le <select>.
  const effectiveSelectedA: string = selectedA || (profiles[0]?.id ?? "");
  const effectiveSelectedB: string =
    selectedB || (mode === "saved" ? (profiles[1]?.id ?? "") : "");

  // Mutation principale : synastrie
  const analyzeMutation = useMutation({
    onSuccess: () => {
      // PAYWALL-FRONT-V2 : décrémente le compteur synastry.monthly affiché.
      refreshTiers();
    },
    mutationFn: async () => {
      const body: any = { locale };

      // partnerA
      if (mode === "adhoc") {
        if (!formA.label || !formA.birthDate || !formA.selectedCity) {
          throw new Error(locale === "fr"
            ? "Renseigne au minimum prénom, date et ville pour la personne A."
            : "Fill in at least name, date and city for person A.");
        }
        body.partnerA = {
          type:      "adhoc",
          label:     formA.label,
          birthDate: formA.birthDate,
          birthCity: formA.selectedCity.name,
          // COMPAT-CITY-COORDS-V1 : envoyer les coords pour bypasser la liste
          // ephemeris hardcodée (qui ne connaît pas Orléans, etc.)
          birthCoords: {
            latitude:  formA.selectedCity.latitude,
            longitude: formA.selectedCity.longitude,
            ianaTz:    formA.selectedCity.ianaTz,
          },
          // COMPAT-BIRTHTIME-CHECKBOX-V1 : ne pas envoyer birthTime si la case
          // "Heure inconnue" est cochée. Backend infère birthTimeKnown via !!ref.birthTime.
          ...((formA.birthTime && !formA.birthTimeUnknown) ? { birthTime: formA.birthTime } : {}),
        };
      } else {
        if (!effectiveSelectedA) throw new Error(locale === "fr" ? "Sélectionne ton profil." : "Select your profile.");
        body.partnerA = { type: "saved", natalId: effectiveSelectedA };
      }

      // partnerB
      if (mode === "saved") {
        if (!effectiveSelectedB) throw new Error(locale === "fr" ? "Sélectionne un 2e profil." : "Select a 2nd profile.");
        body.partnerB = { type: "saved", natalId: effectiveSelectedB };
      } else {
        if (!formB.label || !formB.birthDate || !formB.selectedCity) {
          throw new Error(locale === "fr"
            ? "Renseigne au minimum prénom, date et ville pour la personne B."
            : "Fill in at least name, date and city for person B.");
        }
        body.partnerB = {
          type:      "adhoc",
          label:     formB.label,
          birthDate: formB.birthDate,
          birthCity: formB.selectedCity.name,
          // COMPAT-CITY-COORDS-V1 : envoyer les coords pour bypasser la liste
          // ephemeris hardcodée (qui ne connaît pas Orléans, etc.)
          birthCoords: {
            latitude:  formB.selectedCity.latitude,
            longitude: formB.selectedCity.longitude,
            ianaTz:    formB.selectedCity.ianaTz,
          },
          // COMPAT-BIRTHTIME-CHECKBOX-V1 : ne pas envoyer birthTime si la case
          // "Heure inconnue" est cochée. Backend infère birthTimeKnown via !!ref.birthTime.
          ...((formB.birthTime && !formB.birthTimeUnknown) ? { birthTime: formB.birthTime } : {}),
        };
      }

      return apiClient.post("/compat/analyze", body, accessToken!);
    },
  });

  const result = (analyzeMutation.data as any)?.data;

  // Mutation de sauvegarde du profil partenaire ad-hoc (Mode A ou mixed)
  const savePartnerMutation = useMutation({
    mutationFn: async () => {
      const city = formB.selectedCity;
      if (!city) throw new Error("City not selected");
      // COMPAT-BIRTHTIME-CHECKBOX-V1 : utiliser le flag explicite plutôt que
      // d'inférer "unknown = champ vide" (mêmes comportements quand l'user n'a
      // pas coché et n'a rien rempli, mais permet aussi de gérer le cas où il
      // a coché ET tapé une heure — la case prime).
      const isTimeUnknown = formB.birthTimeUnknown || !formB.birthTime;
      const payload = {
        label:              formB.label,
        birthDate:          formB.birthDate,
        birthTime:          isTimeUnknown ? "12:00" : formB.birthTime,
        birthTimeUnknown:   isTimeUnknown,
        latitude:           city.latitude,
        longitude:          city.longitude,
        timezone:           city.ianaTz,
        birthCity:          city.name,
        birthCountry:       city.countryCode,
        gender:             "unspecified" as const,
        relationshipStatus: "unspecified" as const,
      };
      return natalApi.create(accessToken!, payload);
    },
    onSuccess: (res: any) => {
      const id = res?.data?.profile?.id ?? res?.data?.id ?? null;
      setSavedPartnerId(id);
      qc.invalidateQueries({ queryKey: ["natal"] });
    },
  });

  const canSavePartner =
    (mode === "adhoc" || mode === "mixed") &&
    !!result &&
    !savedPartnerId &&
    !!formB.label &&
    !!formB.birthDate &&
    !!formB.selectedCity;

  // Affichage des dimensions (couleurs + labels)
  // CI-DEBT-PURGE-V1-D : typage strict (result est any → keyof = symbol|number|string,
  // incompatible avec React Key). Union literal aligné sur les 6 valeurs réelles.
  type DimKey = "love" | "communication" | "intimacy" | "stability" | "growth" | "challenges";
  const DIMS: Array<{ key: DimKey; labelFr: string; labelEn: string; color: string; inverted?: boolean }> = [
    { key: "love",          labelFr: "Amour",         labelEn: "Love",          color: "#e879a8" },
    { key: "communication", labelFr: "Communication", labelEn: "Communication", color: "#60a5fa" },
    { key: "intimacy",      labelFr: "Intimité",      labelEn: "Intimacy",      color: "#a78bfa" },
    { key: "stability",     labelFr: "Stabilité",     labelEn: "Stability",     color: "#34d399" },
    { key: "growth",        labelFr: "Croissance",    labelEn: "Growth",        color: "#d4a843" },
    { key: "challenges",    labelFr: "Frictions",     labelEn: "Frictions",     color: "#f87171", inverted: true },
  ];

  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="animate-fade-up">
      <div className="section-title">{t("compat_title")}</div>

      {/* Sélecteur de mode */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "var(--bg-raised)", padding: 4, borderRadius: "var(--r-md)" }}>
        {([
          { k: "adhoc",  labelFr: "Saisie libre",      labelEn: "Free input" },
          { k: "mixed",  labelFr: "Moi + autre",       labelEn: "Me + other" },
          { k: "saved",  labelFr: "Deux profils",      labelEn: "Two profiles" },
        ] as const).map(opt => (
          <button
            key={opt.k}
            onClick={() => setMode(opt.k as Mode)}
            disabled={opt.k !== "adhoc" && profiles.length === 0}
            className={`subnav-tab${mode === opt.k ? " active" : ""}`}
            style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
          >
            {locale === "en" ? opt.labelEn : opt.labelFr}
          </button>
        ))}
      </div>

      {mode !== "adhoc" && profiles.length === 0 && (
        <div className="alert-banner" style={{ marginBottom: 12 }}>
          <span className="ab-ico">ℹ</span>
          <span>{locale === "fr"
            ? "Tu dois d'abord créer un profil natal (onglet Thème)."
            : "Create a natal profile first (Theme tab)."}</span>
        </div>
      )}

      {/* Formulaires selon le mode */}
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {/* PARTENAIRE A */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            {locale === "fr" ? "Personne A" : "Person A"}
          </div>
          {mode === "adhoc" ? (
            <AdhocFields form={formA} setForm={setFormA} locale={locale} />
          ) : (
            <select
              value={effectiveSelectedA}
              onChange={e => setSelectedA(e.target.value)}
              style={{ width: "100%" }}
            >
              {profiles.map((p: any) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* PARTENAIRE B */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            {locale === "fr" ? "Personne B" : "Person B"}
          </div>
          {mode === "saved" ? (
            <select
              value={effectiveSelectedB}
              onChange={e => setSelectedB(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">{locale === "fr" ? "— Choisir —" : "— Choose —"}</option>
              {profiles.filter((p: any) => p.id !== effectiveSelectedA).map((p: any) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          ) : (
            <AdhocFields form={formB} setForm={setFormB} locale={locale} />
          )}
        </div>
      </div>

      {/* Bouton analyser */}
      <button
        className="btn-ob"
        disabled={analyzeMutation.isPending}
        onClick={() => {
          setSavedPartnerId(null);
          analyzeMutation.mutate();
        }}
        style={{ width: "100%", marginBottom: 12 }}
      >
        {analyzeMutation.isPending
          ? (locale === "fr" ? "Kairos analyse… ✦" : "Kairos analyzing… ✦")
          : (locale === "fr" ? "Analyser la compatibilité ✦" : "Analyze compatibility ✦")}
      </button>

      {/* PAYWALL-FRONT-V2 : compteur de synastries restantes ce mois */}
      <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
        <QuotaIndicator feature="synastry.monthly" variant="compact" />
      </div>

      {/* Erreur éventuelle — PAYWALL-FRONT-V2 : on n'affiche pas le faux
          message d'erreur quand le block est paywall (modal déjà ouvert). */}
      {analyzeMutation.isError && !(analyzeMutation.error instanceof TierError) && (
        <div className="alert-banner" style={{ background: "rgba(229,69,69,.08)", borderColor: "rgba(229,69,69,.25)", color: "var(--tension)" }}>
          <span className="ab-ico">⚠</span>
          <span>{(analyzeMutation.error as any)?.message ?? (locale === "fr" ? "Erreur lors du calcul." : "Calculation error.")}</span>
        </div>
      )}

      {/* Résultat */}
      {result && (
        <div className="animate-fade-up" style={{ marginTop: 10 }}>
          {/* Hero score */}
          <div className="card card-gold" style={{ padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              {result.persons.A.label} &middot; {result.persons.B.label}
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--font-display)", lineHeight: 1 }}>
              {result.global}%
            </div>
            {result.meta.cached && (
              <div style={{ fontSize: 9, color: "var(--muted-2)", marginTop: 4 }}>
                {locale === "fr" ? "résultat en cache" : "cached"}
              </div>
            )}
          </div>

          {/* Avertissement dégradation */}
          {result.meta.degraded && (
            <div className="alert-banner" style={{ marginTop: 10, background: "rgba(229,180,69,0.08)", borderColor: "rgba(229,180,69,0.25)", color: "var(--gold)" }}>
              <span className="ab-ico">⚠</span>
              <span>{locale === "fr"
                ? `Analyse partielle — heure de naissance inconnue ${
                    result.meta.reason === "A_time_unknown" ? `pour ${result.persons.A.label}` :
                    result.meta.reason === "B_time_unknown" ? `pour ${result.persons.B.label}` :
                    "pour les deux personnes"
                  }. La Lune est exclue du scoring. L'analyse reste fiable sur les planètes lentes.`
                : `Partial analysis — birth time unknown ${
                    result.meta.reason === "A_time_unknown" ? `for ${result.persons.A.label}` :
                    result.meta.reason === "B_time_unknown" ? `for ${result.persons.B.label}` :
                    "for both persons"
                  }. Moon excluded from scoring. Slower planets remain reliable.`
              }</span>
            </div>
          )}

          {/* Oracle */}
          {result.ai.oracle && (
            <div className="oracle" style={{ marginTop: 14 }}>« {result.ai.oracle} »</div>
          )}

          {/* Résumé */}
          {result.ai.summary && (
            <p style={{ fontSize: 13, lineHeight: 1.65, marginTop: 10, textAlign: "center", color: "var(--star)" }}>
              {result.ai.summary}
            </p>
          )}

          {/* 6 barres de dimensions */}
          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            {DIMS.map(dim => {
              const value = result.dimensions[dim.key] as number;
              const displayValue = dim.inverted ? value : value;
              return (
                <div key={dim.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--star)" }}>
                      {locale === "en" ? dim.labelEn : dim.labelFr}
                    </span>
                    <span style={{ fontSize: 11, color: dim.color, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {displayValue}%
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "var(--bg-raised)", overflow: "hidden" }}>
                    <div style={{
                      width: `${displayValue}%`,
                      height: "100%",
                      background: dim.color,
                      opacity: 0.85,
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                  {result.ai.dimensions?.[dim.key] && (
                    <p style={{ fontSize: 12, lineHeight: 1.55, marginTop: 6, color: "var(--muted)" }}>
                      {result.ai.dimensions[dim.key]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chemistry keys */}
          {result.ai.chemistry_keys?.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ color: "var(--harmony)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                {locale === "fr" ? "♡ Clés de chimie" : "♡ Chemistry keys"}
              </div>
              <ul style={{ listStyle: "none", padding: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                {result.ai.chemistry_keys.map((k: string, i: number) => (
                  <li key={i} style={{ marginBottom: 4, paddingLeft: 12, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "var(--harmony)" }}>✦</span>
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Watch points */}
          {result.ai.watch_points?.length > 0 && (
            <div className="card" style={{ marginTop: 10 }}>
              <div style={{ color: "var(--tension)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                {locale === "fr" ? "⚠ Points de vigilance" : "⚠ Watch points"}
              </div>
              <ul style={{ listStyle: "none", padding: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                {result.ai.watch_points.map((w: string, i: number) => (
                  <li key={i} style={{ marginBottom: 4, paddingLeft: 12, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "var(--tension)" }}>△</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Advice */}
          {result.ai.advice && (
            <div className="card card-gold" style={{ marginTop: 10, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                {locale === "fr" ? "Conseil" : "Advice"}
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 13, lineHeight: 1.6, color: "var(--star)" }}>
                {result.ai.advice}
              </p>
            </div>
          )}

          {/* Sauvegarder profil partenaire (mode adhoc/mixed uniquement) */}
          {canSavePartner && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button
                className="btn-ghost"
                disabled={savePartnerMutation.isPending}
                onClick={() => savePartnerMutation.mutate()}
              >
                {savePartnerMutation.isPending
                  ? (locale === "fr" ? "Sauvegarde…" : "Saving…")
                  : (locale === "fr"
                      ? `+ Sauvegarder ${formB.label || "ce profil"} dans mes profils`
                      : `+ Save ${formB.label || "this profile"} to my profiles`)}
              </button>
            </div>
          )}
          {savedPartnerId && (
            <div style={{ marginTop: 10, textAlign: "center", color: "var(--harmony)", fontSize: 12 }}>
              ✓ {locale === "fr" ? "Profil sauvegardé" : "Profile saved"}
            </div>
          )}

          {/* Détails des aspects — collapsible */}
          {result.aspects?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button
                className="btn-ghost"
                onClick={() => setDetailsOpen(o => !o)}
                style={{ width: "100%", fontSize: 12 }}
              >
                {detailsOpen ? "▲" : "▼"} {locale === "fr"
                  ? `Détails astrologiques (${result.aspects.length} aspects)`
                  : `Astrological details (${result.aspects.length} aspects)`}
              </button>
              {detailsOpen && (
                <div className="card" style={{ marginTop: 8, padding: 10 }}>
                  <div style={{ display: "grid", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                    {result.aspects.map((a: any, i: number) => {
                      const sym = a.type === "conjunction" ? "☌" : a.type === "sextile" ? "⚹" : a.type === "square" ? "□" : a.type === "trine" ? "△" : a.type === "opposition" ? "☍" : a.type === "quincunx" ? "⚻" : "·";
                      const toneColor = a.tone === "h" ? "var(--harmony)" : a.tone === "t" ? "var(--tension)" : "var(--gold)";
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: i < result.aspects.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
                          <span><span style={{ color: toneColor }}>{sym}</span> {a.planetA} {a.type} {a.planetB}</span>
                          <span style={{ color: "var(--muted)" }}>orbe {a.orb}°</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sous-composant pour les champs ad-hoc ───────────────
// COMPAT-BIRTHTIME-CHECKBOX-V1 : type form étendu avec birthTimeUnknown
type AdhocFormState = {
  label:            string;
  birthDate:        string;
  birthTime:        string;
  birthTimeUnknown: boolean;
  selectedCity:     CityValue | null;
};

function AdhocFields({
  form, setForm, locale,
}: {
  form: AdhocFormState;
  setForm: React.Dispatch<React.SetStateAction<AdhocFormState>>;
  locale: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input
        type="text"
        placeholder={locale === "fr" ? "Prénom" : "Name"}
        value={form.label}
        onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
        style={{ width: "100%" }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input
          type="date"
          value={form.birthDate}
          onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
          min="1900-01-01" max="2100-12-31"
        />
        <input
          type="time"
          placeholder={locale === "fr" ? "Heure (optionnelle)" : "Time (optional)"}
          value={form.birthTime}
          onChange={e => setForm(f => ({ ...f, birthTime: e.target.value }))}
          disabled={form.birthTimeUnknown}
          style={{ opacity: form.birthTimeUnknown ? 0.4 : 1 }}
        />
      </div>
      {/* COMPAT-BIRTHTIME-CHECKBOX-V1 : case à cocher "Heure inconnue" cohérente avec NatalForm */}
      <label style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, marginTop: -2, opacity: 0.85, cursor: "pointer",
      }}>
        <input
          type="checkbox"
          checked={!!form.birthTimeUnknown}
          onChange={e => setForm(f => ({ ...f, birthTimeUnknown: e.target.checked }))}
        />
        {locale === "fr" ? "Heure inconnue" : "Time unknown"}
      </label>
      <CityAutocomplete
        value={form.selectedCity}
        onChange={(city) => setForm(f => ({ ...f, selectedCity: city }))}
        locale={locale === "en" ? "en" : "fr"}
        placeholder={locale === "fr" ? "Ville de naissance" : "Birth city"}
        required
      />
      {form.birthTimeUnknown && (
        <div style={{ fontSize: 11, color: "var(--gold)", opacity: 0.85, fontStyle: "italic" }}>
          {locale === "fr"
            ? "L'Ascendant, le MC, les maisons et la position fine de la Lune seront approximatifs."
            : "Ascendant, MC, houses and fine Moon position will be approximate."}
        </div>
      )}
      {!form.birthTime && !form.birthTimeUnknown && (
        <div style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>
          {locale === "fr"
            ? "Sans heure : coche la case ci-dessus pour confirmer (sinon l'analyse sera moins précise)."
            : "No time set: tick the box above to confirm (otherwise analysis will be less precise)."}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAROT avec IA
// ══════════════════════════════════════════════════════════

const CARD_ARTS: Record<number, { bg1: string; bg2: string; accent: string; pattern: string }> = {
  0:  { bg1: "#1a0a2e", bg2: "#3d1160", accent: "#e879a8", pattern: "infinity" },
  1:  { bg1: "#0a1628", bg2: "#1e3a5f", accent: "#c9a84c", pattern: "sun" },
  2:  { bg1: "#0d1b3e", bg2: "#1a2f6e", accent: "#818cf8", pattern: "moon" },
  3:  { bg1: "#0d2a14", bg2: "#1a4a26", accent: "#3ecf8e", pattern: "crown" },
  4:  { bg1: "#2a0d0d", bg2: "#4a1a1a", accent: "#f87171", pattern: "diamond" },
  5:  { bg1: "#1a1228", bg2: "#2e1f4a", accent: "#a78bfa", pattern: "cross" },
  6:  { bg1: "#2a0d1e", bg2: "#4a1a3a", accent: "#f472b6", pattern: "heart" },
  7:  { bg1: "#1a0a0a", bg2: "#3d1818", accent: "#ef4444", pattern: "sword" },
  8:  { bg1: "#0a0a1a", bg2: "#1a1a3d", accent: "#c9a84c", pattern: "eye" },
  9:  { bg1: "#0a0d1a", bg2: "#161b3d", accent: "#e2e8f0", pattern: "lantern" },
  10: { bg1: "#0a1a1a", bg2: "#1a3d3d", accent: "#34d399", pattern: "wheel" },
  11: { bg1: "#1a0a0a", bg2: "#3d1a1a", accent: "#f87171", pattern: "fire" },
  12: { bg1: "#0a0a2a", bg2: "#1a1a4a", accent: "#818cf8", pattern: "hang" },
  13: { bg1: "#050510", bg2: "#0f0f2a", accent: "#6366f1", pattern: "spiral" },
  14: { bg1: "#0a1a2a", bg2: "#1a3d4a", accent: "#67e8f9", pattern: "wave" },
  15: { bg1: "#1a0505", bg2: "#350a0a", accent: "#dc2626", pattern: "snake" },
  16: { bg1: "#050505", bg2: "#1a0a1a", accent: "#fbbf24", pattern: "bolt" },
  17: { bg1: "#050a1a", bg2: "#0a1a3d", accent: "#60a5fa", pattern: "star" },
  18: { bg1: "#050514", bg2: "#0d0d2e", accent: "#818cf8", pattern: "moon" },
  19: { bg1: "#1a0a00", bg2: "#3d1e00", accent: "#f59e0b", pattern: "sun" },
  20: { bg1: "#0a0a1a", bg2: "#1a1a3d", accent: "#a78bfa", pattern: "trumpet" },
  21: { bg1: "#0a1a0a", bg2: "#1a3d1a", accent: "#3ecf8e", pattern: "lotus" },
};

function CardArt({ cardNum, size = 95 }: { cardNum: number; size?: number }) {
  const art = CARD_ARTS[cardNum] ?? CARD_ARTS[0]!;
  const w = size, h = Math.round(size * 1.55);
  const cx = w / 2, cy = h / 2;
  const accent = art.accent;
  const alpha = accent + "33";

  // Simplification : on ne met que quelques patterns représentatifs
  const renderPattern = () => {
    switch (art.pattern) {
      case "sun": return (
        <g>
          <circle cx={cx} cy={cy} r={h*.2} fill="none" stroke={accent} strokeWidth="1.5" opacity=".6" />
          {Array.from({length:8},(_,i)=>{const a=(i*45)*Math.PI/180;return <line key={i} x1={cx+h*.13*Math.cos(a)} y1={cy+h*.13*Math.sin(a)} x2={cx+h*.22*Math.cos(a)} y2={cy+h*.22*Math.sin(a)} stroke={accent} strokeWidth="1.4" opacity=".7"/>;})}
        </g>);
      case "moon": return <><circle cx={cx-3} cy={cy} r={h*.18} fill="none" stroke={accent} strokeWidth="1.5" opacity=".6"/><circle cx={cx+5} cy={cy-3} r={h*.12} fill={art.bg2}/></>;
      case "star": return <g>{Array.from({length:5},(_,i)=>{const a=(i*72-90)*Math.PI/180;return <circle key={i} cx={cx+h*.19*Math.cos(a)} cy={cy+h*.19*Math.sin(a)} r="3" fill={accent}/>;})}<text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="16" fill={accent}>✦</text></g>;
      case "eye": return <><ellipse cx={cx} cy={cy} rx={h*.2} ry={h*.11} fill="none" stroke={accent} strokeWidth="1.4"/><circle cx={cx} cy={cy} r={h*.06} fill={accent+"55"}/><circle cx={cx} cy={cy} r={h*.025} fill={accent}/></>;
      case "heart": return <path d={`M ${cx} ${cy+14} C ${cx-20} ${cy-6} ${cx-16} ${cy-22} ${cx} ${cy-10} C ${cx+16} ${cy-22} ${cx+20} ${cy-6} ${cx} ${cy+14} Z`} fill={alpha} stroke={accent} strokeWidth="1.3"/>;
      case "sword": return <g><line x1={cx} y1={cy-25} x2={cx} y2={cy+22} stroke={accent} strokeWidth="2"/><line x1={cx-13} y1={cy-4} x2={cx+13} y2={cy-4} stroke={accent} strokeWidth="1.5"/></g>;
      case "wheel": return <g><circle cx={cx} cy={cy} r={h*.2} fill="none" stroke={accent} strokeWidth="1.4"/><circle cx={cx} cy={cy} r={h*.07} fill="none" stroke={accent} strokeWidth="1.2"/>{Array.from({length:8},(_,i)=>{const a=(i*45)*Math.PI/180;return <line key={i} x1={cx+h*.07*Math.cos(a)} y1={cy+h*.07*Math.sin(a)} x2={cx+h*.2*Math.cos(a)} y2={cy+h*.2*Math.sin(a)} stroke={accent} strokeWidth="1"/>;})}</g>;
      case "diamond": return <polygon points={`${cx},${cy-h*.2} ${cx+w*.22},${cy} ${cx},${cy+h*.2} ${cx-w*.22},${cy}`} fill="none" stroke={accent} strokeWidth="1.5"/>;
      case "crown": return <path d={`M ${cx-20} ${cy+8} L ${cx-20} ${cy-10} L ${cx-10} ${cy-20} L ${cx} ${cy-10} L ${cx+10} ${cy-20} L ${cx+20} ${cy-10} L ${cx+20} ${cy+8} Z`} fill="none" stroke={accent} strokeWidth="1.4"/>;
      case "bolt": return <polygon points={`${cx+8},${cy-26} ${cx-4},${cy-3} ${cx+6},${cy-3} ${cx-8},${cy+26} ${cx+4},${cy+3} ${cx-6},${cy+3}`} fill={alpha} stroke={accent} strokeWidth="1.2"/>;
      case "spiral": return <path d={`M ${cx} ${cy} Q ${cx+18} ${cy-26} ${cx+26} ${cy} Q ${cx+18} ${cy+35} ${cx} ${cy+26} Q ${cx-26} ${cy+17} ${cx-26} ${cy} Q ${cx-17} ${cy-35} ${cx+10} ${cy-35}`} fill="none" stroke={accent} strokeWidth="1.5"/>;
      case "infinity": return <path d={`M ${cx-8} ${cy} Q ${cx-26} ${cy-22} ${cx-16} ${cy} Q ${cx-26} ${cy+22} ${cx-8} ${cy} Q ${cx+8} ${cy-22} ${cx+16} ${cy} Q ${cx+26} ${cy+22} ${cx+8} ${cy}`} fill="none" stroke={accent} strokeWidth="1.8"/>;
      case "wave": return <g>{[0,8,16].map((oy,i)=><path key={i} d={`M ${cx-26} ${cy-8+oy} Q ${cx-13} ${cy-18+oy} ${cx} ${cy-8+oy} Q ${cx+13} ${cy+oy} ${cx+26} ${cy-8+oy}`} fill="none" stroke={accent} strokeWidth="1.4" opacity={.75-i*.2}/>)}</g>;
      case "fire": return <g>{[-6,0,6].map((ox,i)=><path key={i} d={`M ${cx+ox} ${cy+18} Q ${cx+ox+7} ${cy} ${cx+ox} ${cy-18} Q ${cx+ox-7} ${cy} ${cx+ox} ${cy+18}`} fill={alpha} stroke={accent} strokeWidth="1"/>)}</g>;
      case "cross": return <g><line x1={cx} y1={cy-20} x2={cx} y2={cy+20} stroke={accent} strokeWidth="2"/><line x1={cx-14} y1={cy-6} x2={cx+14} y2={cy-6} stroke={accent} strokeWidth="2"/></g>;
      case "snake": return <path d={`M ${cx-18} ${cy+18} Q ${cx-26} ${cy} ${cx} ${cy} Q ${cx+26} ${cy} ${cx+18} ${cy-18} Q ${cx+24} ${cy-26} ${cx+8} ${cy-26}`} fill="none" stroke={accent} strokeWidth="1.8"/>;
      case "hang": return <g><line x1={cx} y1={cy-22} x2={cx} y2={cy+22} stroke={accent} strokeWidth="1.8"/></g>;
      case "lantern": return <g><rect x={cx-11} y={cy-12} width={22} height={24} rx={3} fill="none" stroke={accent} strokeWidth="1.4"/><circle cx={cx} cy={cy} r="7" fill={alpha}/></g>;
      case "lotus": return <g>{[-45,-22,0,22,45].map((deg,i)=>{const a=deg*Math.PI/180;const r=22;return <path key={i} d={`M ${cx} ${cy+4} Q ${cx+r*Math.sin(a)*.5} ${cy+r*Math.cos(a)*-.5} ${cx+r*Math.sin(a)} ${cy-r*Math.cos(a)} Q ${cx+r*Math.sin(a)*.5-4*Math.cos(a)} ${cy-r*Math.cos(a)*.8} ${cx} ${cy+4}`} fill={alpha} stroke={accent} strokeWidth="1" opacity={.4+i*.06}/>;})}</g>;
      case "trumpet": return <path d={`M ${cx-20} ${cy} L ${cx+14} ${cy-10} L ${cx+20} ${cy-5} L ${cx+20} ${cy+5} L ${cx+14} ${cy+10} Z`} fill={alpha} stroke={accent} strokeWidth="1.3"/>;
      default: return <circle cx={cx} cy={cy} r={h*.18} fill="none" stroke={accent} strokeWidth="1.5"/>;
    }
  };

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`ca-${cardNum}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={art.bg1}/>
          <stop offset="100%" stopColor={art.bg2}/>
        </linearGradient>
      </defs>
      <rect width={w} height={h} rx="10" fill={`url(#ca-${cardNum})`}/>
      <rect x="3" y="3" width={w-6} height={h-6} rx="8" fill="none" stroke={accent} strokeWidth=".7" opacity=".35"/>
      {renderPattern()}
    </svg>
  );
}

interface AiTarotCard {
  position: string;
  card:     string;
  interpretation: string;
}
interface AiTarot {
  overview:  string;
  cards:     AiTarotCard[];
  synthesis: string;
}

function TarotTab() {
  // TAROT-PERSISTENCE-V1 : carte normalisée { num, name, position } —
  // gabarit commun au tirage frais et au tirage sauvegardé rechargé.
  interface DisplayCard { num: number; name: string; position: string; }

  const { accessToken, refreshTiers } = useAuth();
  const t = useT();
  const { locale } = useApp();
  const queryClient = useQueryClient();
  // TAROT-PERSISTENCE-V1 : tiers (paywall + isFree)
  const { isFree, openPaywall } = useTiers();

  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [aiInterp, setAiInterp] = useState<AiTarot | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // TAROT-QUESTION-V1 state
  const [question, setQuestion] = useState("");

  // TAROT-PERSISTENCE-V1 state :
  //  - loadedCards      : non-null quand on consulte un tirage sauvegardé rechargé
  //  - currentReadingId : id du tirage déjà sauvegardé (→ bouton save en mode ✓)
  //  - isDrawerOpen     : état du drawer "Mes tirages"
  const [loadedCards, setLoadedCards] = useState<DisplayCard[] | null>(null);
  const [currentReadingId, setCurrentReadingId] = useState<string | null>(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  // Premier profil natal (optionnel, pour enrichir la lecture)
  const { data: profilesRes } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });
  const profiles = (profilesRes as any)?.data?.profiles ?? [];
  const natalId = profiles[0]?.id ?? null;

  // TAROT-PERSISTENCE-V1 : quota de tirages sauvegardables
  const { data: saveQuotaRes } = useQuery({
    queryKey: ["tarot-save-quota"],
    queryFn: () =>
      apiClient.get<{ limit: number; current: number; canSave: boolean }>(
        "/tarot/readings/quota",
        accessToken!,
      ),
    enabled: !!accessToken,
  });
  const saveQuota = (saveQuotaRes as { data?: { limit: number; current: number; canSave: boolean } })?.data ?? null;

  const POSITIONS_FR = ["Passé", "Présent", "Futur"];
  const POSITIONS_EN = ["Past", "Present", "Future"];
  const positions = locale === "en" ? POSITIONS_EN : POSITIONS_FR;

  // Tirage : utilise l'API existante
  const drawMutation = useMutation({
    mutationFn: () => apiClient.post("/horoscope/tarot", { natalId }, accessToken!),
    onSuccess: () => {
      setRevealed(new Set());
      setAiInterp(null);
      setAiError(null);
      // TAROT-PERSISTENCE-V1 : un nouveau tirage repart à zéro côté sauvegarde
      setLoadedCards(null);
      setCurrentReadingId(null);
      // PAYWALL-FRONT-V2 : décrémente le compteur tarot.monthly affiché.
      refreshTiers();
    },
  });

  const drawn = (drawMutation.data as any)?.data;

  // TAROT-PERSISTENCE-V1 : les cartes affichées proviennent soit d'un tirage
  // sauvegardé rechargé (loadedCards), soit du tirage frais (drawMutation).
  // On normalise dans les deux cas vers { num, name, position }.
  // NB : /horoscope/tarot renvoie le nom de la carte dans le champ `card`
  // (et non `n`) — cf. routes/horoscope.ts → interpretation.map().
  const cards: DisplayCard[] = loadedCards ?? (
    (drawn?.interpretation ?? []) as Array<{ num: number; card: string; position?: string }>
  ).map((c, i) => ({
    num:      c.num,
    name:     c.card,
    position: c.position ?? positions[i] ?? `Carte ${i + 1}`,
  }));

  const toggleReveal = (i: number) => {
    setRevealed(prev => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  };

  const allRevealed = cards.length > 0 && revealed.size === cards.length;

  // TAROT-PERSISTENCE-V1 : recharge un tirage sauvegardé depuis le drawer.
  // Restaure cartes + question + interprétation IA, révèle toutes les cartes,
  // et marque le tirage comme déjà sauvegardé.
  const handleLoadReading = (reading: {
    readingId: string;
    data: { question?: string; cards: DisplayCard[]; ai?: unknown };
  }) => {
    const cs: DisplayCard[] = (reading.data.cards ?? []).map((c, i) => ({
      num:      c.num,
      name:     c.name,
      position: c.position ?? positions[i] ?? `Carte ${i + 1}`,
    }));
    setLoadedCards(cs);
    setQuestion(reading.data.question ?? "");
    setAiInterp((reading.data.ai as AiTarot | null) ?? null);
    setAiError(null);
    setRevealed(new Set(cs.map((_, i) => i)));  // tout révélé
    setCurrentReadingId(reading.readingId);
  };

  const requestAiInterpretation = async () => {
    if (cards.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const payload = {
        natalId,
        locale,
        // TAROT-QUESTION-V1 payload
        question: question.trim() || undefined,
        cards: cards.map((c) => ({
          num: c.num,
          name: c.name,
          position: c.position,
        })),
      };
      const res = await apiClient.post("/ai/tarot", payload, accessToken!);
      setAiInterp((res as any)?.data ?? null);
      // PAYWALL-FRONT-V2 : /ai/tarot ne consomme plus tarot.monthly côté
      // backend (le quota a déjà été décompté par /horoscope/tarot), donc
      // pas besoin de refreshTiers ici.
    } catch (err) {
      // PAYWALL-FRONT-V2 : le paywall modal est déjà ouvert via l'error-bus,
      // on n'affiche pas un faux message d'erreur en plus. (Le finally
      // s'occupe du setAiLoading(false).)
      if (err instanceof TierError) return;
      setAiError(
        locale === "en"
          ? "The reader rests. Try again in a moment."
          : "Le tarologue se repose. Réessayez dans un instant."
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="section-title">{t("tarot_title")}</div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", lineHeight: 1.55, marginBottom: 6 }}>
        {t("tarot_subtitle")}
      </p>
      <p style={{ fontSize: 9, color: "var(--muted-2)", textAlign: "center", marginBottom: 10 }}>
        {locale === "en" ? "22 major arcana · Upright only" : "22 arcanes majeurs · Cartes droites uniquement"}
      </p>
      {/* RWS-TAROT-V1 credits */}
      <p style={{ fontSize: 8, color: "var(--muted-2)", textAlign: "center", marginBottom: 10, opacity: 0.7 }}>
        {locale === "en"
          ? "Iconography: Pamela Colman Smith (1909) — public domain"
          : "Iconographie : Pamela Colman Smith (1909) — domaine public"}
      </p>

      {/* TAROT-PERSISTENCE-V1 : accès aux tirages sauvegardés */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <TarotDrawerToggle
          onClick={() => setDrawerOpen(true)}
          isOpen={isDrawerOpen}
          locale={locale}
        />
      </div>

      {/* PAYWALL-FRONT-V2 : compteur de tirages restants ce mois (visible avant et après tirage) */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <QuotaIndicator feature="tarot.monthly" variant="compact" />
      </div>

      {!drawn && !loadedCards && (
        <>
          {/* TAROT-QUESTION-V1 question field */}
          <div style={{ marginBottom: 12 }}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
              placeholder={
                locale === "en"
                  ? "Your question (optional, 200 chars max)…"
                  : "Ta question (facultatif, 200 caractères max)…"
              }
              maxLength={200}
              rows={2}
              style={{
                width: "100%",
                resize: "none",
                fontFamily: "inherit",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            />
            <div
              style={{
                fontSize: 9,
                color: "var(--muted-2)",
                textAlign: "right",
                marginTop: 2,
                fontFamily: "var(--font-mono)",
              }}
            >
              {question.length} / 200
            </div>
          </div>
          <button
            className="btn-ob"
            onClick={() => drawMutation.mutate()}
            disabled={drawMutation.isPending}
          >
            {drawMutation.isPending ? t("tarot_drawing") : t("tarot_draw")}
          </button>
        </>
      )}

      {cards.length > 0 && (
        <>
          {/* TAROT-PERSISTENCE-V1 : question rappelée au-dessus du tirage */}
          {question.trim() && (
            <p style={{
              fontSize: 12,
              fontStyle: "italic",
              color: "var(--muted)",
              textAlign: "center",
              marginBottom: 10,
              lineHeight: 1.5,
            }}>
              « {question.trim()} »
            </p>
          )}

          <div className="tarot-deck">
            {cards.map((c, i) => {
              const pos = c.position ?? positions[i] ?? "";
              const isRevealed = revealed.has(i);
              return (
                <div
                  key={i}
                  className={`tarot-card ${isRevealed ? "revealed" : "face-down"}`}
                  onClick={() => toggleReveal(i)}
                >
                  {isRevealed ? (
                    <>
                      <div className="tc-pos">{pos}</div>
                      <TarotCardImage num={c.num} alt={c.name} size={85} />
                    </>
                  ) : (
                    <div className="tc-pos">{pos}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* TAROT-PERSISTENCE-V1 : barre Sauvegarder + indicateur quota */}
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            gap:            10,
            marginTop:      12,
            flexWrap:       "wrap",
          }}>
            <SaveTarotButton
              cards={cards}
              question={question}
              ai={aiInterp}
              natalId={natalId}
              accessToken={accessToken}
              quota={saveQuota}
              isFree={isFree}
              isBusy={aiLoading || drawMutation.isPending}
              currentReadingId={currentReadingId}
              locale={locale}
              openPaywall={openPaywall}
              onSaved={(readingId) => {
                setCurrentReadingId(readingId);
                void queryClient.invalidateQueries({ queryKey: ["tarot-save-quota"] });
                void queryClient.invalidateQueries({ queryKey: ["tarot-readings"] });
              }}
            />
            <TarotQuotaIndicator
              quota={saveQuota}
              isFree={isFree}
              locale={locale}
              onUpgradeClick={() =>
                openPaywall({
                  feature: "tarot_save_count",
                  message: locale === "en"
                    ? "Upgrade to save more readings"
                    : "Passe à Essentiel ou Pro pour sauvegarder plus de tirages",
                })
              }
            />
          </div>

          {/* CTA IA : apparaît quand toutes les cartes sont retournées */}
          {allRevealed && !aiInterp && !aiLoading && !aiError && (
            <button className="btn-ob" onClick={requestAiInterpretation}>
              {/* PATCH-KAIROS-NAMING-AND-JPL-V1 : Grok → Kairos (label user-facing) */}
              {locale === "en" ? "Interpret with Kairos ✦" : "Interpréter avec Kairos ✦"}
            </button>
          )}

          {aiLoading && (
            <div className="flex-center" style={{ padding: 30 }}>
              <div className="spinner" />
            </div>
          )}

          {aiError && (
            <div className="alert-banner" style={{
              background: "rgba(229,69,69,.08)",
              borderColor: "rgba(229,69,69,.25)",
              color: "var(--tension)",
            }}>
              <span className="ab-ico">⚠</span>
              <span>
                {aiError}
                <button onClick={requestAiInterpretation} style={{
                  marginLeft: 8, textDecoration: "underline",
                  color: "inherit", background: "transparent",
                }}>
                  {locale === "en" ? "Retry" : "Réessayer"}
                </button>
              </span>
            </div>
          )}

          {/* Interprétation IA */}
          {aiInterp && (
            <>
              {aiInterp.overview && (
                <div className="tarot-interp animate-fade-up">
                  <div style={{
                    fontSize: 10, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
                  }}>
                    {locale === "en" ? "Overview" : "Synthèse"}
                  </div>
                  <p style={{ fontStyle: "italic" }}>{aiInterp.overview}</p>
                </div>
              )}

              {aiInterp.cards?.map((c, i) => (
                <div key={i} className="tarot-interp animate-fade-up" style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .5 }}>
                      {c.position}
                    </div>
                    <div style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: 14 }}>
                      · {c.card}
                    </div>
                  </div>
                  <p>{c.interpretation}</p>
                </div>
              ))}

              {aiInterp.synthesis && (
                <div className="card-gold card animate-fade-up" style={{ marginTop: 12, padding: 16 }}>
                  <div style={{
                    fontSize: 10, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: 1, marginBottom: 6,
                  }}>
                    {locale === "en" ? "Message" : "Message"}
                  </div>
                  <p style={{
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                    fontSize: 13.5, lineHeight: 1.6,
                    color: "var(--star)",
                  }}>
                    {aiInterp.synthesis}
                  </p>
                </div>
              )}
            </>
          )}

          <button
            className="btn-ghost"
            style={{ display: "block", margin: "14px auto 0" }}
            onClick={() => drawMutation.mutate()}
          >
            {t("tarot_redraw")}
          </button>
        </>
      )}

      {/* TAROT-PERSISTENCE-V1 : drawer "Mes tirages" */}
      <TarotDrawer
        isOpen={isDrawerOpen}
        accessToken={accessToken}
        locale={locale}
        onClose={() => setDrawerOpen(false)}
        onLoadReading={handleLoadReading}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// GLOSSARY
// AUDIT-UX-GLOSSARY-V1 : données déplacées dans lib/astro/glossary
// (partagées avec le panneau contextuel GlossaryPanel) ; l'onglet
// gagne au passage les catégories Maisons et Notions.
// ══════════════════════════════════════════════════════════
function GlossaryTab() {
  const [activeKey, setActiveKey] = useState<keyof typeof GLOSSARY>("Signes");
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="animate-fade-up">
      <div className="glossary-tabs">
        {(Object.keys(GLOSSARY) as Array<keyof typeof GLOSSARY>).map(k => (
          <button
            key={k}
            className={`gtab${activeKey === k ? " active" : ""}`}
            onClick={() => { setActiveKey(k); setOpenIdx(null); }}
          >
            {k}
          </button>
        ))}
      </div>

      <div>
        {GLOSSARY[activeKey].map((item, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={i} className="glossary-item">
              <button className="gi-head" onClick={() => setOpenIdx(isOpen ? null : i)}>
                <span className="gi-title">{item.t}</span>
                <span className={`gi-arrow${isOpen ? " open" : ""}`}>▸</span>
              </button>
              {isOpen && <div className="gi-body animate-fade-up">{item.b}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* PATCH-MENAGE-V1 date-input-bounds */

// PATCH-MENU-NAV-V1 applied

// HOTFIX-MENU-NAV-TAB-SYNC applied

// COMPAT-CITY-COORDS-V1 applied
// COMPAT-BIRTHTIME-CHECKBOX-V1 applied

// LINT-CSS-CLEANUP-V1 applied

// CI-DEBT-PURGE-V1-D applied

// RWS-TAROT-V1 explore applied

// TAROT-QUESTION-V1 explore applied

// TAROT-PERSISTENCE-V1 explore applied

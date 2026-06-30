"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, apiClient } from "@/lib/api/client";
import { useT, useApp } from "@/lib/i18n";
import { getLocalizedMoonPhase } from "@/lib/i18n/moon-phase";

import { AstroText } from "@/components/ui/AstroText";
import { KairosTrace } from "@/components/kairos/KairosTrace";
// PAYWALL-V3 : compteur d'horoscopes du jour restants (free=5/mois, paid=∞)
import { QuotaIndicator } from "@/components/tiers/QuotaIndicator";
// HOROSCOPE-INLINE-PAYWALL-V1 + GENERATED-AT-V1
import { formatRelativeDateTime } from "@/lib/date-relative";
import { GlossaryButton } from "@/components/ui/GlossaryPanel"; // AUDIT-UX-GLOSSARY-V1
import { aspectHelp } from "@/lib/astro/aspect-help"; // HOROSCOPE-SCORE-DRIVERS-V1
const SIGN_GLYPHS: Record<number, string> = {
  0:"♈",1:"♉",2:"♊",3:"♋",4:"♌",5:"♍",6:"♎",7:"♏",8:"♐",9:"♑",10:"♒",11:"♓",
};
const SIGN_NAMES_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
const SIGN_NAMES_EN = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

// HERO-WHEEL-TRANSITS — données utilisées par <TransitGlyphsLayer> pour
// positionner les vraies planètes du jour sur les 3 orbites du hero.
const PLANET_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};
const PLANET_COLORS: Record<string, string> = {
  moon: "#b0adc8", mercury: "#60a5fa", venus: "#e879a8",
  mars: "#f87171", jupiter: "#34d399", saturn: "#a78bfa",
  uranus: "#67e8f9", neptune: "#818cf8", pluto: "#c4b5fd",
};
const PLANET_NAMES_FR: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturne",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
  // ASTEROIDS/RELATIONSHIPS : corps secondaires remontés dans les transits.
  northNode: "Nœud Nord", southNode: "Nœud Sud", lilith: "Lilith", lilithTrue: "Lilith vraie",
  chiron: "Chiron", ceres: "Cérès", pallas: "Pallas", juno: "Junon", vesta: "Vesta",
  fortune: "Part de Fortune",
};
const PLANET_NAMES_EN: Record<string, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturn",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
  northNode: "North Node", southNode: "South Node", lilith: "Lilith", lilithTrue: "True Lilith",
  chiron: "Chiron", ceres: "Ceres", pallas: "Pallas", juno: "Juno", vesta: "Vesta",
  fortune: "Part of Fortune",
};
// Soleil = centre (.wheel-sun déjà rendu) → pas dans cette map.
// 3 anneaux : rapides perso (wo3), intermédiaires (wo2), lentes/transp (wo1).
const PLANET_ORBIT: Record<string, number> = {
  moon: 3, mercury: 3, venus: 3,
  mars: 2, jupiter: 2,
  saturn: 1, uranus: 1, neptune: 1, pluto: 1,
};
// Rayons en % du demi-wheel-wrap (centre → bord). Indépendants de la
// taille pour scaler entre mobile (170×170) et desktop (240×240).
// Ratios = rayonOrbite / rayonWheel = (155/2) / (170/2) → 91.18/2 = 45.59, etc.
const ORBIT_RADIUS_PCT: Record<number, number> = { 1: 45.59, 2: 32.35, 3: 20 };

// Formate une longitude écliptique (0–360°) en notation astro standard :
// 47.388 → "17°23′ Taureau". Utilisé dans les tooltips et la légende du wheel.
function formatLongitude(lon: number, locale: string): string {
  const signIdx   = Math.floor(lon / 30) % 12;
  const degInSign = lon % 30;
  const deg       = Math.floor(degInSign);
  const min       = Math.floor((degInSign - deg) * 60);
  const signs     = locale === "en" ? SIGN_NAMES_EN : SIGN_NAMES_FR;
  return `${deg}°${min.toString().padStart(2, "0")}′ ${signs[signIdx]}`;
}

// Les 6 thèmes avec emoji + couleur + clés de traduction
const THEMES = [
  // HOROSCOPE-SOFT-SCORES-V1 : rose doux poudré au lieu du rouge alarmant
  // #e54545 — garde l'identité chaude « vitalité » sans l'effet alerte.
  { key: "vital",   emoji: "⚡", color: "#d68f8f", frLabel: "Vitalité", enLabel: "Vitality" },
  { key: "mental",  emoji: "🔮", color: "#818cf8", frLabel: "Mental",   enLabel: "Mental" },
  { key: "harmony", emoji: "💫", color: "#c9a84c", frLabel: "Harmonie", enLabel: "Harmony" },
  { key: "love",    emoji: "♡",  color: "#e879a8", frLabel: "Amour",    enLabel: "Love" },
  { key: "career",  emoji: "♃",  color: "#34d399", frLabel: "Carrière", enLabel: "Career" },
  { key: "luck",    emoji: "✦",  color: "#67e8f9", frLabel: "Chance",   enLabel: "Luck" },
];

type Tab = "day" | "week" | "month" | "year";

// HOROSCOPE-KEY-MOMENTS-V1 : un moment clé = quand / déclencheur astral / posture
interface KeyMoment {
  when:    string;  // ex. « autour du 5 juin »
  trigger: string;  // le transit/aspect en cause
  stance:  string;  // la posture à adopter
}

interface AiHoroscope {
  oracle:   string;
  summary:  string;
  text:     string;
  keyDates: KeyMoment[];
  advice:   string;
  themes?:  Record<string, string>;  // ← NOUVEAU : analyse par thème (5-6 lignes chacune)
  relationships?: string | null;     // RELATIONSHIPS-V1 : ligne « relation du jour »
}

// HERO-WHEEL-TRANSITS — sur-couche absolue qui positionne les vraies
// planètes du jour sur les orbites du hero. Position en pourcentage du
// wheel-wrap (50% = centre) pour scaler automatiquement entre mobile et
// desktop sans recalcul JS. Offset −90° pour que 0° Bélier pointe en haut.
function TransitGlyphsLayer({
  planets,
  locale,
}: {
  planets: Record<string, { longitude?: number; retrograde?: boolean }> | undefined;
  locale: string;
}) {
  if (!planets) return null;
  const names = locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR;
  return (
    <div className="wheel-glyph-layer">
      {Object.entries(planets).map(([key, p]) => {
        const orbit = PLANET_ORBIT[key];
        if (!orbit) return null;
        const rPct    = ORBIT_RADIUS_PCT[orbit]!;
        // WHEEL-DIRECTION-CELESTE-V1 : sens antihoraire (Bélier en haut, puis
        // Taureau en haut-gauche…) pour coller au zodiaque réel et à la
        // ZodiacWheel. Avant : `50 + cos / 50 + sin` → sens horaire (à l'envers).
        const lonRad  = ((p.longitude ?? 0) * Math.PI) / 180;
        const xPct    = 50 - rPct * Math.sin(lonRad);
        const yPct    = 50 - rPct * Math.cos(lonRad);
        // Tooltip enrichi : "Mercure 17°23′ Gémeaux" + ℞ si rétrograde.
        const display = `${names[key] ?? key} ${formatLongitude(p.longitude ?? 0, locale)}${p.retrograde ? " ℞" : ""}`;
        return (
          <span
            key={key}
            className="wheel-glyph"
            style={{
              left:  `${xPct}%`,
              top:   `${yPct}%`,
              color: PLANET_COLORS[key] ?? "var(--gold)",
            }}
            title={display}
            aria-label={display}
          >
            {PLANET_GLYPHS[key] ?? key[0]?.toUpperCase()}
          </span>
        );
      })}
    </div>
  );
}

// HERO-WHEEL-CONTEXT — 4 glyphes des signes cardinaux (Bélier / Cancer /
// Balance / Capricorne) aux 4 coins de la roue. Marqueurs visuels pour
// repérer l'orientation zodiacale standard (Bélier en haut = 0°, sens horaire).
function CardinalSignsLayer() {
  const cardinals: Array<{ signIdx: number; left: string; top: string }> = [
    { signIdx: 0, left: "50%",  top: "0%"   }, // ♈ haut
    { signIdx: 3, left: "100%", top: "50%"  }, // ♋ droite
    { signIdx: 6, left: "50%",  top: "100%" }, // ♎ bas
    { signIdx: 9, left: "0%",   top: "50%"  }, // ♑ gauche
  ];
  return (
    <div className="wheel-glyph-layer">
      {cardinals.map((c) => (
        <span
          key={c.signIdx}
          className="wheel-cardinal"
          style={{ left: c.left, top: c.top }}
          aria-hidden
        >
          {SIGN_GLYPHS[c.signIdx]}
        </span>
      ))}
    </div>
  );
}

// HERO-WHEEL-CONTEXT — Légende textuelle sous la roue : "☽ Cancer · ☿ Gémeaux …"
// pour 9 planètes (hors Soleil qui est le centre fixe).
function TransitLegend({
  planets,
  locale,
}: {
  planets: Record<string, { longitude?: number; retrograde?: boolean }> | undefined;
  locale: string;
}) {
  if (!planets) return null;
  const signs = locale === "en" ? SIGN_NAMES_EN : SIGN_NAMES_FR;
  const items = Object.entries(planets)
    .filter(([k]) => PLANET_ORBIT[k]) // skip sun (centre)
    .map(([k, p]) => {
      const signIdx = Math.floor((p.longitude ?? 0) / 30) % 12;
      return (
        <span key={k} className="wheel-legend-item">
          <span style={{ color: PLANET_COLORS[k] ?? "var(--gold)" }}>
            {PLANET_GLYPHS[k]}
          </span>{" "}
          {signs[signIdx]}
          {p.retrograde ? " ℞" : ""}
        </span>
      );
    });
  if (items.length === 0) return null;
  return <div className="wheel-legend">{items}</div>;
}

export default function HoroscopePage() {
  const { accessToken, refreshTiers } = useAuth();
  const { locale } = useApp();
  const t = useT();
  const [tab, setTab] = useState<Tab>("day");
  const [natalId, setNatalId] = useState<string | null>(null);
  // HOROSCOPE-CONSEIL-DETAILS-V1 : la lecture détaillée (mécanique astrale) est
  // repliée par défaut — la cible lit d'abord les conseils, déplie si curieuse.
  const [showDetails, setShowDetails] = useState(false);

  const { data: profilesRes } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const profiles = useMemo(
    () => (profilesRes as any)?.data?.profiles ?? [],
    [profilesRes],
  );

  // Default to the first profile until the user picks another via the select.
  // Derived during render to avoid setState-in-effect.
  const effectiveNatalId: string | null = natalId ?? profiles[0]?.id ?? null;
  const profile  = profiles.find((p: any) => p.id === effectiveNatalId);

  // Scores (API existante)
  // `locale` est inclus dans la queryKey ET la query string : l'API utilise la
  // locale pour formater les alertes transits ("Pluton trigone Saturne natal —
  // exact aujourd'hui" vs "Transit Pluto trine Natal Saturn — exact today").
  const { data: horoRes } = useQuery({
    queryKey: ["horoscope", effectiveNatalId, locale],
    queryFn: () => apiClient.get(`/horoscope/daily/${effectiveNatalId}?locale=${locale}`, accessToken!),
    enabled: !!accessToken && !!effectiveNatalId,
  });
  const horo   = (horoRes as any)?.data;
  const scores = horo?.scores ?? {};
  // HOROSCOPE-SCORE-DRIVERS-V1 : aspects qui justifient chaque score
  const scoreDrivers = horo?.scoreDrivers ?? {};
  const moon   = horo?.current?.moonPhase;
  const alerts = horo?.alerts ?? [];
  // LUNAR-GARDENING-V1 : conseil jardinier du jour (déterministe, calendrier lunaire)
  const garden = horo?.gardening;
  // STAB-PRE-5-V1 : null si pas chargé, évite le flash Bélier
  const sunSignIdx: number | null = horo?.natal?.planets?.sun?.signIdx ?? profile?.sunSignIdx ?? null;

  // IA Kairos (nouveau endpoint avec themes)
  // HOROSCOPE-INLINE-PAYWALL-V1 : skipPaywall=true → l'erreur 403/429 tier
  // n'ouvre PAS le PaywallModal global. On l'attrape ici et on rend un
  // teaser inline (cf. <HoroscopeBlocked> plus bas).
  const { data: aiRes, isLoading: aiLoading, isError: aiError, error: aiErrorObj, refetch } = useQuery({
    queryKey: ["ai-horoscope", effectiveNatalId, tab, locale],
    queryFn: () => apiClient.post(
      "/ai/horoscope",
      { natalId: effectiveNatalId, period: tab, locale, includeThemes: true },
      accessToken!,
      { skipPaywall: true },
    ),
    enabled: !!accessToken && !!effectiveNatalId,
    staleTime: tab === "day" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    retry: false, // pas de retry sur les erreurs tier — c'est définitif côté serveur
  });
  const ai: AiHoroscope | null = (aiRes as any)?.data ?? null;
  // HOROSCOPE-GENERATED-AT-V1
  const aiGeneratedAt: string | null = (aiRes as any)?.generatedAt ?? null;

  // HOROSCOPE-INLINE-PAYWALL-V1 : détecte une erreur "tier" (feature non
  // disponible ou quota épuisé) pour décider si on affiche le teaser
  // inline ou le wording "Kairos est silencieux".
  const tierBlocked = aiError && (() => {
    const e = aiErrorObj as { statusCode?: number; code?: string } | null;
    if (!e) return false;
    return (e.statusCode === 403 && e.code === "FEATURE_NOT_AVAILABLE")
        || (e.statusCode === 429 && e.code === "QUOTA_EXCEEDED");
  })();

  // PAYWALL-V3 : décrémente le compteur "horoscopes du jour" affiché dans
  // QuotaSummary après une nouvelle génération day (tab === "day"). Les
  // periods week/month/year sont gated par entitlement booléen, pas quota.
  useEffect(() => {
    if (tab === "day" && ai && !aiLoading && !aiError) {
      refreshTiers();
    }
  }, [ai, tab, aiLoading, aiError, refreshTiers]);

  // Empty state
  if (profiles.length === 0) {
    return (
      <div className="page-root">
        <div className="empty-state animate-fade-up">
          <div className="ico">✦</div>
          <p className="msg">{t("home_no_profile")}</p>
          <Link href="/dashboard/natal" className="btn-ghost" style={{ marginTop: 18 }}>
            {t("home_create_profile")} →
          </Link>
        </div>
      </div>
    );
  }

  const firstName = profile?.label?.split(" ")[0] ?? profile?.name?.split(" ")[0] ?? "";
  const today = new Date().toLocaleDateString(locale, {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="page-root">
      {/* AUDIT-UX-GLOSSARY-V1 : glossaire contextuel */}
      <div className="animate-fade-up" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <GlossaryButton initialTab="Notions" />
      </div>

      {/* Sélecteur profil si plusieurs */}
      {profiles.length > 1 && (
        <div style={{ marginBottom: 14 }} className="animate-fade-up">
          <label className="form-label">{t("horoscope_profile")}</label>
          <select value={effectiveNatalId ?? ""} onChange={e => setNatalId(e.target.value)}>
            {profiles.map((p: any) => (
              <option key={p.id} value={p.id}>{p.label ?? p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Hero avec orbites + signe */}
      {sunSignIdx !== null && (
      <div className="hero animate-fade-up">
        <div className="wheel-wrap">
          <div className="wheel-orbit wo1" />
          <div className="wheel-orbit wo2" />
          <div className="wheel-orbit wo3" />
          <div className="wheel-sun" />
          <CardinalSignsLayer />
          <TransitGlyphsLayer planets={horo?.current?.planets} locale={locale} />
        </div>
        <TransitLegend planets={horo?.current?.planets} locale={locale} />
        <div className="hero-sign">{SIGN_GLYPHS[sunSignIdx]}</div>
        <div className="hero-name">
          {firstName ? `${firstName} · ` : ""}
          {(locale === "en" ? SIGN_NAMES_EN : SIGN_NAMES_FR)[sunSignIdx]}
        </div>
        <div className="hero-info" style={{ textTransform: "capitalize" }}>
          {today}
        </div>
      </div>
      )}

      {/* Alertes rétrogrades */}
      {alerts.length > 0 && (
        <div className="animate-fade-up delay-100" style={{ marginTop: 14 }}>
          {alerts.map((a: { text: string; explanation?: string }, i: number) => (
            <div key={i} className="alert-banner">
              <span className="ab-ico">⟲</span>
              <span>
                <span>{a.text}</span>
                {a.explanation && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      fontSize: "0.8rem",
                      opacity: 0.72,
                      fontStyle: "italic",
                    }}
                  >
                    {a.explanation}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Phase lunaire — i18n via `key` (locale-agnostic backend), fallback
          sur les champs FR bruts si la clé n'est pas reconnue (forward-compat). */}
      {moon && (() => {
        const lang = locale === "en" ? "en" : "fr";
        const localized = getLocalizedMoonPhase(moon.key, lang);
        return (
          <div className="moon-phase animate-fade-up delay-100" style={{ marginTop: 12 }}>
            <span className="ico">{moon.emoji}</span>
            <div>
              <p className="name">{localized?.phase ?? moon.phase}</p>
              <p className="desc">{localized?.description ?? moon.description}</p>
            </div>
          </div>
        );
      })()}

      {/* Subnav période */}
      <div className="subnav no-print">
        {(["day","week","month","year"] as Tab[]).map(k => (
          <button
            key={k}
            className={`subnav-tab${tab === k ? " active" : ""}`}
            onClick={() => setTab(k)}
          >
            {t(`horo_tab_${k}` as any)}
          </button>
        ))}
      </div>

      {/* PAYWALL-V3 : compteur d'horoscopes du jour restants ce mois.
          Affiché uniquement sur l'onglet "day" pour rester contextuel
          (les autres périodes sont gated par entitlement booléen, pas quota). */}
      {tab === "day" && (
        <div className="no-print" style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <QuotaIndicator feature="horoscope.daily.monthly" variant="compact" />
        </div>
      )}

      {/* ORACLE IA */}
      {ai?.oracle && (
        <div className="oracle animate-fade-up delay-150">« <AstroText>{ai.oracle}</AstroText> »</div>
      )}

      {aiLoading && !ai && <HoroscopeGenerating locale={locale} />}

      {/* HOROSCOPE-INLINE-PAYWALL-V1 : sur erreur tier, teaser inline */}
      {tierBlocked && !ai && effectiveNatalId && (
        <HoroscopeBlocked
          natalId={effectiveNatalId}
          period={tab}
          locale={locale}
          accessToken={accessToken!}
        />
      )}

      {/* Erreur réseau / xAI (PAS une erreur tier) */}
      {aiError && !tierBlocked && !ai && (
        <div className="alert-banner" style={{
          background: "rgba(229,69,69,.08)", borderColor: "rgba(229,69,69,.25)", color: "var(--tension)",
        }}>
          <span className="ab-ico">⚠</span>
          <span>
            {locale === "en" ? "Kairos is silent. Try again in a moment." : "Kairos est silencieux. Réessayez dans un instant."}
            <button onClick={() => refetch()} style={{ marginLeft: 8, textDecoration: "underline", color: "inherit", background: "transparent" }}>
              {locale === "en" ? "Retry" : "Réessayer"}
            </button>
          </span>
        </div>
      )}

      {/* RÉSUMÉ */}
      {ai?.summary && (
        <div className="card animate-fade-up delay-200" style={{ marginTop: 12, marginBottom: 14 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 14, lineHeight: 1.6, color: "var(--star)" }}>
            <AstroText>{ai.summary}</AstroText>
          </p>
          {/* HOROSCOPE-GENERATED-AT-V1 + KAIROS-VOICE-V1 : la lecture est signée
              Kairos en ligne (pas seulement dans le disclaimer KairosTrace en
              bas de page), timestamp relatif à la suite. */}
          <p style={{
            marginTop: 8, fontSize: 11, color: "var(--muted)", fontStyle: "italic", opacity: 0.7,
          }}>
            <span aria-hidden style={{ color: "var(--gold)", fontStyle: "normal" }}>✦</span>{" "}
            {locale === "en" ? "By Kairos" : "Par Kairos"}
            {aiGeneratedAt && (
              <>
                {" · "}
                {locale === "en" ? "generated " : "généré "}
                {formatRelativeDateTime(aiGeneratedAt, locale === "en" ? "en" : "fr")}
              </>
            )}
          </p>
        </div>
      )}

      {/* ─── 6 THÈMES : emoji + label + analyse IA ─── */}
      {/* HOROSCOPE-THEMES-UPSELL-V1 : la variante "plain" (free, period=day)
          ne contient pas `themes`. On affiche alors une carte upsell vendeuse
          au lieu des 6 placeholders "Analyse indisponible". */}
      {ai?.themes && (
        <div className="animate-fade-up delay-200">
          <div className="section-title" style={{ marginTop: 18 }}>
            {locale === "en" ? "Life themes" : "Thèmes de vie"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {THEMES.map(theme => {
              const score    = Math.min(100, Math.max(0, scores[theme.key] ?? 50));
              const analysis = ai?.themes?.[theme.key];
              return (
                <ThemeBlock
                  key={theme.key}
                  emoji={theme.emoji}
                  label={locale === "en" ? theme.enLabel : theme.frLabel}
                  color={theme.color}
                  score={score}
                  drivers={scoreDrivers[theme.key] ?? []}
                  analysis={analysis}
                  aiLoading={aiLoading && !ai}
                  locale={locale}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* HOROSCOPE-THEMES-UPSELL-V1 : upsell free → Essentiel */}
      {ai && !ai.themes && <ThemesUpsellCard locale={locale} />}

      {/* RELATIONSHIPS-V1 : relation la plus activée du jour (1-2 lignes) */}
      {ai?.relationships && (
        <div className="card animate-fade-up" style={{ marginTop: 14, padding: 16 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            {locale === "en" ? "Your relationships today" : "Tes relations du jour"}
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--star)" }}>
            <AstroText>{ai.relationships}</AstroText>
          </p>
        </div>
      )}

      {/* LECTURE DÉTAILLÉE (mécanique astrale) — repliée par défaut.
          HOROSCOPE-CONSEIL-DETAILS-V1 : conseil d'abord, détail technique au clic. */}
      {ai?.text && (
        <>
          <div className="sep" />
          <button
            type="button"
            onClick={() => setShowDetails(v => !v)}
            aria-expanded={showDetails}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", background: "transparent", border: "none",
              padding: "6px 2px", cursor: "pointer", color: "var(--star)",
              fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: .5,
            }}
          >
            <span>{locale === "en" ? "The sky in detail" : "Le ciel en détail"}</span>
            <span style={{ color: "var(--gold)", fontSize: 13 }}>
              {showDetails
                ? (locale === "en" ? "Hide ▴" : "Masquer ▴")
                : (locale === "en" ? "More details ▾" : "Plus de détails ▾")}
            </span>
          </button>
          {showDetails && (
            <div className="animate-fade-up pred-text" style={{ marginTop: 4 }}>
              {ai.text.split("\n\n").map((p, i) => <p key={i}><AstroText>{p.trim()}</AstroText></p>)}
            </div>
          )}
        </>
      )}

      {/* DATES CLÉS */}
      {ai?.keyDates && ai.keyDates.length > 0 && (
        <>
          <div className="sep" />
          <div className="section-title">
            {locale === "en" ? "Key moments" : "Moments clés"}
          </div>
          <div className="card" style={{ fontSize: 12.5, lineHeight: 1.65 }}>
            {ai.keyDates.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: i < ai.keyDates.length - 1 ? 14 : 0 }}>
                <span style={{ color: "var(--gold)", flexShrink: 0 }}>✦</span>
                <div>
                  {m.when && (
                    <div style={{ fontFamily: "var(--font-display)", color: "var(--star)", fontSize: 13 }}>
                      {m.when}
                    </div>
                  )}
                  {m.trigger && (
                    <div style={{ color: "var(--muted)", marginTop: m.when ? 2 : 0 }}>
                      <AstroText>{m.trigger}</AstroText>
                    </div>
                  )}
                  {m.stance && (
                    <div style={{ marginTop: 4, color: "var(--star)" }}>
                      <span style={{ color: "var(--gold)", marginRight: 4 }}>→</span>
                      <AstroText>{m.stance}</AstroText>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* TRACE KAIROS — show your work : disclaimer + données utilisées */}
      <KairosTrace
        readingKind="horoscope"
        natal={horo?.natal}
        moonPhase={moon}
        alerts={alerts}
        birthTimeKnown={(aiRes as any)?.meta?.birthTimeKnown ?? true}
        natalId={effectiveNatalId}
        locale={locale}
        hasReading={!!ai && !aiLoading}
      />

      {/* CONSEIL */}
      {ai?.advice && (
        <div className="card-gold animate-fade-up card" style={{
          marginTop: 14, textAlign: "center", padding: 16,
        }}>
          <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            {locale === "en" ? "Advice" : "Conseil"}
          </div>
          <p style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 13.5, lineHeight: 1.55, color: "var(--star)",
          }}>
            <AstroText>{ai.advice}</AstroText>
          </p>
        </div>
      )}

      {/* CONSEIL JARDINIER DU JOUR — LUNAR-GARDENING-V1
          Déterministe (calendrier lunaire), calculé côté serveur depuis le
          signe/phase/déclinaison de la Lune. Indépendant de la réponse IA. */}
      {garden && (
        <div className="card animate-fade-up delay-100" style={{
          marginTop: 14, padding: 16, display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }} aria-hidden>{garden.emoji}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: "block", fontSize: 10, color: "var(--muted)",
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
            }}>
              🌱 {garden.title}
            </span>
            <span style={{
              display: "block", fontFamily: "var(--font-display)", fontSize: 14.5,
              color: "var(--star)", marginBottom: 5,
            }}>
              {garden.dayTypeLabel}
              <span style={{ color: "var(--muted)" }}> · {garden.detail}</span>
            </span>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--star)", opacity: 0.92 }}>
              {garden.advice}
            </p>
          </span>
        </div>
      )}

      {/* COMMUNITY-HIDE-V1 — accroche « Ta place dans le ciel collectif » RETIRÉE
          tant qu'il n'y a pas assez de membres opt-in (cf. Sidebar). La page
          /dashboard/communaute reste joignable par URL directe. */}

      {/* ASTROCARTOGRAPHY-V1 — accès discret à la page « Vos lieux »
          (la feature a sa propre page : c'est un outil de LIEU, pas du jour) */}
      <Link
        href="/dashboard/astrocartographie"
        className="card"
        style={{
          display: "flex", alignItems: "center", gap: 12, marginTop: 14,
          padding: "12px 16px", textDecoration: "none", color: "inherit",
        }}
      >
        <span style={{ fontSize: 22 }} aria-hidden>🗺</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 15, color: "var(--star)" }}>
            Vos lieux
          </span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
            Où ton ciel de naissance touche la Terre — tes lieux de pouvoir, et ce qui s’y active en ce moment.
          </span>
        </span>
        <span style={{ color: "var(--gold)", fontSize: 18, flexShrink: 0 }} aria-hidden>→</span>
      </Link>

    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Bloc analyse d'un thème
// ──────────────────────────────────────────────────────────
// HOROSCOPE-SCORE-DRIVERS-V1 : aspect transit→natal ayant contribué au score
interface ThemeDriver {
  transitPlanet: string;
  natalPlanet:   string;
  type:          string;
  typeFr:        string;
  symbol:        string;
  tone:          "harmony" | "tension" | "neutral";
  exact:         boolean;
  delta:         number;
}

// HOROSCOPE-SOFT-SCORES-V1 : score 0–100 → appréciation douce. Plus de
// chiffre /100 ni de rouge : on parle d'une ambiance du ciel, pas d'une note.
// 5 bandes symétriques autour de 50 (= ciel neutre), calées sur le pas réel
// du calcul backend (chaque aspect bouge le score de ±4, ±6 si exact) :
//   ≥58 Porteur · 54–57 Fluide · 47–53 Calme · 43–46 En douceur · ≤42 Délicat
// → 50 (cas le plus fréquent = rien de net) tombe sur « Calme », un seul
// aspect suffit à faire varier l'étiquette, et les extrêmes restent rares
// mais signifiants. Toujours bienveillant, y compris le bas du spectre.
function scoreTone(score: number, locale: string): string {
  const fr = locale !== "en";
  if (score >= 58) return fr ? "Porteur"    : "Uplifting";
  if (score >= 54) return fr ? "Fluide"     : "Flowing";
  if (score >= 47) return fr ? "Calme"      : "Calm";
  if (score >= 43) return fr ? "En douceur" : "Gentle";
  return fr ? "Délicat" : "Sensitive";
}

// HOROSCOPE-SOFT-SCORES-V1 : largeur de jauge = score brut, ancrée à 50 = 50%.
// On a testé une amplification (×3.2) pour la rendre plus expressive, mais sur
// les petits scores la barre courte « vidée » devenait anxiogène — exactement
// l'effet qu'on fuit. On reste donc proche du milieu : la jauge respire à peine,
// c'est la variation des étiquettes (5 bandes) qui porte la lecture du jour.
function gaugeWidth(score: number): number {
  return Math.max(8, Math.min(92, Math.round(score)));
}

// Phrase douce pour un aspect transit→natal, sans glyphe clinique ni delta
// chiffré. Le détail technique reste accessible via le tooltip (aspectHelp).
// Corps féminins en français → possessif « ta » + adjectif « natale » (sinon
// « ton » + « natal »). Clés du moteur.
const FR_FEMININE_BODIES = new Set(["moon", "venus", "lilith", "lilithTrue", "ceres", "pallas", "juno", "vesta", "fortune"]);

function driverPhrase(tName: string, nName: string, nKey: string, tone: ThemeDriver["tone"], locale: string): string {
  const fr = locale !== "en";
  const link = tone === "harmony" ? (fr ? "en harmonie avec" : "in harmony with")
            : tone === "tension"  ? (fr ? "en tension avec"  : "in tension with")
            : (fr ? "en lien avec" : "linked with");
  // Le corps de droite est NATAL → on le qualifie (syntaxe « ton Mercure natal »),
  // avec accord de genre du possessif ET de l'adjectif (ta Vénus natale).
  const fem = FR_FEMININE_BODIES.has(nKey);
  const poss = fem ? "ta" : "ton";
  const natalAdj = fem ? "natale" : "natal";
  return fr ? `${tName} ${link} ${poss} ${nName} ${natalAdj}` : `${tName} ${link} your natal ${nName}`;
}

const DRIVER_DOT_COLOR: Record<ThemeDriver["tone"], string> = {
  // Vert doux / ambre chaud / gris-mauve — jamais de rouge alarmant.
  harmony: "var(--harmony)",
  tension: "var(--neutral)",
  neutral: "var(--muted)",
};

// HOROSCOPE-LOADING-ANIM — « rituel de lecture du ciel » pendant la génération
// IA (~10-30 s). Les étapes défilent en fondu. Chaque phrase est unique.
const GENERATING_STEPS_FR = [
  "Ouverture de ton ciel…",
  "Calcul de la position des planètes…",
  "Lecture de la Lune…",
  "Repérage des aspects du jour…",
  "Alignement avec ton thème natal…",
  "Écoute des transits en cours…",
  "Tissage des influences…",
  "Interprétation par Kairos…",
  "Mise en mots de ta journée…",
];
const GENERATING_STEPS_EN = [
  "Opening your sky…",
  "Calculating planetary positions…",
  "Reading the Moon…",
  "Spotting today's aspects…",
  "Aligning with your birth chart…",
  "Listening to the current transits…",
  "Weaving the influences…",
  "Kairos is interpreting…",
  "Putting your day into words…",
];

function HoroscopeGenerating({ locale }: { locale: string }) {
  const steps = locale === "en" ? GENERATING_STEPS_EN : GENERATING_STEPS_FR;
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(v => (v + 1) % steps.length), 1900);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div
      className="card animate-fade-up"
      role="status"
      aria-live="polite"
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 18, padding: "36px 20px", textAlign: "center",
      }}
    >
      {/* Astre central qui pulse dans un anneau qui tourne (orbite) */}
      <div style={{ position: "relative", width: 64, height: 64 }} aria-hidden>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "1.5px solid var(--border)",
          borderTopColor: "var(--gold)", borderRightColor: "var(--gold)",
          animation: "spin 2.4s linear infinite",
        }} />
        <span style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          fontSize: 22, color: "var(--gold)",
          animation: "pulse 2.4s ease-in-out infinite",
        }}>✦</span>
      </div>

      {/* Étape courante — re-montée à chaque changement (key) → fondu */}
      <div style={{ minHeight: 22, display: "flex", alignItems: "center" }}>
        <span
          key={step}
          className="animate-fade-up"
          style={{
            display: "inline-block",
            fontFamily: "var(--font-display)", fontSize: 15,
            color: "var(--star)", letterSpacing: .3,
          }}
        >
          {steps[step]}
        </span>
      </div>

      {/* Signature Kairos + points animés */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 11, color: "var(--muted)",
          letterSpacing: 1, textTransform: "uppercase",
        }}>
          {locale === "en" ? "Kairos" : "Par Kairos"}
        </span>
        <span style={{ display: "inline-flex", gap: 3 }} aria-hidden>
          {[0, 1, 2].map(d => (
            <span key={d} style={{
              width: 4, height: 4, borderRadius: "50%", background: "var(--gold)",
              animation: `typing-dot 1.2s ease-in-out ${d * 0.2}s infinite`,
            }} />
          ))}
        </span>
      </div>

      <span className="sr-only">
        {locale === "en" ? "Kairos is preparing your reading…" : "Kairos prépare ta lecture…"}
      </span>
    </div>
  );
}

function ThemeBlock({ emoji, label, color, score, drivers, analysis, aiLoading, locale }: {
  emoji: string; label: string; color: string;
  score: number; drivers: ThemeDriver[]; analysis?: string;
  aiLoading: boolean; locale: string;
}) {
  const names = locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR;
  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
      {/* En-tête : emoji + label + appréciation qualitative (plus de /100) */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 6,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{emoji}</span>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            color: "var(--gold)",
            letterSpacing: .5,
          }}>
            {label}
          </span>
        </div>
        {/* HOROSCOPE-SOFT-SCORES-V1 : l'ambiance du jour, pas une note */}
        <span
          className="score-label"
          title={locale === "en"
            ? "The mood of today's sky on this theme, from the transits to your natal chart. Around the middle = quiet sky."
            : "L'ambiance du ciel sur ce thème aujourd'hui, d'après les transits vers ton thème natal. Au milieu = ciel calme."}
          style={{ cursor: "help" }}
        >
          <span aria-hidden style={{ color: "var(--gold)", marginRight: 5 }}>✦</span>
          {scoreTone(score, locale)}
        </span>
      </div>

      {/* Jauge dorée sobre : la largeur dit l'intensité, la couleur ne juge pas */}
      <div className="score-gauge" role="img"
        aria-label={`${label} — ${scoreTone(score, locale)}`}>
        <div className="score-gauge-fill" style={{ width: `${gaugeWidth(score)}%` }} />
      </div>

      {/* HOROSCOPE-SOFT-SCORES-V1 : les aspects du jour en phrases douces
          (dot vert/ambre, sans rouge, sans delta chiffré), ou « ciel calme ». */}
      {drivers.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          {drivers.map((d, i) => (
            <span
              key={i}
              className="driver-line"
              title={aspectHelp(d.type, locale)}
              style={{ cursor: "help" }}
            >
              <span className="driver-dot" style={{ background: DRIVER_DOT_COLOR[d.tone] }} />
              {driverPhrase(
                names[d.transitPlanet] ?? d.transitPlanet,
                names[d.natalPlanet] ?? d.natalPlanet,
                d.natalPlanet,
                d.tone,
                locale,
              )}
            </span>
          ))}
        </div>
      ) : (
        <p style={{
          fontSize: 11, color: "var(--muted)", fontStyle: "italic",
          marginBottom: 10,
        }}>
          {locale === "en"
            ? "Quiet sky on this theme today."
            : "Ciel calme sur ce thème aujourd'hui."}
        </p>
      )}

      {/* HOROSCOPE-CONSEIL-DETAILS-V1 : conseil court du jour (plus de mécanique
          astrale ici — elle vit dans « Le ciel en détail » global). */}
      {analysis ? (
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: 12.5, lineHeight: 1.6,
          color: "var(--star)", opacity: .85,
        }}>
          <AstroText>{analysis}</AstroText>
        </p>
      ) : aiLoading ? (
        <div style={{
          display: "flex", gap: 4,
          padding: "4px 0",
        }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 5, height: 5, borderRadius: "50%",
              background: color,
              animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      ) : (
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: 11.5, lineHeight: 1.5,
          color: "var(--muted)", fontStyle: "italic",
        }}>
          {locale === "en" ? "Analysis unavailable." : "Analyse indisponible."}
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// HOROSCOPE-THEMES-UPSELL-V1 — upsell card free → Essentiel
// ------------------------------------------------------------
// Rendue à la place du bloc des 6 thèmes quand l'API a servi la
// variante "plain" (free, period=day). Reprend les 6 chips
// thématiques pour montrer ce qu'on déverrouille, ton direct
// orienté valeur, CTA unique vers /pricing.
// ──────────────────────────────────────────────────────────
function ThemesUpsellCard({ locale }: { locale: string }) {
  const fr = locale !== "en";
  return (
    <div className="animate-fade-up delay-200">
      <div className="section-title" style={{ marginTop: 18 }}>
        {fr ? "Thèmes de vie" : "Life themes"}
      </div>

      <div className="card-gold card" style={{
        padding: "22px 20px",
        background: "var(--card-bg)",
        border: "1px solid var(--gold)",
        borderRadius: "var(--r-lg)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Halo subtil derrière le titre */}
        <div aria-hidden="true" style={{
          position: "absolute",
          top: -40, right: -40, width: 160, height: 160,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        <h3 style={{
          fontFamily: "Georgia, serif",
          fontSize: 20,
          fontWeight: 400,
          color: "var(--gold)",
          letterSpacing: "0.02em",
          margin: "0 0 10px",
          position: "relative",
        }}>
          {fr ? "Déverrouille tes 6 analyses du jour ✦" : "Unlock your 6 daily analyses ✦"}
        </h3>

        <p style={{
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--star)",
          margin: "0 0 16px",
          opacity: 0.9,
        }}>
          {fr
            ? "Vitalité, Mental, Harmonie émotionnelle, Amour, Carrière et Chance — chaque domaine détaillé selon tes transits du jour, plus l'historique illimité et le thème annuel détaillé."
            : "Vitality, Mental, Emotional Harmony, Love, Career and Luck — each one detailed against your transits of the day, plus unlimited history and the detailed yearly chart."}
        </p>

        {/* Mini-grid des 6 chips thématiques (visuel de ce qui se déverrouille) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: 18,
        }}>
          {THEMES.map(theme => (
            <div
              key={theme.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${theme.color}33`,
                borderRadius: "var(--r-sm)",
                fontSize: 12,
              }}
            >
              <span style={{ fontSize: 14, opacity: 0.85 }}>{theme.emoji}</span>
              <span style={{ color: "var(--star)", opacity: 0.8 }}>
                {fr ? theme.frLabel : theme.enLabel}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/pricing"
          className="btn-ob"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "11px 22px",
            fontSize: 13.5,
            textDecoration: "none",
            width: "auto",
            letterSpacing: "0.02em",
          }}
        >
          {fr ? "Passer à Essentiel — 9,90 € / mois" : "Upgrade to Essential — €9.90 / month"}
        </Link>

        <p style={{
          fontSize: 11.5,
          color: "var(--muted)",
          marginTop: 10,
          marginBottom: 0,
          fontStyle: "italic",
        }}>
          {fr
            ? "Annule à tout moment. 7 jours d'essai inclus à l'inscription."
            : "Cancel anytime. 7-day trial on signup."}
        </p>
      </div>
    </div>
  );
}

/* PATCH-MENAGE-V1 hide-silent-on-tier */

// HOROSCOPE-THEMES-UPSELL-V1 applied

// ============================================================
// HOROSCOPE-INLINE-PAYWALL-V1 — HoroscopeBlocked
// ------------------------------------------------------------
// Affiché à la place du PaywallModal global quand l'utilisateur n'a
// pas accès à l'horoscope demandé (feature non disponible OU quota
// du jour épuisé).
//
// Fait un GET /ai/horoscope/peek pour récupérer le summary cache de
// la dernière génération de cette période (si elle existe). Pas de
// nouveau call xAI — coût zéro.
//
// Rendu :
//   • Si summary cache dispo : affiche le résumé + horodatage + CTA
//   • Si pas de cache       : juste le message d'upgrade + CTA
// ============================================================
function HoroscopeBlocked(props: {
  natalId:     string;
  period:      Tab;
  locale:      string;
  accessToken: string;
}) {
  const { natalId, period, locale, accessToken } = props;

  const { data: peekRes } = useQuery({
    queryKey: ["ai-horoscope-peek", natalId, period],
    queryFn: () => apiClient.get(
      `/ai/horoscope/peek?natalId=${encodeURIComponent(natalId)}&period=${period}`,
      accessToken,
    ),
    enabled: !!accessToken && !!natalId,
    staleTime: 60 * 60 * 1000, // 1h — le cache backend est suffisamment stable
    retry: false,
  });

  const peek = (peekRes as any)?.data as { summary: string | null; generatedAt: string | null } | undefined;
  const teaser = peek?.summary ?? null;
  const generatedAt = peek?.generatedAt ?? null;

  return (
    <div className="card animate-fade-up delay-200" style={{ marginTop: 12, marginBottom: 14 }}>
      {teaser ? (
        <>
          <p style={{
            fontFamily: "var(--font-display)", fontSize: 14, lineHeight: 1.6, color: "var(--star)",
          }}>
            <AstroText>{teaser}</AstroText>
          </p>
          {generatedAt && (
            <p style={{
              marginTop: 8, fontSize: 11, color: "var(--muted)", fontStyle: "italic", opacity: 0.7,
            }}>
              {locale === "en" ? "Generated " : "Généré "}
              {formatRelativeDateTime(generatedAt, locale === "en" ? "en" : "fr")}
            </p>
          )}
        </>
      ) : (
        <p style={{
          fontFamily: "var(--font-display)", fontSize: 13, lineHeight: 1.6,
          color: "var(--muted)", fontStyle: "italic",
        }}>
          {locale === "en"
            ? "No horoscope available for this period yet."
            : "Aucun horoscope disponible pour cette période pour le moment."}
        </p>
      )}

      <div style={{
        marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          {locale === "en"
            ? "Full horoscope available with a higher plan."
            : "Horoscope complet disponible avec un plan supérieur."}
        </p>
        <Link
          href={`/pricing?feature=${period === "day" ? "horoscope.day" : `horoscope.${period === "week" ? "weekly" : period === "month" ? "monthly" : "yearly"}`}`}
          className="btn-ghost"
          style={{ fontSize: 12, padding: "8px 16px" }}
        >
          {locale === "en" ? "See plans →" : "Voir les plans →"}
        </Link>
      </div>
    </div>
  );
}

// PATCH-ASTRO-TOOLTIPS-V1 applied (horoscope)

// ARCHIVE-KAIROS-TRACE-V1 applied

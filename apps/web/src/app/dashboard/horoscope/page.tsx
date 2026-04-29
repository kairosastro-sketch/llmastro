"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, apiClient } from "@/lib/api/client";
import { useT, useApp } from "@/lib/i18n";

import { AstroText } from "@/components/ui/AstroText";
const SIGN_GLYPHS: Record<number, string> = {
  0:"♈",1:"♉",2:"♊",3:"♋",4:"♌",5:"♍",6:"♎",7:"♏",8:"♐",9:"♑",10:"♒",11:"♓",
};
const SIGN_NAMES_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
const SIGN_NAMES_EN = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

// Les 6 thèmes avec emoji + couleur + clés de traduction
const THEMES = [
  { key: "vital",   emoji: "⚡", color: "#e54545", frLabel: "Vitalité", enLabel: "Vitality" },
  { key: "mental",  emoji: "🔮", color: "#818cf8", frLabel: "Mental",   enLabel: "Mental" },
  { key: "harmony", emoji: "💫", color: "#c9a84c", frLabel: "Harmonie", enLabel: "Harmony" },
  { key: "love",    emoji: "♡",  color: "#e879a8", frLabel: "Amour",    enLabel: "Love" },
  { key: "career",  emoji: "♃",  color: "#34d399", frLabel: "Carrière", enLabel: "Career" },
  { key: "luck",    emoji: "✦",  color: "#67e8f9", frLabel: "Chance",   enLabel: "Luck" },
];

type Tab = "day" | "week" | "month" | "year";

interface AiHoroscope {
  oracle:   string;
  summary:  string;
  text:     string;
  keyDates: string[];
  advice:   string;
  themes?:  Record<string, string>;  // ← NOUVEAU : analyse par thème (5-6 lignes chacune)
}

export default function HoroscopePage() {
  const { accessToken } = useAuth();
  const { locale } = useApp();
  const t = useT();
  const [tab, setTab] = useState<Tab>("day");
  const [natalId, setNatalId] = useState<string | null>(null);

  const { data: profilesRes } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const profiles = (profilesRes as any)?.data?.profiles ?? [];
  const profile  = profiles.find((p: any) => p.id === natalId);

  // Auto-sélection du premier profil (remplace onSuccess de react-query v4).
  useEffect(() => {
    if (profiles.length > 0 && !natalId) setNatalId(profiles[0].id);
  }, [profiles, natalId]);

  // Scores (API existante)
  const { data: horoRes } = useQuery({
    queryKey: ["horoscope", natalId],
    queryFn: () => apiClient.get(`/horoscope/daily/${natalId}`, accessToken!),
    enabled: !!accessToken && !!natalId,
  });
  const horo   = (horoRes as any)?.data;
  const scores = horo?.scores ?? {};
  const moon   = horo?.current?.moonPhase;
  const alerts = horo?.alerts ?? [];
  // STAB-PRE-5-V1 : null si pas chargé, évite le flash Bélier
  const sunSignIdx: number | null = horo?.natal?.planets?.sun?.signIdx ?? profile?.sunSignIdx ?? null;

  // IA Kairos (nouveau endpoint avec themes)
  const { data: aiRes, isLoading: aiLoading, isError: aiError, refetch } = useQuery({
    queryKey: ["ai-horoscope", natalId, tab, locale],
    queryFn: () => apiClient.post("/ai/horoscope", { natalId, period: tab, locale, includeThemes: true }, accessToken!),
    enabled: !!accessToken && !!natalId,
    staleTime: tab === "day" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
  });
  const ai: AiHoroscope | null = (aiRes as any)?.data ?? null;

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
      {/* Sélecteur profil si plusieurs */}
      {profiles.length > 1 && (
        <div style={{ marginBottom: 14 }} className="animate-fade-up">
          <label className="form-label">{t("horoscope_profile")}</label>
          <select value={natalId ?? ""} onChange={e => setNatalId(e.target.value)}>
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
        </div>
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
          {alerts.map((a: string, i: number) => (
            <div key={i} className="alert-banner">
              <span className="ab-ico">⟲</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Phase lunaire */}
      {moon && (
        <div className="moon-phase animate-fade-up delay-100" style={{ marginTop: 12 }}>
          <span className="ico">{moon.emoji}</span>
          <div>
            <p className="name">{moon.phase}</p>
            <p className="desc">{moon.description}</p>
          </div>
        </div>
      )}

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

      {/* ORACLE IA */}
      {ai?.oracle && (
        <div className="oracle animate-fade-up delay-150">« <AstroText>{ai.oracle}</AstroText> »</div>
      )}

      {aiLoading && !ai && (
        <div className="flex-center" style={{ padding: 40 }}>
          <div className="spinner" />
        </div>
      )}

      {aiError && !ai && (
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
        </div>
      )}

      {/* ─── 6 THÈMES : emoji + label + analyse IA ─── */}
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
                analysis={analysis}
                aiLoading={aiLoading && !ai}
                locale={locale}
              />
            );
          })}
        </div>
      </div>

      {/* TEXTE LONG (global de la période) */}
      {ai?.text && (
        <>
          <div className="sep" />
          <div className="animate-fade-up">
            <div className="section-title">
              {locale === "en" ? "Reading" : "Analyse"}
            </div>
            <div className="pred-text">
              {ai.text.split("\n\n").map((p, i) => <p key={i}><AstroText>{p.trim()}</AstroText></p>)}
            </div>
          </div>
        </>
      )}

      {/* DATES CLÉS */}
      {ai?.keyDates && ai.keyDates.length > 0 && (
        <>
          <div className="sep" />
          <div className="section-title">
            {locale === "en" ? "Key moments" : "Moments clés"}
          </div>
          <div className="card" style={{ fontSize: 12.5, lineHeight: 1.75 }}>
            {ai.keyDates.map((d, i) => (
              <p key={i} style={{ marginBottom: 5 }}>
                <span style={{ color: "var(--gold)", marginRight: 6 }}>✦</span>
                {d}
              </p>
            ))}
          </div>
        </>
      )}

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

      <p style={{ fontSize: 9, color: "var(--muted-2)", textAlign: "center", marginTop: 24, letterSpacing: .3 }}>
        {locale === "en"
          ? "Astrological reading by Kairos"
          : "Analyse astrologique par Kairos"}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Bloc analyse d'un thème
// ──────────────────────────────────────────────────────────
function ThemeBlock({ emoji, label, color, score, analysis, aiLoading, locale }: {
  emoji: string; label: string; color: string;
  score: number; analysis?: string;
  aiLoading: boolean; locale: string;
}) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
      {/* En-tête avec emoji + label + score */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 8,
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
      </div>

      {/* Analyse 5-6 lignes */}
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

/* PATCH-MENAGE-V1 hide-silent-on-tier */

// PATCH-ASTRO-TOOLTIPS-V1 applied (horoscope)

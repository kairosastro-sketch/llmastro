"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, apiClient } from "@/lib/api/client";
import { ZodiacWheel, type WheelPlanet } from "@/components/ui/ZodiacWheel";
import { useT, useApp } from "@/lib/i18n";

const PLANET_GLYPHS: Record<string, string> = {
  sun:"☉", moon:"☽", mercury:"☿", venus:"♀", mars:"♂",
  jupiter:"♃", saturn:"♄", uranus:"♅", neptune:"♆", pluto:"♇",
};
const PLANET_COLORS: Record<string, string> = {
  sun: "#d4a843", moon: "#b0adc8", mercury: "#60a5fa", venus: "#e879a8",
  mars: "#f87171", jupiter: "#34d399", saturn: "#a78bfa",
  uranus: "#67e8f9", neptune: "#818cf8", pluto: "#c4b5fd",
};
const PLANET_NAMES_FR: Record<string,string> = {
  sun:"Soleil", moon:"Lune", mercury:"Mercure", venus:"Vénus",
  mars:"Mars", jupiter:"Jupiter", saturn:"Saturne",
  uranus:"Uranus", neptune:"Neptune", pluto:"Pluton",
};
const PLANET_NAMES_EN: Record<string,string> = {
  sun:"Sun", moon:"Moon", mercury:"Mercury", venus:"Venus",
  mars:"Mars", jupiter:"Jupiter", saturn:"Saturn",
  uranus:"Uranus", neptune:"Neptune", pluto:"Pluto",
};

const SIGN_NAMES_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
const SIGN_NAMES_EN = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

const HOUSE_NAMES_FR = ["Soi","Ressources","Communic.","Foyer","Créativité","Santé","Partenariats","Transfo.","Philo.","Carrière","Amitiés","Secret"];
const HOUSE_NAMES_EN = ["Self","Resources","Comm.","Home","Creativity","Health","Partners","Transfo.","Philo.","Career","Friends","Secrets"];

function formatLongitude(lon: number, locale: string): string {
  const signIdx = Math.floor(lon / 30) % 12;
  const degInSign = lon % 30;
  const deg = Math.floor(degInSign);
  const min = Math.floor((degInSign - deg) * 60);
  const signs = locale === "en" ? SIGN_NAMES_EN : SIGN_NAMES_FR;
  return `${deg}°${min.toString().padStart(2, "0")}′ ${signs[signIdx]}`;
}

function dictToWheelPlanets(dict: any): WheelPlanet[] {
  if (!dict) return [];
  return Object.entries(dict).map(([key, p]: [string, any]) => ({
    name: key,
    glyph: PLANET_GLYPHS[key] ?? key[0]!.toUpperCase(),
    longitude: p?.longitude ?? 0,
    retrograde: !!p?.retrograde,
    color: PLANET_COLORS[key],
  }));
}

export default function TransitsPage() {
  const { accessToken } = useAuth();
  const { locale } = useApp();
  const t = useT();
  const [natalId, setNatalId] = useState<string | null>(null);

  const { data: profilesRes } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const profiles = (profilesRes as any)?.data?.profiles ?? [];

  // Auto-sélection du premier profil natal.
  // (Remplace le callback onSuccess, supprimé en react-query v5.)
  useEffect(() => {
    if (profiles.length > 0 && !natalId) setNatalId(profiles[0].id);
  }, [profiles, natalId]);

  const { data: trRes, isLoading } = useQuery({
    queryKey: ["transits", natalId, locale],
    queryFn: () => apiClient.get(`/transits/current/${natalId}?locale=${locale}`, accessToken!),
    enabled: !!accessToken && !!natalId,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const data = (trRes as any)?.data;

  const natalPlanets    = useMemo(() => dictToWheelPlanets(data?.natal?.planets),    [data?.natal?.planets]);
  const transitPlanets  = useMemo(() => dictToWheelPlanets(data?.transits?.planets), [data?.transits?.planets]);

  const selectedProfile = profiles.find((p: any) => p.id === natalId);
  const pname = (key: string) =>
    (locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR)[key.toLowerCase()] ?? key;

  const now = data?.date ? new Date(data.date) : new Date();
  const dateStr = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const timeStr = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  if (profiles.length === 0) {
    return (
      <div className="page-root">
        <div className="empty-state animate-fade-up">
          <div className="ico">↻</div>
          <p className="msg">{t("transits_no_profile")}</p>
          <Link href="/dashboard/natal" className="btn-ghost" style={{ marginTop: 16 }}>
            {t("home_create_profile")} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div className="animate-fade-up" style={{ textAlign: "center", marginBottom: 14 }}>
        <div className="section-title" style={{ fontSize: 18, marginBottom: 4 }}>
          {t("transits_title")} ↻
        </div>
        <div style={{
          fontSize: 11.5, color: "var(--muted)",
          textTransform: "capitalize", letterSpacing: .3,
        }}>
          {dateStr} · {timeStr}
        </div>
      </div>

      {profiles.length > 1 && (
        <div style={{ marginBottom: 14 }} className="animate-fade-up delay-100">
          <label className="form-label">{t("horoscope_profile")}</label>
          <select value={natalId ?? ""} onChange={e => setNatalId(e.target.value)}>
            {profiles.map((p: any) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading && (
        <div className="flex-center" style={{ padding: 50 }}>
          <div className="spinner" />
        </div>
      )}

      {data && (
        <>
          {/* Stats */}
          <div className="animate-fade-up delay-100"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            <StatCard value={data.aspectsCount} label={t("transits_aspects_active")} />
            <StatCard value={data.exactAspectsCount} label={t("transits_exact")} highlight={data.exactAspectsCount > 0} />
            <StatCard value={(data.transits?.retrogrades ?? []).length} label={t("transits_retrogrades")} />
          </div>

          {/* Alertes */}
          {data.alerts && data.alerts.length > 0 && (
            <div className="animate-fade-up delay-150" style={{ marginBottom: 14 }}>
              {data.alerts.map((alert: string, i: number) => (
                <div key={i} className="alert-banner">
                  <span className="ab-ico">⟲</span>
                  <span>{alert}</span>
                </div>
              ))}
            </div>
          )}

          {/* Phase lunaire */}
          {data.transits?.moonPhase && (
            <div className="moon-phase animate-fade-up delay-200">
              <span className="ico">{data.transits.moonPhase.emoji}</span>
              <div>
                <p className="name">{data.transits.moonPhase.phase}</p>
                <p className="desc">{data.transits.moonPhase.description}</p>
              </div>
            </div>
          )}

          {/* Bi-wheel */}
          <div className="animate-fade-up delay-200" style={{ marginBottom: 18 }}>
            <ZodiacWheel
              planets={natalPlanets}
              transitPlanets={transitPlanets}
              ascendant={data.natal?.asc ?? 0}
              showHouses={true}
              showAspects={true}
              showPlanets={true}
              chartName={`Transits · ${selectedProfile?.label ?? ""}`}
            />
          </div>

          <div className="sep" />

          {/* Aspects actifs */}
          <div className="section-title">
            {t("transits_aspects_title")}
            <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 6 }}>
              ({data.aspectsCount})
            </span>
          </div>
          {data.aspects && data.aspects.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.aspects.map((asp: any, i: number) => (
                <AspectRow key={i} asp={asp} locale={locale} pname={pname} />
              ))}
            </div>
          ) : (
            <p style={{
              color: "var(--muted)", fontSize: 12.5,
              textAlign: "center", padding: "20px 0",
              fontStyle: "italic",
            }}>
              {t("transits_no_aspects")}
            </p>
          )}

          <div className="sep" />

          {/* Ciel du moment */}
          <div className="section-title">{t("transits_sky_now")}</div>
          <div className="card" style={{ padding: 0 }}>
            {transitPlanets.map(p => (
              <div key={p.name} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 14px",
                borderBottom: "1px solid var(--border-soft)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    color: p.color ?? "var(--gold)",
                    fontSize: 16, width: 22, textAlign: "center",
                  }}>
                    {p.glyph}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--star)" }}>
                    {pname(p.name)}
                  </span>
                  {/* PATCH-UX-RETROGRADE-VISIBILITY-V1 : badge rétrograde visible + tooltip pédagogique */}
                  {p.retrograde && (
                    <span
                      title="Rétrograde — énergie tournée vers l\'intérieur, introspection sur le domaine de cette planète"
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--tension)",
                        background: "rgba(229,69,69,.1)",
                        border: "1px solid rgba(229,69,69,.25)",
                        padding: "1px 6px",
                        borderRadius: 999,
                        letterSpacing: ".3px",
                        cursor: "help",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ℞ Rétro
                    </span>
                  )}
                </div>
                <span style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  color: "var(--gold)",
                }}>
                  {formatLongitude(p.longitude, locale)}
                </span>
              </div>
            ))}
          </div>

          {/* Maisons activées */}
          {data.houseActivations && Object.keys(data.houseActivations).length > 0 && (
            <>
              <div className="sep" />
              <div className="section-title">{t("transits_houses_active")}</div>
              <div className="houses-grid">
                {Object.entries(data.houseActivations)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([houseNum, planetKeys]: [string, any]) => {
                    const n = parseInt(houseNum);
                    const names = locale === "en" ? HOUSE_NAMES_EN : HOUSE_NAMES_FR;
                    return (
                      <div key={houseNum} className="house-card" style={{
                        gridColumn: "span 2",
                        padding: "8px 10px",
                        textAlign: "left",
                      }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 6, marginBottom: 3,
                        }}>
                          <span className="h-num">{n}</span>
                          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
                            · {names[n - 1]}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(planetKeys as string[]).map(pk => (
                            <span key={pk} style={{
                              fontSize: 13,
                              color: PLANET_COLORS[pk] ?? "var(--gold)",
                            }}>
                              {PLANET_GLYPHS[pk] ?? "·"}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ value, label, highlight = false }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className={`card${highlight ? " card-gold" : ""}`} style={{
      textAlign: "center",
      padding: "12px 8px",
    }}>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 26, color: "var(--gold)",
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 9,
        color: "var(--muted)",
        textTransform: "uppercase",
        letterSpacing: .5,
        marginTop: 5,
      }}>
        {label}
      </div>
    </div>
  );
}

function AspectRow({ asp, locale, pname }: { asp: any; locale: string; pname: (k: string) => string }) {
  const toneClass = asp.tone === "harmony" ? "pill-h" : asp.tone === "tension" ? "pill-t" : "pill-n";
  const tColor = PLANET_COLORS[asp.transitPlanet] ?? "var(--star)";
  const nColor = PLANET_COLORS[asp.natalPlanet]   ?? "var(--star)";
  const typeName = locale === "en" ? asp.type : asp.typeFr;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 12px",
      borderRadius: "var(--r-md)",
      background: asp.exact ? "rgba(201,168,76,.08)" : "var(--card-bg)",
      border: `1px solid ${asp.exact ? "var(--border)" : "var(--card-border)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 72 }}>
        <span style={{ color: tColor, fontSize: 14 }}>{PLANET_GLYPHS[asp.transitPlanet]}</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{pname(asp.transitPlanet).slice(0, 3)}</span>
      </div>
      <span style={{
        fontSize: 15, fontWeight: 600,
        color: asp.tone === "harmony" ? "var(--harmony)" : asp.tone === "tension" ? "var(--tension)" : "var(--gold)",
        minWidth: 20, textAlign: "center",
      }}>
        {asp.symbol}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 72 }}>
        <span style={{ color: nColor, fontSize: 14 }}>{PLANET_GLYPHS[asp.natalPlanet]}</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{pname(asp.natalPlanet).slice(0, 3)}</span>
      </div>
      <div style={{ flex: 1, textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        <span className={`pill ${toneClass}`} style={{ fontSize: 9, padding: "1px 8px", textTransform: "lowercase" }}>
          {typeName}
        </span>
        <span style={{
          fontSize: 10,
          color: asp.exact ? "var(--gold)" : "var(--muted)",
          fontFamily: "var(--font-mono)",
          fontWeight: asp.exact ? 600 : 400,
          minWidth: 32,
          textAlign: "right",
        }}>
          {asp.orb.toFixed(1)}°
        </span>
      </div>
    </div>
  );
}

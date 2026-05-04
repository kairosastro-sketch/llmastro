"use client";

// ARCHIVE-2C-CLIENT-CHART-UNWRAP-V1
// La route POST /ephemeris/calculate renvoie { success, data: { chart, cached } }
// Le client doit donc lire .data.chart (pas .data) pour obtenir le thème natal.

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, apiClient, ephemerisApi } from "@/lib/api/client";
import { useT, useApp } from "@/lib/i18n";
import { NatalForm } from "@/components/natal/NatalForm";

import { AstroText } from "@/components/ui/AstroText";
import { KairosTrace } from "@/components/kairos/KairosTrace";
// ──────────────────────────────────────────────────────────
// Base de villes (coordonnées + timezone)
// Le backend a besoin de lat/lng/tz pour calculer le thème,
// le `birthCity` seul ne suffit pas.
// ──────────────────────────────────────────────────────────


// ──────────────────────────────────────────────────────────
// Constantes astro
// ──────────────────────────────────────────────────────────
const SIGN_GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
const SIGN_NAMES_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
const SIGN_NAMES_EN = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

const PLANET_KEYS = ["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto"] as const;
const PLANET_GLYPHS: Record<string,string> = {
  sun:"☉", moon:"☽", mercury:"☿", venus:"♀", mars:"♂",
  jupiter:"♃", saturn:"♄", uranus:"♅", neptune:"♆", pluto:"♇",
};
const PLANET_NAMES_FR: Record<string,string> = {
  sun:"Soleil", moon:"Lune", mercury:"Mercure", venus:"Vénus", mars:"Mars",
  jupiter:"Jupiter", saturn:"Saturne", uranus:"Uranus", neptune:"Neptune", pluto:"Pluton",
};
const PLANET_NAMES_EN: Record<string,string> = {
  sun:"Sun", moon:"Moon", mercury:"Mercury", venus:"Venus", mars:"Mars",
  jupiter:"Jupiter", saturn:"Saturn", uranus:"Uranus", neptune:"Neptune", pluto:"Pluto",
};

const HOUSE_NAMES_FR = ["Soi","Biens","Communic.","Foyer","Créativ.","Santé","Union","Transfo.","Philo.","Carrière","Amitiés","Épreuves"];
const HOUSE_NAMES_EN = ["Self","Assets","Comm.","Home","Creat.","Health","Union","Transfo.","Philo.","Career","Friends","Trials"];

const ELEMENTS = [
  { key: "fire",  emoji: "🔥", labelFr: "Feu",   labelEn: "Fire",  color: "#e54545" },
  { key: "earth", emoji: "🌱", labelFr: "Terre", labelEn: "Earth", color: "#3ecf8e" },
  { key: "air",   emoji: "💨", labelFr: "Air",   labelEn: "Air",   color: "#60a5fa" },
  { key: "water", emoji: "💧", labelFr: "Eau",   labelEn: "Water", color: "#818cf8" },
];

const SIGN_ELEMENT: Record<number, "fire"|"earth"|"air"|"water"> = {
  0:"fire",4:"fire",8:"fire",
  1:"earth",5:"earth",9:"earth",
  2:"air",6:"air",10:"air",
  3:"water",7:"water",11:"water",
};

const ASPECT_SYMBOLS: Record<string,string> = {
  conjunction:"☌", sextile:"⚹", square:"□", trine:"△", opposition:"☍", quincunx:"⚻",
};
const ASPECT_TONES: Record<string,"h"|"t"|"n"> = {
  conjunction:"n", sextile:"h", square:"t", trine:"h", opposition:"t", quincunx:"n",
};

// ══════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════════════════
export default function NatalPage() {
  const { accessToken } = useAuth();
  const t = useT();
  const [showForm, setShowForm] = useState(false);
  const [natalId, setNatalId]   = useState<string | null>(null);

  const { data: profilesRes } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const profiles = (profilesRes as any)?.data?.profiles ?? [];

  // Auto-sélection du premier profil (remplace onSuccess de react-query v4).
  useEffect(() => {
    if (profiles.length > 0 && !natalId) setNatalId(profiles[0].id);
  }, [profiles, natalId]);

  if (profiles.length === 0 && !showForm) {
    return (
      <div className="page-root">
        <div className="empty-state animate-fade-up">
          <div className="ico">🌌</div>
          <p className="msg">{t("natal_empty")}</p>
          <button className="btn-ob" style={{ marginTop: 20, maxWidth: 280 }} onClick={() => setShowForm(true)}>
            {t("natal_new")} ✦
          </button>
        </div>
      </div>
    );
  }

  if (showForm) {
    return <NatalForm mode="create" onCancel={() => setShowForm(false)} onSuccess={(p: { id: string }) => { setNatalId(p.id); setShowForm(false); }} />;
  }

  return (
    <NatalDetail
      profiles={profiles}
      natalId={natalId}
      onSelect={setNatalId}
      onNew={() => setShowForm(true)}
    />
  );
}

// ══════════════════════════════════════════════════════════
// DETAIL — (avec profil psy IA "Kairos")
// ══════════════════════════════════════════════════════════
function NatalDetail({ profiles, natalId, onSelect, onNew }: {
  profiles: any[]; natalId: string | null; onSelect: (id: string) => void; onNew: () => void;
}) {
  const { accessToken } = useAuth();
  const { locale } = useApp();
  const t = useT();
  const qc = useQueryClient();

  const profile = profiles.find(p => p.id === natalId) ?? profiles[0];

  // NATAL-MAIN-PAGE-EXPAND-V1 : state local pour house system + mode édition
  const fr = locale === "fr";
  const [houseSystem, setHouseSystem] = useState<"P" | "K" | "W">("P");
  const [editMode, setEditMode] = useState(false);

  const { data: chartRes, isLoading } = useQuery({
    queryKey: ["chart", natalId, houseSystem],
    queryFn: () => ephemerisApi.calculate(accessToken!, natalId!, houseSystem),
    enabled: !!accessToken && !!natalId,
  });

  const deleteMut = useMutation({
    mutationFn: () => natalApi.delete(accessToken!, natalId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["natal"] });
      qc.invalidateQueries({ queryKey: ["chart"] });
    },
  });

  const chart = (chartRes as any)?.data?.chart;

  const elementCounts = { fire: 0, earth: 0, air: 0, water: 0 };
  if (chart?.planets) {
    for (const key of PLANET_KEYS) {
      const p = (chart.planets as any)[key];
      if (p?.signIdx !== undefined) {
        const elem = SIGN_ELEMENT[p.signIdx];
        if (elem) elementCounts[elem]++;
      }
    }
  }
  const totalPlanets = PLANET_KEYS.length;

  // NATAL-MAIN-PAGE-EXPAND-V1 : Mode édition — remplace l'affichage du
  // thème par NatalForm pré-rempli. Cancel ou onSuccess revient en view.
  if (editMode && profile) {
    return (
      <div className="page-root">
        <NatalForm
          key={profile.id}
          mode="edit"
          initialProfile={{
            id:                 profile.id,
            label:              profile.label ?? "",
            birthDate:          profile.birthDate ?? "",
            birthTime:          profile.birthTime ?? "12:00",
            birthCity:          profile.birthCity ?? "",
            // NATAL-FORM-UX-POLISH-V1 : champs nécessaires pour
            // pré-remplir selectedCity en mode édition.
            latitude:           profile.latitude,
            longitude:          profile.longitude,
            timezone:           profile.timezone,
            birthTimeUnknown:   profile.birthTimeUnknown ?? false,
            gender:             profile.gender ?? "unspecified",
            relationshipStatus: profile.relationshipStatus ?? "unspecified",
          }}
          onCancel={() => setEditMode(false)}
          onSuccess={() => setEditMode(false)}
        />
      </div>
    );
  }

  return (
    <div className="page-root">
      <div className="animate-fade-up" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {profiles.length > 1 ? (
          <select value={natalId ?? ""} onChange={e => onSelect(e.target.value)} style={{ flex: 1 }}>
            {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.label ?? p.name}</option>)}
          </select>
        ) : (
          <div style={{
            flex: 1, padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--card-bg)", border: "1px solid var(--card-border)",
            fontSize: 14, color: "var(--star)", fontFamily: "var(--font-display)",
          }}>
            {profile?.label ?? profile?.name}
          </div>
        )}
        <button className="btn-ghost" onClick={onNew} title={t("natal_new")}>+</button>
      </div>

      {/* NATAL-MAIN-PAGE-EXPAND-V1 : barre d'actions secondaire */}
      <div className="animate-fade-up" style={{
        display: "flex", gap: 8, marginBottom: 14,
        flexWrap: "wrap", alignItems: "center",
      }}>
        <select
          value={houseSystem}
          onChange={e => setHouseSystem(e.target.value as "P" | "K" | "W")}
          style={{ flex: "0 1 auto", minWidth: 160, fontSize: 13, padding: "8px 12px" }}
          title={fr ? "Système de maisons" : "House system"}
        >
          <option value="P">{fr ? "Maisons : Placidus" : "Houses: Placidus"}</option>
          <option value="K">{fr ? "Maisons : Koch" : "Houses: Koch"}</option>
          <option value="W">{fr ? "Maisons : Signes entiers" : "Houses: Whole signs"}</option>
        </select>

        <button
          type="button"
          onClick={() => setEditMode(true)}
          className="btn-ghost"
          style={{ fontSize: 13, padding: "8px 14px" }}
          disabled={!profile}
        >
          ✎ {fr ? "Modifier" : "Edit"}
        </button>

        {natalId && (
          <Link
            href={`/dashboard/natal/${natalId}/sheet`}
            className="btn-ghost"
            style={{
              fontSize: 13,
              padding: "8px 14px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            📄 {fr ? "Fiche" : "Sheet"}
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="flex-center" style={{ padding: 50 }}><div className="spinner" /></div>
      )}

      {chart && (
        <>
          <div className="section-title" style={{ textAlign: "center", fontSize: 18, marginBottom: 6 }}>
            {t("natal_title")}
          </div>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <Link href="/dashboard/wheel" className="pill-gold"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
              <span className="pill-dot" /> <span>{t("natal_wheel")} ◎</span>
            </Link>
          </div>

          {chart.planets && <MiniNatalSVG planets={chart.planets} ascendant={chart.asc ?? 0} />}

          <div className="section-title" style={{ marginTop: 20 }}>{t("natal_positions")}</div>
          <div className="card" style={{ padding: "10px 14px" }}>
            <table className="planet-table">
              <thead>
                <tr>
                  <th></th>
                  <th>{locale === "en" ? "Planet" : "Planète"}</th>
                  <th>{locale === "en" ? "Sign" : "Signe"}</th>
                  <th style={{ textAlign: "right" }}>°</th>
                </tr>
              </thead>
              <tbody>
                {PLANET_KEYS.map(key => {
                  const p = (chart.planets as any)[key];
                  if (!p) return null;
                  const names = locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR;
                  const signs = locale === "en" ? SIGN_NAMES_EN : SIGN_NAMES_FR;
                  const deg = Math.floor(p.degree ?? 0);
                  const min = Math.floor(((p.degree ?? 0) - deg) * 60);
                  return (
                    <tr key={key}>
                      <td>{PLANET_GLYPHS[key]}</td>
                      <td>
                        {names[key]}
                        {/* PATCH-UX-RETROGRADE-VISIBILITY-V1 : badge rétrograde visible + tooltip pédagogique */}
                        {p.retrograde && (
                          <span
                            title="Rétrograde — énergie tournée vers l\'intérieur, introspection sur le domaine de cette planète"
                            style={{
                              marginLeft: 6,
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
                      </td>
                      <td style={{ color: "var(--gold)", fontSize: 11.5 }}>{signs[p.signIdx] ?? "—"}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                        {deg}°{min.toString().padStart(2,"0")}′
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sep" />

          <div className="section-title">{t("natal_elements")}</div>
          <div className="elem-grid">
            {ELEMENTS.map(el => {
              const count = (elementCounts as any)[el.key];
              const pct = Math.round((count / totalPlanets) * 100);
              return (
                <div key={el.key} className="elem-col">
                  <div className="e-ico">{el.emoji}</div>
                  <div className="e-lbl">{locale === "en" ? el.labelEn : el.labelFr}</div>
                  <div className="e-bar-wrap">
                    <div className="e-bar" style={{ height: `${pct}%`, background: el.color, opacity: .85 }} />
                  </div>
                  <div className="e-val">{count}</div>
                </div>
              );
            })}
          </div>

          <div className="sep" />

          {chart.houses && chart.houses.length === 12 && (
            <>
              <div className="section-title">{t("natal_houses")}</div>
              <div className="houses-grid">
                {chart.houses.map((h: any, i: number) => {
                  const lon = h.longitude ?? h;
                  const signIdx = Math.floor(lon / 30) % 12;
                  const names = locale === "en" ? HOUSE_NAMES_EN : HOUSE_NAMES_FR;
                  return (
                    <div key={i} className="house-card">
                      <div className="h-num">{i + 1}</div>
                      <div className="h-ico" style={{ color: "var(--gold)" }}>{SIGN_GLYPHS[signIdx]}</div>
                      <div className="h-name">{names[i]}</div>
                    </div>
                  );
                })}
              </div>
              <div className="sep" />
            </>
          )}

          {chart.aspects && chart.aspects.length > 0 && (
            <>
              <div className="section-title">
                {t("natal_aspects")}
                <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 6 }}>({chart.aspects.length})</span>
              </div>
              <div className="aspect-list">
                {chart.aspects.slice(0, 18).map((asp: any, i: number) => {
                  const tone = ASPECT_TONES[asp.type] ?? "n";
                  const sym  = ASPECT_SYMBOLS[asp.type] ?? "·";
                  const p1 = asp.planet1 ?? asp.p1;
                  const p2 = asp.planet2 ?? asp.p2;
                  return (
                    <span key={i} className={`pill pill-${tone}`} style={{ fontSize: 11.5, padding: "4px 10px" }}>
                      <span>{PLANET_GLYPHS[p1] ?? p1}</span>
                      <span style={{ fontWeight: 600 }}>{sym}</span>
                      <span>{PLANET_GLYPHS[p2] ?? p2}</span>
                    </span>
                  );
                })}
              </div>
              <div className="sep" />
            </>
          )}

          {chart.numerology !== undefined && chart.numerology !== null && (
            <>
              <div className="section-title">{t("natal_numerology")}</div>
              <div className="numero-box">
                <div className="numero-num">{chart.numerology}</div>
                <div className="numero-label">
                  {locale === "en" ? "Life Path Number" : "Chemin de vie"}
                </div>
                <div className="numero-desc">
                  {getNumerologyDescription(chart.numerology, locale)}
                </div>
              </div>
              <div className="sep" />
            </>
          )}

          {natalId && <AiPsychProfile natalId={natalId} chart={chart} />}

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button className="btn-danger"
              onClick={() => {
                if (window.confirm(locale === "en" ? "Delete this profile?" : "Supprimer ce profil ?")) {
                  deleteMut.mutate();
                }
              }}>
              ⎋ {t("natal_delete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PATCH-KAIROS-NAMING-AND-JPL-V1 : commentaire nettoyé
// PROFIL PSYCHO IA — Kairos
// ══════════════════════════════════════════════════════════
interface AiProfile {
  essence:       string;
  strengths:     string[];
  challenges:    string[];
  relationships: string;
  careerPath:    string;
  shadow:        string;
  integration:   string;
}

function AiPsychProfile({ natalId, chart }: { natalId: string; chart?: any }) {
  const { accessToken } = useAuth();
  const { locale } = useApp();
  const t = useT();

  // HOTFIX-NATAL-PROFILE-V1 : durcir la query pour éviter les double POST qui
  // déclencheraient des appels superflus (le backend est déjà protégé côté cache,
  // mais autant limiter le trafic réseau et les "Kairos silent" transitoires).
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["ai-profile", natalId, locale],
    queryFn: () => apiClient.post("/ai/natal-profile", { natalId, locale }, accessToken!),
    enabled: !!accessToken && !!natalId,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const profile: AiProfile | null = (data as any)?.data ?? null;

  return (
    <>
      <div className="section-title">
        {t("natal_psycho")}
        <span className="pill" style={{ marginLeft: 8, background: "rgba(91,138,240,.12)", color: "var(--info)", fontSize: 9 }}>
          Kairos
        </span>
      </div>

      {(isLoading || isRefetching) && !profile && (
        <div className="flex-center" style={{ padding: 30 }}>
          <div className="spinner" />
        </div>
      )}

      {isError && !profile && (
        <div className="alert-banner" style={{
          background: "rgba(229,69,69,.08)", borderColor: "rgba(229,69,69,.25)", color: "var(--tension)",
        }}>
          <span className="ab-ico">⚠</span>
          <span>
            {locale === "en" ? "Kairos is silent. " : "Kairos reste silencieux. "}
            <button onClick={() => refetch()} style={{ textDecoration: "underline", color: "inherit", background: "transparent" }}>
              {locale === "en" ? "Retry" : "Réessayer"}
            </button>
          </span>
        </div>
      )}

      {profile && (
        <div className="animate-fade-up">
          {profile.essence && <div className="oracle">« <AstroText>{profile.essence}</AstroText> »</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
            {profile.strengths?.length > 0 && (
              <div className="card">
                <div style={{ color: "var(--harmony)", fontSize: 11, textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>
                  {locale === "en" ? "Strengths" : "Forces"}
                </div>
                <ul style={{ listStyle: "none", padding: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                  {profile.strengths.map((s, i) => (
                    <li key={i} style={{ marginBottom: 4, paddingLeft: 12, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "var(--harmony)" }}>✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.challenges?.length > 0 && (
              <div className="card">
                <div style={{ color: "var(--tension)", fontSize: 11, textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>
                  {locale === "en" ? "Challenges" : "Défis"}
                </div>
                <ul style={{ listStyle: "none", padding: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                  {profile.challenges.map((c, i) => (
                    <li key={i} style={{ marginBottom: 4, paddingLeft: 12, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "var(--tension)" }}>△</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {profile.relationships && (
            <div className="card" style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>
                ♡ {locale === "en" ? "Relationships" : "Relations"}
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 12.5, lineHeight: 1.65 }}><AstroText>{profile.relationships}</AstroText></p>
            </div>
          )}

          {profile.careerPath && (
            <div className="card" style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>
                ♃ {locale === "en" ? "Vocation" : "Vocation"}
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 12.5, lineHeight: 1.65 }}><AstroText>{profile.careerPath}</AstroText></p>
            </div>
          )}

          {profile.shadow && (
            <div className="card" style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>
                ☾ {locale === "en" ? "Shadow" : "Ombre"}
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 12.5, lineHeight: 1.65 }}><AstroText>{profile.shadow}</AstroText></p>
            </div>
          )}

          {profile.integration && (
            <div className="card card-gold" style={{ marginTop: 10, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                {locale === "en" ? "Integration" : "Intégration"}
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 13, lineHeight: 1.6, color: "var(--star)" }}>
                <AstroText>{profile.integration}</AstroText>
              </p>
            </div>
          )}

          {/* TRACE KAIROS — show your work : disclaimer + sources + données */}
          <KairosTrace
            readingKind="natal-profile"
            natal={chart}
            birthTimeKnown={(data as any)?.meta?.birthTimeKnown ?? true}
            natalId={natalId}
            locale={locale}
            hasReading={!!profile}
            aspectTypes={(chart?.aspects ?? []).map((a: any) => a.type).filter((t: any): t is string => typeof t === "string")}
          />
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
function MiniNatalSVG({ planets, ascendant = 0 }: { planets: any; ascendant?: number }) {
  const size = 260;
  const cx = size / 2, cy = size / 2;
  const rOuter = 120, rInner = 100, rPlanet = 82, rGlyph = 110;

  const lonToXY = (lon: number, r: number) => {
    const theta = ((180 - lon) * Math.PI) / 180;
    return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
  };

  return (
    <div className="natal-svg-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="mn-bg">
            <stop offset="0%" stopColor="var(--bg-2)" stopOpacity=".4" />
            <stop offset="100%" stopColor="var(--bg)" stopOpacity=".1" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={rOuter} fill="url(#mn-bg)" />
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--border)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="var(--border-soft)" strokeWidth=".8" />

        {Array.from({ length: 12 }, (_, i) => {
          const lonMid = i * 30 + 15;
          const pos = lonToXY(lonMid, rGlyph);
          const p1 = lonToXY(i * 30, rInner);
          const p2 = lonToXY(i * 30, rOuter);
          return (
            <g key={i}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--border-soft)" strokeWidth=".5" />
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="var(--gold)" opacity=".7">
                {SIGN_GLYPHS[i]}
              </text>
            </g>
          );
        })}

        {PLANET_KEYS.slice(0, 7).map(key => {
          const p = planets[key];
          if (!p) return null;
          const pos = lonToXY(p.longitude ?? 0, rPlanet);
          return (
            <g key={key}>
              <circle cx={pos.x} cy={pos.y} r="9" fill="var(--bg-2)" fillOpacity=".8" />
              <circle cx={pos.x} cy={pos.y} r="9" fill="none" stroke="var(--gold)" strokeWidth=".6" />
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="var(--gold)">
                {PLANET_GLYPHS[key]}
              </text>
            </g>
          );
        })}

        {(() => {
          const pos = lonToXY(ascendant, rOuter - 10);
          return (
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize="8" fill="var(--gold)" fontWeight="700">
              ASC
            </text>
          );
        })()}

        <circle cx={cx} cy={cy} r="30" fill="var(--bg-2)" fillOpacity=".85" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="22" fill="var(--gold)" opacity=".4">✦</text>
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
function getNumerologyDescription(n: number, locale: string): string {
  const desc: Record<number, { fr: string; en: string }> = {
    1:  { fr: "Leader, pionnier, indépendant.", en: "Leader, pioneer, independent." },
    2:  { fr: "Diplomate, sensible, coopératif.", en: "Diplomat, sensitive, cooperative." },
    3:  { fr: "Créatif, expressif, communicateur.", en: "Creative, expressive, communicator." },
    4:  { fr: "Bâtisseur, discipliné, stable.", en: "Builder, disciplined, stable." },
    5:  { fr: "Aventurier, libre, polyvalent.", en: "Adventurer, free, versatile." },
    6:  { fr: "Protecteur, responsable, esthète.", en: "Protector, responsible, aesthete." },
    7:  { fr: "Chercheur, mystique, analytique.", en: "Seeker, mystic, analytical." },
    8:  { fr: "Ambitieux, puissant, matériel.", en: "Ambitious, powerful, material." },
    9:  { fr: "Universaliste, généreux, sage.", en: "Universalist, generous, wise." },
    11: { fr: "Maître visionnaire. Intuition amplifiée.", en: "Master visionary. Heightened intuition." },
    22: { fr: "Maître bâtisseur à grande échelle.", en: "Master builder at scale." },
  };
  const e = desc[n];
  if (!e) return "";
  return locale === "en" ? e.en : e.fr;
}

/* PATCH-MENAGE-V1 hide-silent-on-tier */

// PATCH-ASTRO-TOOLTIPS-V1 applied (natal)

// ARCHIVE-KAIROS-TRACE-NATAL-PROFILE-V1 applied

// NATAL-FORM-CONTRACT-V1 applied

// NATAL-MAIN-PAGE-EXPAND-V1 applied

// NATAL-FORM-UX-POLISH-V1 applied

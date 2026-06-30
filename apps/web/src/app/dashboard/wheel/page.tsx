"use client";

// ARCHIVE-2C-CLIENT-CHART-UNWRAP-V1
// La route POST /ephemeris/calculate renvoie { success, data: { chart, cached } }
// Le client doit donc lire .data.chart (pas .data) pour obtenir le thème natal.

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, apiClient, ephemerisApi } from "@/lib/api/client";
import { ZodiacWheel, type WheelPlanet } from "@/components/ui/ZodiacWheel";
import { useT } from "@/lib/i18n";

const PLANET_COLORS: Record<string, string> = {
  sun: "#d4a843", moon: "#b0adc8", mercury: "#60a5fa", venus: "#e879a8",
  mars: "#f87171", jupiter: "#34d399", saturn: "#a78bfa",
  uranus: "#67e8f9", neptune: "#818cf8", pluto: "#c4b5fd",
};
const PLANET_GLYPHS: Record<string, string> = {
  sun:"☉", moon:"☽", mercury:"☿", venus:"♀", mars:"♂",
  jupiter:"♃", saturn:"♄", uranus:"♅", neptune:"♆", pluto:"♇",
};

export default function WheelPage() {
  const { accessToken } = useAuth();
  const t = useT();
  const [natalId, setNatalId] = useState<string | null>(null);
  const [harmonic, setHarmonic] = useState(1);  // HARMONIQUES-V1

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

  const { data: chartRes } = useQuery({
    queryKey: ["chart", effectiveNatalId],
    queryFn: () => ephemerisApi.calculate(accessToken!, effectiveNatalId!),
    enabled: !!accessToken && !!effectiveNatalId,
  });

  const chart = (chartRes as any)?.data?.chart;

  const planets: WheelPlanet[] = chart?.planets
    ? Object.entries(chart.planets).map(([key, p]: [string, any]) => ({
        name: key,
        glyph: PLANET_GLYPHS[key] ?? key[0]!.toUpperCase(),
        longitude: p.longitude ?? 0,
        retrograde: !!p.retrograde,
        color: PLANET_COLORS[key],
      }))
    : [];

  // HARMONIQUES-V1 : thème harmonique d'ordre N — chaque planète est
  // projetée à (longitude × N) mod 360. N = 1 → thème natal inchangé.
  const HARMONIC_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const displayPlanets: WheelPlanet[] = harmonic === 1
    ? planets
    : planets.map(p => ({ ...p, longitude: (p.longitude * harmonic) % 360 }));

  const selectedProfile = profiles.find((p: any) => p.id === effectiveNatalId);

  if (profiles.length === 0) {
    return (
      <div className="page-root">
        <div className="empty-state animate-fade-up">
          <div className="ico">◎</div>
          <p className="msg">{t("wheel_no_data")}</p>
          <Link href="/dashboard/natal" className="btn-ghost" style={{ marginTop: 16 }}>
            {t("home_create_profile")} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root" style={{ maxWidth: 680 }}>
      <div className="section-title animate-fade-up" style={{ textAlign: "center", fontSize: 18, marginBottom: 4 }}>
        {t("wheel_title")} ◎
      </div>
      {selectedProfile && (
        <p style={{
          textAlign: "center",
          fontSize: 11.5,
          color: "var(--muted)",
          marginBottom: 16,
          letterSpacing: .3,
        }}>
          {selectedProfile.label}
        </p>
      )}

      {/* Sélecteur profil */}
      {profiles.length > 1 && (
        <div style={{ marginBottom: 16 }} className="animate-fade-up delay-100">
          <label className="form-label">{t("horoscope_profile")}</label>
          <select
            value={effectiveNatalId ?? ""}
            onChange={e => setNatalId(e.target.value)}
          >
            {profiles.map((p: any) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* HARMONIQUES-V1 : sélecteur d'harmonique */}
      <div style={{ marginBottom: 16 }} className="animate-fade-up delay-100">
        <label className="form-label">{t("wheel_harmonic_label")}</label>
        <select
          value={harmonic}
          onChange={e => setHarmonic(Number(e.target.value))}
        >
          {HARMONIC_OPTIONS.map(n => (
            <option key={n} value={n}>
              {n === 1 ? t("wheel_harmonic_natal") : `${t("wheel_harmonic_label")} ${n}`}
            </option>
          ))}
        </select>
      </div>

      <div className="animate-fade-up delay-150">
        <ZodiacWheel
          planets={displayPlanets.length > 0 ? displayPlanets : undefined}
          ascendant={harmonic === 1 ? (chart?.asc ?? 0) : 0}
          /* WHEEL-TRUE-MC-V1 : vraies cuspides (Placidus serveur) + vrai MC.
             Les harmoniques n'ont pas de domification → repli égal. */
          houses={harmonic === 1 ? chart?.houses : undefined}
          mc={harmonic === 1 ? chart?.mc : undefined}
          chartName={
            harmonic === 1
              ? (selectedProfile?.label ?? "Roue Zodiacale")
              : `${t("wheel_harmonic_label")} ${harmonic} · ${selectedProfile?.label ?? ""}`
          }
          showHouses={harmonic === 1}
          showAspects={true}
          showPlanets={true}
          showMinors={false}
        />
        {harmonic !== 1 && (
          <p style={{
            fontSize: 11.5,
            color: "var(--muted)",
            textAlign: "center",
            lineHeight: 1.55,
            marginTop: 12,
            maxWidth: 460,
            marginLeft: "auto",
            marginRight: "auto",
          }}>
            {t("wheel_harmonic_caption")}
          </p>
        )}
      </div>
    </div>
  );
}

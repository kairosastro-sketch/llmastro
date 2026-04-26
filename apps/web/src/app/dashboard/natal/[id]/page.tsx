"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, ephemerisApi } from "@/lib/api/client";

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
  NorthNode: "☊", Chiron: "⚷", Lilith: "⚸",
};

const SIGN_GLYPHS: Record<string, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋",
  Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏",
  Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

const ASPECT_GLYPHS: Record<string, string> = {
  conjunction: "☌", sextile: "⚹", square: "□",
  trine: "△", opposition: "☍", quincunx: "⚻",
};

const ASPECT_COLORS: Record<string, string> = {
  conjunction: "#d4a843", trine: "#34d399", sextile: "#60a5fa",
  square: "#f87171", opposition: "#e879a8", quincunx: "#a78bfa",
};

export default function NatalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [houseSystem, setHouseSystem] = useState<"P"|"K"|"W">("P");
  const [localChart, setLocalChart] = useState<any>(null);

  const { data: profileRes } = useQuery({
    queryKey: ["natal", id],
    queryFn: () => natalApi.get(accessToken!, id),
    enabled: !!accessToken,
  });

  const calcMutation = useMutation({
    mutationFn: () => ephemerisApi.calculate(accessToken!, id, houseSystem),
    onSuccess: (res: any) => {
      const chart = res?.data?.chart;
      if (chart) setLocalChart(chart);
      void qc.invalidateQueries({ queryKey: ["chart", id] });
    },
  });

  const { data: chartRes } = useQuery({
    queryKey: ["chart", id],
    queryFn: async () => {
      try { return await ephemerisApi.getChart(accessToken!, id); }
      catch { return null; }
    },
    enabled: !!accessToken && !localChart,
  });

  const profile = (profileRes as any)?.data?.profile;
  const chart = localChart ?? (chartRes as any)?.data?.chart;

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <button onClick={() => router.push("/dashboard/natal")}
            className="text-mist text-sm mb-3 flex items-center gap-1 hover:text-star transition-colors">
            ← Retour
          </button>
          <h1 className="font-display text-3xl text-star mb-1">{profile.label}</h1>
          <p className="text-mist text-sm">
            {profile.birthDate} · {profile.birthTimeUnknown ? "Heure inconnue" : profile.birthTime} · {profile.birthCity}, {profile.birthCountry}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={houseSystem} onChange={(e) => setHouseSystem(e.target.value as "P"|"K"|"W")}
            className="input-base text-sm py-2 w-36">
            <option value="P">Placidus</option>
            <option value="K">Koch</option>
            <option value="W">Signes entiers</option>
          </select>
          <button onClick={() => calcMutation.mutate()} disabled={calcMutation.isPending}
            className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
            {calcMutation.isPending ? "Calcul…" : chart ? "Recalculer" : "✦ Calculer"}
          </button>
        </div>
      </div>

      {!chart && !calcMutation.isPending && (
        <div className="glass rounded-2xl p-16 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="text-5xl mb-4">☽</div>
          <h2 className="font-display text-xl text-star mb-2">Thème non calculé</h2>
          <p className="text-mist text-sm mb-6">Cliquez sur "✦ Calculer" pour générer le thème natal complet</p>
        </div>
      )}

      {calcMutation.isPending && (
        <div className="glass rounded-2xl p-16 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="w-10 h-10 rounded-full border-2 border-gold border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-mist text-sm">Calcul en cours…</p>
        </div>
      )}

      {chart && !calcMutation.isPending && (
        <div className="space-y-6">

          <div className="glass rounded-2xl p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-5">
              <span className="flex items-center justify-center w-7 h-7 rounded-full text-sm"
                style={{ background: "var(--color-gold-glow)", border: "1px solid var(--border-gold)", color: "var(--color-gold)" }}>☉</span>
              <h2 className="font-display text-base text-star">Positions planétaires</h2>
              {/* PATCH-KAIROS-NAMING-AND-JPL-V1 : tooltip trust-signal JPL NASA */}
              <span
                title="Positions calculées avec Swiss Ephemeris · tables JPL de la NASA"
                style={{
                  fontSize: 11,
                  color: "var(--color-mist)",
                  cursor: "help",
                  opacity: 0.6,
                  marginLeft: 4,
                }}
              >
                ⓘ
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    {["Planète","Signe","Degré","Maison","Statut"].map(h => (
                      <th key={h} className="text-left pb-3 pr-6 font-medium"
                        style={{ color: "var(--color-mist)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.planets?.map((p: any) => (
                    <tr key={p.planet} className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="py-3 pr-6 font-medium text-star">{PLANET_GLYPHS[p.planet] ?? ""} {p.planet}</td>
                      <td className="py-3 pr-6 text-mist">{SIGN_GLYPHS[p.sign] ?? ""} {p.sign}</td>
                      <td className="py-3 pr-6 font-mono text-mist text-xs">{p.signDegree?.toFixed(2)}°</td>
                      <td className="py-3 pr-6">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium"
                          style={{ background: "var(--color-gold-glow)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }}>
                          {p.house}
                        </span>
                      </td>
                      <td className="py-3">
                        {p.retrograde
                          ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-error)" }}>℞ Rétrograde</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "var(--color-success)" }}>Direct</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {chart.houses?.length > 0 && (
            <div className="glass rounded-2xl p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-5">
                <span className="flex items-center justify-center w-7 h-7 rounded-full text-sm"
                  style={{ background: "var(--color-gold-glow)", border: "1px solid var(--border-gold)", color: "var(--color-gold)" }}>⊕</span>
                <h2 className="font-display text-base text-star">Maisons</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {chart.houses.map((h: any) => (
                  <div key={h.house} className="rounded-lg px-3 py-2.5"
                    style={{ background: "rgba(7,7,15,0.6)", border: "1px solid var(--border-subtle)" }}>
                    <div className="text-xs text-mist mb-0.5">Maison {h.house}</div>
                    <div className="text-sm text-star font-medium">{SIGN_GLYPHS[h.sign] ?? ""} {h.sign}</div>
                    <div className="text-xs font-mono" style={{ color: "var(--color-fade)" }}>{h.signDegree?.toFixed(1)}°</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chart.aspects?.length > 0 && (
            <div className="glass rounded-2xl p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-5">
                <span className="flex items-center justify-center w-7 h-7 rounded-full text-sm"
                  style={{ background: "var(--color-gold-glow)", border: "1px solid var(--border-gold)", color: "var(--color-gold)" }}>✦</span>
                <h2 className="font-display text-base text-star">Aspects principaux</h2>
              </div>
              <div className="space-y-1">
                {chart.aspects.slice(0, 15).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 py-2 border-b text-sm"
                    style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-star w-28">{PLANET_GLYPHS[a.planet1] ?? ""} {a.planet1}</span>
                    <span className="font-medium w-6 text-center" style={{ color: ASPECT_COLORS[a.type] ?? "var(--color-gold)" }}>
                      {ASPECT_GLYPHS[a.type] ?? "—"}
                    </span>
                    <span className="text-star w-28">{PLANET_GLYPHS[a.planet2] ?? ""} {a.planet2}</span>
                    <span className="text-mist text-xs capitalize flex-1">{a.type}</span>
                    <span className="font-mono text-xs" style={{ color: "var(--color-fade)" }}>{a.orb?.toFixed(2)}°</span>
                    <span className="text-xs" style={{ color: a.applying ? "var(--color-success)" : "var(--color-fade)" }}>
                      {a.applying ? "Applicatif" : "Séparatif"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

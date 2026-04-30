// ============================================================
// ARCHIVE-NATAL-DATASHEET-V1 — sheet/page.tsx
// ------------------------------------------------------------
// Page imprimable du thème natal (route /dashboard/natal/[id]/sheet).
// Optimisée pour Cmd+P / Ctrl+P → "Save as PDF".
// ============================================================

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, ephemerisApi } from "@/lib/api/client";
import { NatalDatasheet } from "@/components/natal/NatalDatasheet";

export default function NatalSheetPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  // 1. Charger le profil
  const { data: profileRes, isLoading: profileLoading } = useQuery({
    queryKey: ["natal", id],
    queryFn: () => natalApi.get(accessToken!, id),
    enabled: !!accessToken,
  });
  const profile = (profileRes as any)?.data?.profile;

  // 2. Charger le chart depuis le cache (Neo4j)
  const { data: chartRes, isLoading: chartLoading } = useQuery({
    queryKey: ["chart", id],
    queryFn: async () => {
      try {
        return await ephemerisApi.getChart(accessToken!, id);
      } catch {
        return null;
      }
    },
    enabled: !!accessToken,
  });

  // 3. Si pas de chart en cache, calculer (fallback)
  const calcMutation = useMutation({
    mutationFn: () => ephemerisApi.calculate(accessToken!, id),
  });

  const cachedChart = (chartRes as any)?.data?.chart;
  const calcChart = (calcMutation.data as any)?.data?.chart;
  const chart = calcChart ?? cachedChart;

  // Auto-trigger du calcul si le cache est vide
  useEffect(() => {
    if (!chartLoading && !cachedChart && !calcMutation.isPending && !calcMutation.data && accessToken) {
      calcMutation.mutate();
    }
  }, [chartLoading, cachedChart, calcMutation, accessToken]);

  // ── États ──
  const isLoading = profileLoading || chartLoading || (!chart && calcMutation.isPending);

  if (!accessToken) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>Authentification requise.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto" }} />
        <p style={{ marginTop: 16, color: "var(--muted)", fontSize: 13 }}>
          Chargement de la fiche…
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <p style={{ color: "var(--tension)" }}>Profil natal introuvable.</p>
        <button
          onClick={() => router.push("/dashboard/natal")}
          className="btn-ghost"
          style={{ marginTop: 16 }}
        >
          ← Retour
        </button>
      </div>
    );
  }

  if (!chart) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>
          Impossible de charger le thème natal. Recalculez-le depuis la page principale.
        </p>
        <button
          onClick={() => router.push(`/dashboard/natal/${id}`)}
          className="btn-ghost"
          style={{ marginTop: 16 }}
        >
          ← Retour au thème
        </button>
      </div>
    );
  }

  // ── Rendu de la fiche ──
  return (
    <>
      {/* Bouton retour visible uniquement à l'écran (no-print) */}
      <div
        className="no-print"
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "16px 20px 0",
        }}
      >
        <button
          onClick={() => router.push(`/dashboard/natal/${id}`)}
          className="btn-ghost"
          style={{ fontSize: 12 }}
        >
          ← Retour au thème
        </button>
      </div>

      <NatalDatasheet profile={profile} chart={chart} />
    </>
  );
}

// ARCHIVE-NATAL-DATASHEET-V1 applied

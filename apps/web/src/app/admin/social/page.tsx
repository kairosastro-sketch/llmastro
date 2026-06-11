// ============================================================
// ADMIN-SOCIAL-POST-V1
// apps/web/src/app/admin/social/page.tsx
// ------------------------------------------------------------
// Génère le post « Le ciel du jour » depuis l'admin : aperçu de
// l'image 1080×1350, téléchargement PNG (rendu navigateur via
// <canvas>, sans dépendance native) et caption prête à copier.
// Données : GET /public/sky/{cadence} (public). Le builder SVG
// vit dans lib/social-post.ts (port de scripts/social).
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSocialSVG,
  buildSocialCaption,
  SOCIAL_W,
  SOCIAL_H,
  type SkyPayload,
  type SocialCadence,
} from "@/lib/social-post";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CADENCES: { key: SocialCadence; lb: string }[] = [
  { key: "day",   lb: "Jour" },
  { key: "week",  lb: "Semaine" },
  { key: "month", lb: "Mois" },
];

export default function AdminSocialPage() {
  const [cadence, setCadence] = useState<SocialCadence>("day");
  const [sky, setSky] = useState<SkyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setSky(null);
    fetch(`${API_BASE}/public/sky/${cadence}`, { headers: { accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json?.success || !json?.data?.data) throw new Error("Réponse API inattendue");
        if (!cancelled) setSky(json.data as SkyPayload);
      })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cadence]);

  const svg = useMemo(() => (sky ? buildSocialSVG(sky, cadence) : null), [sky, cadence]);
  const caption = useMemo(() => (sky ? buildSocialCaption(sky, cadence) : ""), [sky, cadence]);
  const dateKey = (sky?.periodStart || new Date().toISOString()).slice(0, 10);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const downloadSVG = useCallback(() => {
    if (!svg) return;
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `ciel-${cadence}-${dateKey}.svg`);
  }, [svg, cadence, dateKey, downloadBlob]);

  const downloadPNG = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SOCIAL_W; canvas.height = SOCIAL_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.drawImage(img, 0, 0, SOCIAL_W, SOCIAL_H);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (png) downloadBlob(png, `ciel-${cadence}-${dateKey}.png`);
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); setError("Rendu PNG impossible (SVG → canvas)"); };
    img.src = url;
  }, [svg, cadence, dateKey, downloadBlob]);

  const copyCaption = useCallback(async () => {
    if (!caption) return;
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [caption]);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Post réseaux sociaux</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Image 1080×1350 + caption générées depuis le ciel publié (« llmastro.com/ciel »).
        Le PNG est rendu par ton navigateur — vérifie l'aperçu avant de poster.
      </p>

      {/* Cadence */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {CADENCES.map(({ key, lb }) => (
          <button
            key={key}
            className="btn-ghost"
            onClick={() => setCadence(key)}
            style={key === cadence ? { borderColor: "var(--gold, #8a5e10)", fontWeight: 600 } : undefined}
          >
            {lb}
          </button>
        ))}
      </div>

      {loading && <div className="spinner" style={{ margin: "30px auto" }} />}
      {error && (
        <p style={{ color: "#e54545", fontSize: 13 }}>Erreur : {error}</p>
      )}

      {svg && sky && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
          {/* Aperçu */}
          <div style={{ flex: "0 0 360px", maxWidth: "100%" }}>
            <div
              style={{ borderRadius: 12, overflow: "hidden", lineHeight: 0, boxShadow: "0 4px 18px rgba(0,0,0,0.25)" }}
              // SVG généré localement par notre builder — pas de contenu externe.
              dangerouslySetInnerHTML={{ __html: svg.replace(`width="${SOCIAL_W}" height="${SOCIAL_H}"`, `width="100%" height="auto"`) }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn-ghost" onClick={downloadPNG}>↓ PNG</button>
              <button className="btn-ghost" onClick={downloadSVG}>↓ SVG</button>
            </div>
          </div>

          {/* Caption */}
          <div style={{ flex: "1 1 320px", minWidth: 280 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Caption</div>
            {!sky.llmText && (
              <p style={{ color: "#d4a017", fontSize: 12.5, marginBottom: 8 }}>
                ⚠ Lecture IA absente de la réponse API — caption générée sans elle
                (réessaie un peu plus tard dans la journée).
              </p>
            )}
            <textarea
              readOnly
              value={caption}
              rows={18}
              style={{
                width: "100%",
                fontSize: 13,
                lineHeight: 1.5,
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--muted)",
                background: "transparent",
                color: "inherit",
                resize: "vertical",
              }}
            />
            <button className="btn-ghost" onClick={copyCaption} style={{ marginTop: 8 }}>
              {copied ? "✓ Copiée" : "Copier la caption"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ADMIN-SOCIAL-POST-V1 applied

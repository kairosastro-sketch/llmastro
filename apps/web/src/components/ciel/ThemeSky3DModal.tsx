// ============================================================
// apps/web/src/components/ciel/ThemeSky3DModal.tsx
// THEME-SKY3D-V1
// ------------------------------------------------------------
// Modale PLEIN ÉCRAN qui héberge la bi-roue 3D du thème (ThemeSky3D).
// Ouverte au clic depuis la page Transits. Onglets de période
// Jour/Semaine/Mois/Année ; le composant lourd (three) est chargé en
// dynamic ssr:false → jamais dans le bundle serveur ni le bundle de la
// page tant que la modale n'est pas ouverte.
//
// - createPortal(document.body) : un modal position:fixed DOIT sortir des
//   conteneurs animate-* (transform ⇒ piège le fixed) — cf. pattern app.
// - Échap + bouton ✕ ferment ; scroll du body verrouillé à l'ouverture.
// - Mobile-first : plein écran réel, contrôles tactiles.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type { NatalInput } from "./ThemeSky3D";

type Cadence = "day" | "week" | "month" | "year";

const CADENCES: Array<{ key: Cadence; label: string }> = [
  { key: "day", label: "Jour" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
];

const ThemeSky3D = dynamic(
  () => import("./ThemeSky3D").then((m) => m.ThemeSky3D),
  { ssr: false },
);

export function ThemeSky3DModal({
  open,
  onClose,
  natal,
  profileLabel,
}: {
  open: boolean;
  onClose: () => void;
  natal: NatalInput;
  profileLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [cadence, setCadence] = useState<Cadence>("day");
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => setMounted(true), []);

  // Échap ferme + verrou du scroll body pendant l'ouverture.
  useEffect(() => {
    if (!open) return;
    setUnavailable(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="ts3dm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Roue 3D animée${profileLabel ? " · " + profileLabel : ""}`}
    >
      <header className="ts3dm-head">
        <div className="ts3dm-title">
          <span className="ts3dm-ico">✦</span>
          <div>
            <div className="ts3dm-h1">Roue 3D animée</div>
            <div className="ts3dm-h2">
              Thème {profileLabel ? `· ${profileLabel}` : "natal"} + transits qui balaient la période
            </div>
          </div>
        </div>

        <div className="ts3dm-tabs" role="tablist" aria-label="Période">
          {CADENCES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={cadence === c.key}
              className={`ts3dm-tab${cadence === c.key ? " is-on" : ""}`}
              onClick={() => setCadence(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button type="button" className="ts3dm-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </header>

      <div className="ts3dm-body">
        {unavailable ? (
          <div className="ts3dm-fallback">
            <p>La roue 3D n'est pas disponible sur cet appareil (WebGL absent).</p>
            <p className="ts3dm-fallback-sub">
              La bi-roue 2D reste accessible juste derrière, sur la page Transits.
            </p>
            <button type="button" className="ts3dm-close-inline" onClick={onClose}>
              Fermer
            </button>
          </div>
        ) : (
          <ThemeSky3D
            // remonte proprement la scène three quand la période change
            key={cadence}
            cadence={cadence}
            natal={natal}
            profileLabel={profileLabel}
            onUnavailable={() => setUnavailable(true)}
          />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: TS3DM_CSS }} />
    </div>,
    document.body,
  );
}

const TS3DM_CSS = `
.ts3dm-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column;
  background: radial-gradient(140% 120% at 50% 0%, #16103a 0%, #0a0722 55%, #05030f 100%);
  animation: ts3dm-in .18s ease-out; }
@keyframes ts3dm-in { from { opacity: 0; } to { opacity: 1; } }
.ts3dm-head { flex: 0 0 auto; display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-bottom: 1px solid rgba(143,127,255,.16); flex-wrap: wrap; }
.ts3dm-title { display: flex; align-items: center; gap: 11px; flex: 1 1 240px; min-width: 0; }
.ts3dm-ico { font-size: 20px; color: #e2c56b; text-shadow: 0 0 12px rgba(226,197,107,.5); flex: 0 0 auto; }
.ts3dm-h1 { font-size: 15px; font-weight: 700; color: #f2ecff; line-height: 1.2; }
.ts3dm-h2 { font-size: 11.5px; color: #b3a6df; line-height: 1.3; margin-top: 1px; }
.ts3dm-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 12px;
  background: rgba(20,14,48,.55); border: 1px solid rgba(143,127,255,.2); }
.ts3dm-tab { border: none; cursor: pointer; padding: 7px 13px; border-radius: 9px;
  font-size: 12.5px; font-weight: 600; color: #cbbcff; background: transparent;
  -webkit-tap-highlight-color: transparent; transition: background .12s, color .12s; }
.ts3dm-tab.is-on { color: #1a1340; background: linear-gradient(180deg, #d9ccff, #b9acff); }
.ts3dm-close { flex: 0 0 auto; width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
  color: #e7e0ff; border: 1px solid rgba(143,127,255,.3); background: rgba(143,127,255,.14);
  font-size: 16px; line-height: 1; margin-left: auto; }
.ts3dm-body { flex: 1 1 auto; min-height: 0; padding: 12px 14px 16px; display: flex; }
.ts3dm-body > * { flex: 1 1 auto; }
.ts3dm-fallback { flex: 1 1 auto; display: grid; place-content: center; text-align: center;
  gap: 8px; color: #e7e0ff; padding: 20px; }
.ts3dm-fallback-sub { font-size: 12.5px; color: #b3a6df; }
.ts3dm-close-inline { margin: 10px auto 0; padding: 9px 18px; border-radius: 10px; cursor: pointer;
  color: #1a1340; border: none; background: linear-gradient(180deg, #d9ccff, #b9acff); font-weight: 600; }
@media (max-width: 640px) {
  .ts3dm-head { gap: 8px; padding: 10px 12px; }
  .ts3dm-h2 { display: none; }
  .ts3dm-tabs { order: 3; width: 100%; justify-content: space-between; }
  .ts3dm-tab { flex: 1 1 0; padding: 8px 6px; text-align: center; }
  .ts3dm-body { padding: 8px 8px 12px; }
}
`;

// THEME-SKY3D-V1 ThemeSky3DModal applied

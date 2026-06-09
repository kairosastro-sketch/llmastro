// ============================================================
// apps/web/src/components/ui/GlossaryPanel.tsx
// AUDIT-UX-GLOSSARY-V1
// Glossaire astrologique contextuel : bouton « ? Glossaire »
// qui ouvre un panneau modal (tabs + accordéon), réutilisant
// les classes .glossary-tabs/.gtab/.glossary-item de globals.css
// et les données partagées de lib/astro/glossary.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/i18n";
import { GLOSSARY } from "@/lib/astro/glossary";

type GlossaryCategory = keyof typeof GLOSSARY;

interface GlossaryButtonProps {
  /** Onglet ouvert par défaut (ex. "Aspects" sur la page transits). */
  initialTab?: GlossaryCategory;
  className?: string;
  style?: React.CSSProperties;
}

export function GlossaryButton({ initialTab = "Signes", className = "", style }: GlossaryButtonProps) {
  const { locale } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn-ghost ${className}`.trim()}
        style={{ fontSize: 12, padding: "6px 12px", ...style }}
        aria-haspopup="dialog"
      >
        ? {locale === "en" ? "Glossary" : "Glossaire"}
      </button>
      {open && <GlossaryPanel initialTab={initialTab} onClose={() => setOpen(false)} />}
    </>
  );
}

function GlossaryPanel({ initialTab, onClose }: { initialTab: GlossaryCategory; onClose: () => void }) {
  const { locale } = useApp();
  const [activeKey, setActiveKey] = useState<GlossaryCategory>(initialTab);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Portail vers <body> : les pages montent ce panneau dans des conteneurs
  // animés (animate-fade-up → transform), qui créeraient un containing block
  // et un stacking context piégeant le position:fixed du modal (clics qui
  // traversent, page visible au-dessus du panneau).
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-title"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: "rgba(7,5,15,.72)",
          backdropFilter: "blur(6px)",
        }}
      />

      {/* Panel */}
      <div
        className="card"
        style={{
          position:   "relative",
          width:      "100%",
          maxWidth:   460,
          maxHeight:  "80vh",
          display:    "flex",
          flexDirection: "column",
          padding:    "22px 22px 14px",
          boxShadow:  "var(--shadow-float)",
          animation:  "scale-in .4s var(--ease-spring) both",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={locale === "en" ? "Close" : "Fermer"}
          style={{
            position: "absolute", top: 12, right: 12,
            padding: 6, width: 28, height: 28,
            borderRadius: "50%",
            color: "var(--muted)", fontSize: 14,
            background: "transparent", border: "none",
            cursor: "pointer", lineHeight: 1,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-raised)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          ✕
        </button>

        <h2
          id="glossary-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize:   18,
            color:      "var(--gold)",
            marginBottom: 10,
            lineHeight: 1.25,
          }}
        >
          {locale === "en" ? "Glossary" : "Glossaire"}
        </h2>

        <div className="glossary-tabs">
          {(Object.keys(GLOSSARY) as GlossaryCategory[]).map(k => (
            <button
              key={k}
              className={`gtab${activeKey === k ? " active" : ""}`}
              onClick={() => { setActiveKey(k); setOpenIdx(null); }}
            >
              {k}
            </button>
          ))}
        </div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
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
    </div>,
    document.body,
  );
}

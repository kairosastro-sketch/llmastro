"use client";

// CHAT-PERSISTENCE-V1-UI-B
// Modale de renommage d'une conversation.
//
// UX :
//  - Overlay sombre semi-transparent (z-index très élevé pour passer la bottom-nav)
//  - Card centrée : input + 2 boutons
//  - Submit sur Entrée
//  - Annuler sur Esc ou clic overlay
//  - Focus auto sur l'input à l'ouverture

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface Props {
  isOpen:        boolean;
  initialTitle:  string;
  isSaving:      boolean;
  locale:        string;
  onConfirm:     (newTitle: string) => void;
  onCancel:      () => void;
}

export function RenameModal({
  isOpen,
  initialTitle,
  isSaving,
  locale,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the field when the modal (re)opens. Tracking the previous
  // `isOpen` value via state lets us reset during render rather than in
  // an effect, per https://react.dev/learn/you-might-not-need-an-effect.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setValue(initialTitle);
  }

  // Focus + select on open (DOM side-effect, no state involved).
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Esc pour fermer
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== initialTitle.trim() && !isSaving;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm(trimmed.slice(0, 255));
  };

  // ── Styles ──
  const overlayStyle: CSSProperties = {
    position:      "fixed",
    inset:         0,
    background:    "rgba(7,5,15,.78)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    zIndex:        100,
    display:       "flex",
    alignItems:    "center",
    justifyContent: "center",
    padding:       16,
    animation:     "fade-in .18s ease",
  };

  const cardStyle: CSSProperties = {
    background:    "var(--bg-2, #0d0a1a)",
    border:        "1px solid var(--border, rgba(201,168,76,.15))",
    borderRadius:  "var(--r-lg, 14px)",
    padding:       20,
    width:         "100%",
    maxWidth:      420,
    boxShadow:     "var(--shadow-float, 0 8px 36px rgba(0,0,0,.55))",
    animation:     "scale-in .25s var(--ease-spring, cubic-bezier(.22,1,.36,1))",
  };

  const titleStyle: CSSProperties = {
    fontFamily:    "var(--font-display, Georgia, serif)",
    fontSize:      17,
    color:         "var(--gold, #c9a84c)",
    margin:        0,
    marginBottom:  6,
    letterSpacing: 0.5,
  };

  const subStyle: CSSProperties = {
    fontSize:      12,
    color:         "var(--muted, rgba(240,230,200,.5))",
    marginBottom:  14,
    lineHeight:    1.45,
  };

  const inputStyle: CSSProperties = {
    width:         "100%",
    fontSize:      14,
    padding:       "10px 12px",
    fontFamily:    "inherit",
  };

  const actionsStyle: CSSProperties = {
    display:       "flex",
    justifyContent: "flex-end",
    gap:           10,
    marginTop:     16,
  };

  const cancelStyle: CSSProperties = {
    padding:       "8px 16px",
    borderRadius:  "var(--r-md, 11px)",
    background:    "transparent",
    border:        "1px solid var(--border-soft, rgba(201,168,76,.08))",
    color:         "var(--muted-2, rgba(240,230,200,.3))",
    fontSize:      13,
    fontFamily:    "inherit",
    cursor:        "pointer",
  };

  const confirmStyle: CSSProperties = {
    padding:       "8px 18px",
    borderRadius:  "var(--r-md, 11px)",
    background:    canSubmit
      ? "linear-gradient(135deg, var(--gold, #c9a84c), var(--gold-l, #e8c97a))"
      : "rgba(201,168,76,.2)",
    border:        "none",
    color:         canSubmit ? "var(--bg, #07050f)" : "var(--muted-2)",
    fontSize:      13,
    fontFamily:    "var(--font-display, Georgia, serif)",
    fontWeight:    700,
    letterSpacing: 1,
    cursor:        canSubmit ? "pointer" : "not-allowed",
    opacity:       canSubmit ? 1 : 0.55,
  };

  return (
    <div
      style={overlayStyle}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-modal-title"
    >
      <div
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="rename-modal-title" style={titleStyle}>
          {locale === "en" ? "Rename conversation" : "Renommer la conversation"}
        </h3>
        <p style={subStyle}>
          {locale === "en"
            ? "Choose a new title for this saved chat (max 255 characters)."
            : "Choisis un nouveau titre pour cette discussion sauvegardée (255 caractères max)."}
        </p>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          maxLength={255}
          disabled={isSaving}
          placeholder={locale === "en" ? "Conversation title…" : "Titre de la conversation…"}
          style={inputStyle}
          aria-label={locale === "en" ? "Conversation title" : "Titre de la conversation"}
        />

        <div style={actionsStyle}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            style={cancelStyle}
          >
            {locale === "en" ? "Cancel" : "Annuler"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={confirmStyle}
          >
            {isSaving
              ? (locale === "en" ? "Saving…" : "Enregistrement…")
              : (locale === "en" ? "Save" : "Enregistrer")}
          </button>
        </div>
      </div>
    </div>
  );
}

// CHAT-PERSISTENCE-V1-UI-B applied

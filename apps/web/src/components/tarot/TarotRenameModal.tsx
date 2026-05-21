"use client";

// TAROT-PERSISTENCE-V1
// Modale de renommage d'un tirage de tarot.
// Miroir de RenameModal (chat).
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

export function TarotRenameModal({
  isOpen,
  initialTitle,
  isSaving,
  locale,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset du champ quand la modale (ré)ouvre — tracking du `isOpen`
  // précédent pour le faire pendant le render plutôt que dans un effet.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setValue(initialTitle);
  }

  // Focus + select à l'ouverture (side-effect DOM, pas de state).
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
      aria-labelledby="tarot-rename-modal-title"
    >
      <div
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="tarot-rename-modal-title" style={titleStyle}>
          {locale === "en" ? "Rename reading" : "Renommer le tirage"}
        </h3>
        <p style={subStyle}>
          {locale === "en"
            ? "Choose a new title for this saved reading (max 255 characters)."
            : "Choisis un nouveau titre pour ce tirage sauvegardé (255 caractères max)."}
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
          placeholder={locale === "en" ? "Reading title…" : "Titre du tirage…"}
          style={inputStyle}
          aria-label={locale === "en" ? "Reading title" : "Titre du tirage"}
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

// TAROT-PERSISTENCE-V1 applied

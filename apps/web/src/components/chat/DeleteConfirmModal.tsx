"use client";

// CHAT-PERSISTENCE-V1-UI-B
// Modale stylisée de confirmation de suppression d'une conversation.
//
// UX :
//  - Overlay sombre, card centrée
//  - Titre + nom de la conv + warning + 2 boutons (Annuler + Supprimer rouge)
//  - Esc + clic overlay = annuler
//  - Le bouton confirm est rouge (var --tension)

import { useEffect } from "react";
import type { CSSProperties } from "react";

interface Props {
  isOpen:        boolean;
  conversationTitle: string;
  isDeleting:    boolean;
  locale:        string;
  onConfirm:     () => void;
  onCancel:      () => void;
}

export function DeleteConfirmModal({
  isOpen,
  conversationTitle,
  isDeleting,
  locale,
  onConfirm,
  onCancel,
}: Props) {
  // Esc pour fermer
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

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
    border:        "1px solid rgba(229,69,69,.3)",
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
    color:         "var(--tension, #e54545)",
    margin:        0,
    marginBottom:  10,
    letterSpacing: 0.5,
    display:       "flex",
    alignItems:    "center",
    gap:           8,
  };

  const subStyle: CSSProperties = {
    fontSize:      13,
    color:         "var(--star, #f0e6c8)",
    marginBottom:  6,
    lineHeight:    1.5,
  };

  const convNameStyle: CSSProperties = {
    fontFamily:    "var(--font-display, Georgia, serif)",
    fontSize:      14,
    color:         "var(--gold-l, #e8c97a)",
    fontStyle:     "italic",
    marginBottom:  12,
    padding:       "8px 12px",
    background:    "rgba(201,168,76,.06)",
    borderRadius:  "var(--r-sm, 8px)",
    borderLeft:    "2px solid var(--gold, #c9a84c)",
    wordBreak:     "break-word",
  };

  const warningStyle: CSSProperties = {
    fontSize:      12,
    color:         "var(--muted, rgba(240,230,200,.5))",
    marginBottom:  16,
    fontStyle:     "italic",
  };

  const actionsStyle: CSSProperties = {
    display:       "flex",
    justifyContent: "flex-end",
    gap:           10,
  };

  const cancelStyle: CSSProperties = {
    padding:       "8px 16px",
    borderRadius:  "var(--r-md, 11px)",
    background:    "transparent",
    border:        "1px solid var(--border-soft, rgba(201,168,76,.08))",
    color:         "var(--muted-2, rgba(240,230,200,.3))",
    fontSize:      13,
    fontFamily:    "inherit",
    cursor:        isDeleting ? "default" : "pointer",
    opacity:       isDeleting ? 0.5 : 1,
  };

  const deleteStyle: CSSProperties = {
    padding:       "8px 18px",
    borderRadius:  "var(--r-md, 11px)",
    background:    isDeleting
      ? "rgba(229,69,69,.3)"
      : "rgba(229,69,69,.18)",
    border:        "1px solid rgba(229,69,69,.4)",
    color:         "var(--tension, #e54545)",
    fontSize:      13,
    fontFamily:    "inherit",
    fontWeight:    600,
    letterSpacing: 0.5,
    cursor:        isDeleting ? "default" : "pointer",
    opacity:       isDeleting ? 0.6 : 1,
  };

  return (
    <div
      style={overlayStyle}
      onClick={() => { if (!isDeleting) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-modal-title" style={titleStyle}>
          <span aria-hidden="true">⚠</span>
          {locale === "en" ? "Delete conversation?" : "Supprimer cette conversation ?"}
        </h3>

        <p style={subStyle}>
          {locale === "en"
            ? "You are about to permanently delete this saved conversation:"
            : "Tu es sur le point de supprimer définitivement cette conversation sauvegardée :"}
        </p>

        <div style={convNameStyle}>
          {conversationTitle}
        </div>

        <p style={warningStyle}>
          {locale === "en"
            ? "This action cannot be undone."
            : "Cette action est irréversible."}
        </p>

        <div style={actionsStyle}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            style={cancelStyle}
          >
            {locale === "en" ? "Cancel" : "Annuler"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={deleteStyle}
          >
            {isDeleting
              ? (locale === "en" ? "Deleting…" : "Suppression…")
              : (locale === "en" ? "Delete" : "Supprimer")}
          </button>
        </div>
      </div>
    </div>
  );
}

// CHAT-PERSISTENCE-V1-UI-B applied

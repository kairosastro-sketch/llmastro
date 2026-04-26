"use client";

import { createContext, useCallback, useContext, useReducer, type ReactNode } from "react";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id:      string;
  type:    ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ----------------------------------------------------------
// Reducer
// ----------------------------------------------------------
type Action =
  | { type: "ADD";    toast: Toast }
  | { type: "REMOVE"; id: string };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case "ADD":    return [...state, action.toast].slice(-5);
    case "REMOVE": return state.filter((t) => t.id !== action.id);
  }
}

// ----------------------------------------------------------
// Provider
// ----------------------------------------------------------
export function Toaster({ children }: { children?: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: "ADD", toast: { id, type, message } });
    setTimeout(() => dispatch({ type: "REMOVE", id }), 4000);
  }, []);

  const ICONS: Record<ToastType, string> = {
    success: "✓", error: "✕", warning: "⚠", info: "✦",
  };

  const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: { bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.30)", icon: "var(--color-success)" },
    error:   { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.30)", icon: "var(--color-error)" },
    warning: { bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.30)",  icon: "var(--color-warning)" },
    info:    { bg: "rgba(212,168,67,0.08)",  border: "var(--border-gold)",      icon: "var(--color-gold)" },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        style={{
          position:  "fixed",
          bottom:    "1.5rem",
          right:     "1.5rem",
          zIndex:    9999,
          display:   "flex",
          flexDirection: "column",
          gap:       "0.5rem",
          maxWidth:  "360px",
          width:     "100%",
        }}
      >
        {toasts.map((t) => {
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              role="alert"
              className="fade-in glass rounded-xl px-4 py-3 flex items-start gap-3 text-sm"
              style={{
                background:  c.bg,
                border:      `1px solid ${c.border}`,
                backdropFilter: "blur(16px)",
              }}
            >
              <span style={{ color: c.icon, flexShrink: 0, fontWeight: 700, marginTop: "1px" }}>
                {ICONS[t.type]}
              </span>
              <span className="text-star flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => dispatch({ type: "REMOVE", id: t.id })}
                className="text-mist hover:text-star transition-colors text-xs flex-shrink-0"
                aria-label="Fermer"
                style={{ marginTop: "1px" }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// ----------------------------------------------------------
// Hook
// ----------------------------------------------------------
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster>");
  return ctx;
}

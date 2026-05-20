// ============================================================
// apps/web/src/components/ciel/InterpretationCard.tsx
// CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2
// ------------------------------------------------------------
// Affiche les 2 lectures Kairos (claire / technique) avec un
// toggle persistant en localStorage. Mode dégradé si l'un des
// textes est encore null.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { getT, type Locale } from "@/lib/i18n/translations";

const STORAGE_KEY = "llmastro-ciel-mode";
type Mode = "clear" | "technical";

function readInitialMode(): Mode {
  if (typeof window === "undefined") return "clear";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "technical" ? "technical" : "clear";
  } catch {
    return "clear";
  }
}

interface InterpretationCardProps {
  llmText:                string | null;
  llmGeneratedAt:         string | null;
  llmTextAdvanced:        string | null;
  llmAdvancedGeneratedAt: string | null;
  lang:                   Locale;
}

export function InterpretationCard({
  llmText,
  llmGeneratedAt,
  llmTextAdvanced,
  llmAdvancedGeneratedAt,
  lang,
}: InterpretationCardProps) {
  const t = getT(lang);
  const [mode, setMode] = useState<Mode>("clear");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after first render to avoid SSR mismatch.
  // The setState calls are intentional — localStorage is unavailable on
  // the server, so the persisted choice can only be applied post-mount.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- mount-only hydration from localStorage */
    setMode(readInitialMode());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function selectMode(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* noop */
    }
  }

  const hasClear     = typeof llmText         === "string" && llmText.trim().length > 0;
  const hasTechnical = typeof llmTextAdvanced === "string" && llmTextAdvanced.trim().length > 0;

  // Choose displayed text. If user picked one but it's missing, fall back to the other.
  const displayedMode: Mode | null =
    mode === "technical" && hasTechnical ? "technical" :
    mode === "technical" && hasClear     ? "clear"     :
    mode === "clear"     && hasClear     ? "clear"     :
    mode === "clear"     && hasTechnical ? "technical" :
    null;

  const displayedText = displayedMode === "technical" ? llmTextAdvanced :
                        displayedMode === "clear"     ? llmText :
                        null;

  const displayedDate = displayedMode === "technical" ? llmAdvancedGeneratedAt :
                        displayedMode === "clear"     ? llmGeneratedAt :
                        null;

  return (
    <section
      className="card"
      style={{
        padding: "1.75rem",
        marginBottom: "2rem",
        background: "var(--card-bg)",
        borderColor: "var(--border-mid)",
      }}
      aria-label={t("ciel_interp_aria")}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          marginBottom: "1rem",
        }}
      >
        <span style={{ color: "var(--gold)", fontSize: "1.3rem" }} aria-hidden>✦</span>
        <h2
          style={{
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "1.3rem",
            fontWeight: 400,
            color: "var(--gold)",
          }}
        >
          {t("ciel_interp_title")}
        </h2>
      </header>

      {/* Tabs (only if at least one text is available) */}
      {(hasClear || hasTechnical) && (
        <div
          role="tablist"
          aria-label={t("ciel_interp_tabs_aria")}
          style={{
            display: "inline-flex",
            gap: "0.4rem",
            marginBottom: "1.25rem",
            padding: "0.25rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <TabButton
            active={hydrated && mode === "clear"}
            disabled={!hasClear}
            onClick={() => selectMode("clear")}
            label={t("ciel_interp_clear")}
          />
          <TabButton
            active={hydrated && mode === "technical"}
            disabled={!hasTechnical}
            onClick={() => selectMode("technical")}
            label={t("ciel_interp_technical")}
          />
        </div>
      )}

      {/* Body */}
      {displayedText ? (
        <>
          <div
            style={{
              color: "var(--gold-l)",
              fontSize: "1rem",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {displayedText}
          </div>
          {displayedDate && (
            <p
              style={{
                marginTop: "1rem",
                color: "var(--muted-2)",
                fontSize: "0.8rem",
                fontStyle: "italic",
              }}
            >
              {t("ciel_interp_generated")} {new Date(displayedDate).toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}.
            </p>
          )}
        </>
      ) : (
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.95rem",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          {t("ciel_interp_pending")}
        </p>
      )}
    </section>
  );
}

function TabButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active:    boolean;
  disabled?: boolean;
  onClick:   () => void;
  label:     string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "0.4rem 0.9rem",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "0.85rem",
        borderRadius: "calc(var(--r-md) - 2px)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        color: active ? "var(--bg)" : "var(--gold)",
        background: active
          ? "linear-gradient(180deg, var(--gold-l), var(--gold))"
          : "transparent",
        transition: "all 200ms var(--ease-out)",
      }}
    >
      {label}
    </button>
  );
}

// CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2 interpretation applied

// CIEL-I18N-V1 InterpretationCard applied

"use client";

// TAROT-PERSISTENCE-V1
// Bouton "Sauvegarder ce tirage" — miroir de SaveConversationButton.
//
// Logique :
//  - Disabled si :
//      * aucune carte tirée
//      * un tirage / une interprétation IA est en cours (isBusy)
//      * tirage déjà sauvegardé (currentReadingId !== null)
//      * pas de token
//  - Pre-check paywall pour les free dont quota.canSave === false
//  - POST /tarot/readings — le backend génère un titre depuis la
//    question (ou les noms des cartes) si aucun n'est fourni
//  - Catch :
//      * code TIER_LIMIT_REACHED / TIER_FEATURE_DISABLED → openPaywall
//      * autre → status "error" pendant 3s
//  - Au succès : onSaved(readingId) (le parent met à jour
//    currentReadingId + invalide la query tarot-save-quota)

import { useState } from "react";
import type { CSSProperties } from "react";
import { apiClient, TierError } from "@/lib/api/client";

interface TarotCard {
  num:      number;
  name:     string;
  position: string;
}

interface QuotaInfo {
  limit:   number;
  current: number;
  canSave: boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  cards:            TarotCard[];
  question:         string;
  /** Interprétation IA Kairos si elle a été générée (sinon null). */
  ai:               unknown | null;
  natalId:          string | null;
  accessToken:      string | null;
  quota:            QuotaInfo | null;
  isFree:           boolean;
  /** true si un tirage ou une interprétation IA est en cours. */
  isBusy:           boolean;
  currentReadingId: string | null;
  locale:           string;
  openPaywall:      (opts: { feature: string; message: string }) => void;
  onSaved:          (readingId: string) => void;
}

const PAYWALL_MSG_FR = "Passe à Essentiel ou Pro pour sauvegarder plus de tirages";
const PAYWALL_MSG_EN = "Upgrade to save more readings";

export function SaveTarotButton({
  cards,
  question,
  ai,
  natalId,
  accessToken,
  quota,
  isFree,
  isBusy,
  currentReadingId,
  locale,
  openPaywall,
  onSaved,
}: Props) {
  const [status, setStatus] = useState<SaveStatus>("idle");

  const isAlreadySaved = currentReadingId !== null;
  const hasContent = cards.length > 0;
  const isDisabled =
    !hasContent ||
    isBusy ||
    isAlreadySaved ||
    status === "saving" ||
    !accessToken;

  const label = (() => {
    if (status === "error") {
      return locale === "en" ? "Save failed" : "Échec";
    }
    if (status === "saving") {
      return locale === "en" ? "Saving…" : "Sauvegarde…";
    }
    if (status === "saved" || isAlreadySaved) {
      return locale === "en" ? "✓ Saved" : "✓ Sauvegardé";
    }
    return locale === "en" ? "💾 Save this reading" : "💾 Sauvegarder ce tirage";
  })();

  const handleClick = async () => {
    if (isDisabled) return;
    if (!accessToken) return;

    // Pre-check : free + quota épuisée → paywall direct, pas d'appel API
    if (isFree && quota && quota.canSave === false) {
      openPaywall({
        feature: "tarot_save_count",
        message: locale === "en" ? PAYWALL_MSG_EN : PAYWALL_MSG_FR,
      });
      return;
    }

    setStatus("saving");
    try {
      const trimmedQuestion = question.trim();
      const res = await apiClient.post<{
        reading: { id: string; title: string };
      }>(
        "/tarot/readings",
        {
          natalProfileId: natalId,
          data: {
            ...(trimmedQuestion ? { question: trimmedQuestion } : {}),
            cards: cards.map((c) => ({
              num:      c.num,
              name:     c.name,
              position: c.position,
            })),
            ...(ai ? { ai } : {}),
          },
        },
        accessToken,
      );
      const readingId = (res as { data?: { reading?: { id?: string } } })
        ?.data?.reading?.id;
      if (!readingId) {
        throw new Error("No reading id returned");
      }
      setStatus("saved");
      onSaved(readingId);
    } catch (err) {
      // Défense en profondeur (TierError non attendu pour TIER_LIMIT_REACHED actuellement)
      if (err instanceof TierError) {
        setStatus("idle");
        return;
      }
      const code = (err as { code?: string })?.code;
      if (code === "TIER_LIMIT_REACHED" || code === "TIER_FEATURE_DISABLED") {
        openPaywall({
          feature: "tarot_save_count",
          message: locale === "en" ? PAYWALL_MSG_EN : PAYWALL_MSG_FR,
        });
        setStatus("idle");
        return;
      }
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  // Styles
  const baseStyle: CSSProperties = {
    background:   "transparent",
    border:       "1px solid var(--border-soft, rgba(212,168,67,.25))",
    color:        "var(--gold-l, #d4a843)",
    borderRadius: 8,
    padding:      "6px 12px",
    fontSize:     13,
    cursor:       isDisabled ? "default" : "pointer",
    fontFamily:   "inherit",
    opacity:      isDisabled ? 0.55 : 1,
    transition:   "background .15s var(--ease-out, ease), border-color .15s ease",
    whiteSpace:   "nowrap",
    flexShrink:   0,
  };

  const errorStyle: CSSProperties = status === "error"
    ? {
        borderColor: "rgba(229,69,69,.4)",
        color:       "var(--tension, #e54545)",
      }
    : {};

  const savedStyle: CSSProperties = (status === "saved" || isAlreadySaved)
    ? {
        borderColor: "rgba(52,211,153,.35)",
        color:       "var(--harmony, #34d399)",
      }
    : {};

  return (
    <button
      onClick={() => void handleClick()}
      disabled={isDisabled}
      style={{ ...baseStyle, ...errorStyle, ...savedStyle }}
      aria-label={
        locale === "en"
          ? "Save this reading"
          : "Sauvegarder ce tirage"
      }
      title={label}
    >
      {label}
    </button>
  );
}

// TAROT-PERSISTENCE-V1 applied

"use client";

// CHAT-PERSISTENCE-V1-UI-A
// Bouton "Sauvegarder cette discussion" pour le chat Kairos.
//
// Logique :
//  - Filtre le greeting initial (1er msg assistant sans `planet`)
//  - Disabled si :
//      * pas assez de contenu (besoin d'au moins 1 paire user+assistant)
//      * isTyping (réponse IA en cours)
//      * conversation déjà sauvegardée (currentConversationId !== null)
//      * pas de token
//  - Pre-check paywall pour les free dont quota.canSave === false
//  - POST /chat/conversations sans `title` (le backend génère un titre à
//    partir du premier message user, cf. defaultTitle dans chat.ts)
//  - Catch :
//      * TierError → paywall déjà ouvert via le bus, on quitte (défense
//        en profondeur — actuellement TIER_LIMIT_REACHED n'est pas dans
//        parseTiersError donc ce cas n'arrive pas, mais autant être safe)
//      * code === "TIER_LIMIT_REACHED" → openPaywall manuel
//      * autre → status "error" pendant 3s
//  - Au succès : onSaved(convId) (le parent met à jour
//    currentConversationId + invalide la query chat-quota)

import { useState } from "react";
import type { CSSProperties } from "react";
import { apiClient, TierError } from "@/lib/api/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  planet?: string;
}

interface QuotaInfo {
  limit: number;
  current: number;
  canSave: boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  messages:              Message[];
  planet:                string;
  natalId:               string | null;
  accessToken:           string | null;
  quota:                 QuotaInfo | null;
  isFree:                boolean;
  isTyping:              boolean;
  currentConversationId: string | null;
  locale:                string;
  openPaywall:           (opts: { feature: string; message: string }) => void;
  onSaved:               (conversationId: string) => void;
}

const PAYWALL_MSG_FR = "Passe à Essentiel ou Pro pour sauvegarder plus de conversations";
const PAYWALL_MSG_EN = "Upgrade to save more conversations";

export function SaveConversationButton({
  messages,
  planet,
  natalId,
  accessToken,
  quota,
  isFree,
  isTyping,
  currentConversationId,
  locale,
  openPaywall,
  onSaved,
}: Props) {
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Filtre : exclut le greeting (1er msg assistant sans `planet`) et les contenus vides
  const messagesToSave = messages.filter((m, i) => {
    if (i === 0 && m.role === "assistant" && !m.planet) return false;
    return m.content && m.content.trim().length > 0;
  });

  const isAlreadySaved = currentConversationId !== null;
  const hasContent = messagesToSave.length >= 2;
  const isDisabled =
    !hasContent ||
    isTyping ||
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
      return locale === "en" ? "✓ Saved" : "✓ Sauvegardée";
    }
    return locale === "en" ? "💾 Save this chat" : "💾 Sauvegarder";
  })();

  const handleClick = async () => {
    if (isDisabled) return;
    if (!accessToken) return;

    // Pre-check : free + quota épuisée → paywall direct, pas d'appel API
    if (isFree && quota && quota.canSave === false) {
      openPaywall({
        feature: "chat_save_count",
        message: locale === "en" ? PAYWALL_MSG_EN : PAYWALL_MSG_FR,
      });
      return;
    }

    setStatus("saving");
    try {
      const res = await apiClient.post<{
        conversation: { id: string; title: string };
      }>(
        "/chat/conversations",
        {
          planetKey:      planet,
          natalProfileId: natalId,
          messages: messagesToSave.map((m) => ({
            role:    m.role,
            content: m.content,
          })),
        },
        accessToken,
      );
      const convId = (res as { data?: { conversation?: { id?: string } } })
        ?.data?.conversation?.id;
      if (!convId) {
        throw new Error("No conversation id returned");
      }
      setStatus("saved");
      onSaved(convId);
    } catch (err) {
      // Défense en profondeur (TierError non attendu pour TIER_LIMIT_REACHED actuellement)
      if (err instanceof TierError) {
        setStatus("idle");
        return;
      }
      const code = (err as { code?: string })?.code;
      if (code === "TIER_LIMIT_REACHED" || code === "TIER_FEATURE_DISABLED") {
        openPaywall({
          feature: "chat_save_count",
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
          ? "Save this conversation"
          : "Sauvegarder cette conversation"
      }
      title={label}
    >
      {label}
    </button>
  );
}

// CHAT-PERSISTENCE-V1-UI-A applied

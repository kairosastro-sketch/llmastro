"use client";

// CHAT-PERSISTENCE-V1-UI-B
// Drawer "Mes discussions" — panneau coulissant droite.
//
// Affiche la liste des conversations sauvegardées du user, avec pour chacune :
//  - le titre (cliquable pour charger)
//  - le label de la planète (Soleil/Lune/...)
//  - la date last_message_at (relative humanisée)
//  - un menu kebab ⋯ avec Renommer + Supprimer
//
// Endpoints utilisés :
//  - GET    /chat/conversations         → liste
//  - GET    /chat/conversations/:id     → détail + messages (au load)
//  - PATCH  /chat/conversations/:id     → rename
//  - DELETE /chat/conversations/:id     → suppression
//
// Le drawer slide-in droite avec backdrop. Mobile : full-width.

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { RenameModal } from "./RenameModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

// ─── Types renvoyés par l'API ────────────────────────────────────
interface ConversationListItem {
  id:             string;
  planetKey:      string;
  title:          string;
  natalProfileId: string | null;
  createdAt:      string;
  lastMessageAt:  string;
}

interface ConversationDetail extends ConversationListItem {
  messages: Array<{
    id:        string;
    role:      "user" | "assistant";
    content:   string;
    createdAt: string;
  }>;
}

// ─── Mapping des planètes (couleurs/labels pour les badges) ──────
const PLANET_INFO: Record<string, { fr: string; en: string; emoji: string; color: string }> = {
  kairos:  { fr: "Kairos",  en: "Kairos",  emoji: "✦", color: "#cbb6e8" },  // KAIROS-HOST-V1
  sun:     { fr: "Soleil",  en: "Sun",     emoji: "☉", color: "#d4a843" },
  moon:    { fr: "Lune",    en: "Moon",    emoji: "☽", color: "#b0adc8" },
  mercury: { fr: "Mercure", en: "Mercury", emoji: "☿", color: "#60a5fa" },
  venus:   { fr: "Vénus",   en: "Venus",   emoji: "♀", color: "#e879a8" },
  mars:    { fr: "Mars",    en: "Mars",    emoji: "♂", color: "#f87171" },
  jupiter: { fr: "Jupiter", en: "Jupiter", emoji: "♃", color: "#34d399" },
  saturn:  { fr: "Saturne", en: "Saturn",  emoji: "♄", color: "#a78bfa" },
};

interface LoadedConversation {
  conversationId: string;
  planetKey:      string;
  messages: Array<{
    role:    "user" | "assistant";
    content: string;
  }>;
}

interface Props {
  isOpen:        boolean;
  accessToken:   string | null;
  locale:        string;
  onClose:       () => void;
  onLoadConversation: (conv: LoadedConversation) => void;
}

// ─── Utils ───────────────────────────────────────────────────────
function relativeDate(iso: string, locale: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = now - then;
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (minutes < 1) {
      return locale === "en" ? "just now" : "à l'instant";
    }
    if (minutes < 60) {
      return locale === "en" ? `${minutes}m ago` : `il y a ${minutes} min`;
    }
    if (hours < 24) {
      return locale === "en" ? `${hours}h ago` : `il y a ${hours}h`;
    }
    if (days < 7) {
      return locale === "en" ? `${days}d ago` : `il y a ${days} j`;
    }
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Component principal ─────────────────────────────────────────
export function ChatDrawer({
  isOpen,
  accessToken,
  locale,
  onClose,
  onLoadConversation,
}: Props) {
  const queryClient = useQueryClient();

  // ── Query liste conversations ──
  const { data: listRes, isLoading, isError, refetch } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn:  () =>
      apiClient.get<{ conversations: ConversationListItem[] }>(
        "/chat/conversations",
        accessToken!,
      ),
    enabled: !!accessToken && isOpen,
  });

  const conversations = (listRes as { data?: { conversations: ConversationListItem[] } })
    ?.data?.conversations ?? [];

  // ── State : actions in-flight (load, rename, delete) ──
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<ConversationListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConversationListItem | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Mutation rename ──
  const renameMutation = useMutation({
    mutationFn: async (args: { id: string; title: string }) => {
      return apiClient.patch(
        `/chat/conversations/${args.id}`,
        { title: args.title },
        accessToken!,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      setRenameTarget(null);
    },
    onError: () => {
      setActionError(locale === "en"
        ? "Rename failed — please retry"
        : "Renommage échoué — réessaye");
      setTimeout(() => setActionError(null), 3000);
    },
  });

  // ── Mutation delete ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/chat/conversations/${id}`, undefined, accessToken!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-quota"] });
      setDeleteTarget(null);
    },
    onError: () => {
      setActionError(locale === "en"
        ? "Delete failed — please retry"
        : "Suppression échouée — réessaye");
      setTimeout(() => setActionError(null), 3000);
    },
  });

  // ── Handler : charger une conv ──
  const handleLoad = async (conv: ConversationListItem) => {
    if (!accessToken) return;
    setLoadingId(conv.id);
    setActionError(null);
    try {
      const res = await apiClient.get<{ conversation: ConversationDetail }>(
        `/chat/conversations/${conv.id}`,
        accessToken,
      );
      const detail = (res as { data?: { conversation?: ConversationDetail } })
        ?.data?.conversation;
      if (!detail || !Array.isArray(detail.messages)) {
        throw new Error("No messages");
      }
      onLoadConversation({
        conversationId: detail.id,
        planetKey:      detail.planetKey,
        messages:       detail.messages.map(m => ({
          role:    m.role,
          content: m.content,
        })),
      });
      onClose();
    } catch {
      setActionError(locale === "en"
        ? "Load failed — please retry"
        : "Chargement échoué — réessaye");
      setTimeout(() => setActionError(null), 3000);
    } finally {
      setLoadingId(null);
    }
  };

  // ── Esc pour fermer ──
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !renameTarget && !deleteTarget) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, renameTarget, deleteTarget]);

  if (!isOpen) return null;

  // ── Styles ──
  const overlayStyle: CSSProperties = {
    position:      "fixed",
    inset:         0,
    background:    "rgba(7,5,15,.55)",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    zIndex:        80,
    animation:     "fade-in .2s ease",
  };

  const drawerStyle: CSSProperties = {
    position:      "fixed",
    top:           0,
    right:         0,
    bottom:        0,
    width:         "min(420px, 100vw)",
    background:    "var(--bg, #07050f)",
    borderLeft:    "1px solid var(--border-soft, rgba(201,168,76,.08))",
    boxShadow:     "var(--shadow-float, 0 8px 36px rgba(0,0,0,.55))",
    zIndex:        81,
    display:       "flex",
    flexDirection: "column",
    paddingTop:    "var(--safe-top, 0px)",
    paddingBottom: "var(--safe-bottom, 0px)",
    animation:     "drawer-slide-in .28s var(--ease-spring, cubic-bezier(.22,1,.36,1))",
  };

  const headerStyle: CSSProperties = {
    display:       "flex",
    alignItems:    "center",
    justifyContent: "space-between",
    padding:       "14px 16px",
    borderBottom:  "1px solid var(--border-soft, rgba(201,168,76,.08))",
    flexShrink:    0,
  };

  const headerTitleStyle: CSSProperties = {
    fontFamily:    "var(--font-display, Georgia, serif)",
    fontSize:      16,
    color:         "var(--gold, #c9a84c)",
    margin:        0,
    letterSpacing: 0.5,
  };

  const closeBtnStyle: CSSProperties = {
    background:    "transparent",
    border:        "1px solid var(--border-soft, rgba(201,168,76,.08))",
    color:         "var(--muted-2, rgba(240,230,200,.3))",
    borderRadius:  8,
    width:         32,
    height:        32,
    display:       "flex",
    alignItems:    "center",
    justifyContent: "center",
    fontSize:      18,
    cursor:        "pointer",
    fontFamily:    "inherit",
  };

  const contentStyle: CSSProperties = {
    flex:          1,
    overflowY:     "auto",
    padding:       "8px 8px 16px",
    WebkitOverflowScrolling: "touch",
  };

  const itemStyle: CSSProperties = {
    background:    "transparent",
    border:        "1px solid var(--border-soft, rgba(201,168,76,.08))",
    borderRadius:  "var(--r-md, 11px)",
    padding:       "10px 12px",
    margin:        "6px 8px",
    cursor:        "pointer",
    transition:    "background .18s, border-color .18s",
    position:      "relative",
    fontFamily:    "inherit",
    color:         "inherit",
    width:         "calc(100% - 16px)",
    textAlign:     "left",
    display:       "block",
  };

  const itemRowStyle: CSSProperties = {
    display:       "flex",
    alignItems:    "center",
    gap:           8,
  };

  const titleStyle: CSSProperties = {
    fontSize:      14,
    color:         "var(--star, #f0e6c8)",
    fontFamily:    "var(--font-display, Georgia, serif)",
    flex:          1,
    minWidth:      0,
    overflow:      "hidden",
    textOverflow:  "ellipsis",
    whiteSpace:    "nowrap",
  };

  const metaStyle: CSSProperties = {
    fontSize:      11,
    color:         "var(--muted, rgba(240,230,200,.5))",
    marginTop:     4,
    display:       "flex",
    alignItems:    "center",
    gap:           8,
    flexWrap:      "wrap",
  };

  const planetBadgeStyle = (color: string): CSSProperties => ({
    fontSize:      10,
    color:         color,
    padding:       "1px 6px",
    borderRadius:  10,
    background:    `${color}14`,
    border:        `1px solid ${color}33`,
    letterSpacing: 0.3,
    flexShrink:    0,
  });

  const kebabBtnStyle: CSSProperties = {
    background:    "transparent",
    border:        "none",
    color:         "var(--muted-2, rgba(240,230,200,.3))",
    fontSize:      18,
    cursor:        "pointer",
    padding:       "0 6px",
    flexShrink:    0,
    fontFamily:    "inherit",
    lineHeight:    1,
  };

  const popoverStyle: CSSProperties = {
    position:      "absolute",
    top:           38,
    right:         6,
    background:    "var(--bg-2, #0d0a1a)",
    border:        "1px solid var(--border, rgba(201,168,76,.15))",
    borderRadius:  "var(--r-md, 11px)",
    boxShadow:     "var(--shadow-soft, 0 2px 20px rgba(0,0,0,.45))",
    zIndex:        82,
    minWidth:      150,
    overflow:      "hidden",
  };

  const popoverItemStyle: CSSProperties = {
    display:       "block",
    width:         "100%",
    background:    "transparent",
    border:        "none",
    padding:       "10px 14px",
    fontSize:      13,
    fontFamily:    "inherit",
    color:         "var(--star, #f0e6c8)",
    cursor:        "pointer",
    textAlign:     "left",
    transition:    "background .15s",
  };

  const popoverDeleteStyle: CSSProperties = {
    ...popoverItemStyle,
    color: "var(--tension, #e54545)",
  };

  const emptyStateStyle: CSSProperties = {
    padding:       40,
    textAlign:     "center",
    color:         "var(--muted, rgba(240,230,200,.5))",
    fontFamily:    "var(--font-display, Georgia, serif)",
    fontSize:      14,
    lineHeight:    1.6,
  };

  const errorBannerStyle: CSSProperties = {
    margin:        "8px 12px",
    padding:       "10px 12px",
    borderRadius:  "var(--r-md, 11px)",
    background:    "rgba(229,69,69,.08)",
    border:        "1px solid rgba(229,69,69,.25)",
    color:         "var(--tension, #e54545)",
    fontSize:      12,
    lineHeight:    1.4,
  };

  return (
    <>
      {/* Animations inline (au cas où le globals.css ne serait pas chargé encore) */}
      <style>{`
        @keyframes drawer-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>

      <div
        style={overlayStyle}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        style={drawerStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-drawer-title"
      >
        <header style={headerStyle}>
          <h2 id="chat-drawer-title" style={headerTitleStyle}>
            {locale === "en" ? "My conversations" : "Mes discussions"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={closeBtnStyle}
            aria-label={locale === "en" ? "Close" : "Fermer"}
            title={locale === "en" ? "Close" : "Fermer"}
          >
            ×
          </button>
        </header>

        {actionError && (
          <div style={errorBannerStyle}>
            {actionError}
          </div>
        )}

        <div style={contentStyle}>
          {isLoading && (
            <div style={emptyStateStyle}>
              {locale === "en" ? "Loading…" : "Chargement…"}
            </div>
          )}

          {isError && !isLoading && (
            <div style={emptyStateStyle}>
              {locale === "en"
                ? "Could not load conversations."
                : "Impossible de charger les conversations."}
              <br />
              <button
                type="button"
                onClick={() => void refetch()}
                style={{
                  background:    "transparent",
                  border:        "1px solid var(--border, rgba(201,168,76,.15))",
                  color:         "var(--gold, #c9a84c)",
                  padding:       "6px 14px",
                  borderRadius:  "var(--r-md, 11px)",
                  fontSize:      12,
                  cursor:        "pointer",
                  fontFamily:    "inherit",
                  marginTop:     12,
                }}
              >
                {locale === "en" ? "Retry" : "Réessayer"}
              </button>
            </div>
          )}

          {!isLoading && !isError && conversations.length === 0 && (
            <div style={emptyStateStyle}>
              {locale === "en"
                ? "No saved conversations yet.\nUse the Save button to keep your favorite chats."
                : "Aucune discussion sauvegardée.\nUtilise le bouton Sauvegarder pour garder tes échanges favoris."}
            </div>
          )}

          {!isLoading && !isError && conversations.map((conv) => {
            const planetInfo = PLANET_INFO[conv.planetKey] ?? {
              fr: conv.planetKey, en: conv.planetKey, emoji: "✦", color: "#c9a84c",
            };
            const planetLabel = locale === "en" ? planetInfo.en : planetInfo.fr;
            const isLoadingThis = loadingId === conv.id;

            return (
              <div
                key={conv.id}
                style={{
                  position: "relative",
                  margin: "0 0 0 0",
                }}
              >
                <button
                  type="button"
                  onClick={() => void handleLoad(conv)}
                  disabled={isLoadingThis}
                  style={{
                    ...itemStyle,
                    opacity: isLoadingThis ? 0.5 : 1,
                    cursor:  isLoadingThis ? "default" : "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(201,168,76,.05)";
                    e.currentTarget.style.borderColor = "var(--border, rgba(201,168,76,.15))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "var(--border-soft, rgba(201,168,76,.08))";
                  }}
                >
                  <div style={itemRowStyle}>
                    <div style={titleStyle} title={conv.title}>
                      {conv.title}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === conv.id ? null : conv.id);
                      }}
                      style={kebabBtnStyle}
                      aria-label={locale === "en" ? "More actions" : "Plus d'actions"}
                      title={locale === "en" ? "More" : "Plus"}
                    >
                      ⋯
                    </button>
                  </div>
                  <div style={metaStyle}>
                    <span style={planetBadgeStyle(planetInfo.color)}>
                      {planetInfo.emoji} {planetLabel}
                    </span>
                    <span>{relativeDate(conv.lastMessageAt, locale)}</span>
                    {isLoadingThis && (
                      <span style={{ color: "var(--gold-l, #e8c97a)" }}>
                        {locale === "en" ? "loading…" : "chargement…"}
                      </span>
                    )}
                  </div>
                </button>

                {/* Popover kebab */}
                {openMenuId === conv.id && (
                  <>
                    {/* Backdrop invisible pour fermer le popover au clic extérieur */}
                    <div
                      onClick={() => setOpenMenuId(null)}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 81,
                      }}
                    />
                    <div style={popoverStyle}>
                      <button
                        type="button"
                        style={popoverItemStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          setRenameTarget(conv);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(201,168,76,.06)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        ✎ {locale === "en" ? "Rename" : "Renommer"}
                      </button>
                      <button
                        type="button"
                        style={popoverDeleteStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          setDeleteTarget(conv);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(229,69,69,.08)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        🗑 {locale === "en" ? "Delete" : "Supprimer"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <RenameModal
        isOpen={renameTarget !== null}
        initialTitle={renameTarget?.title ?? ""}
        isSaving={renameMutation.isPending}
        locale={locale}
        onConfirm={(newTitle) => {
          if (!renameTarget) return;
          renameMutation.mutate({ id: renameTarget.id, title: newTitle });
        }}
        onCancel={() => setRenameTarget(null)}
      />

      <DeleteConfirmModal
        isOpen={deleteTarget !== null}
        conversationTitle={deleteTarget?.title ?? ""}
        isDeleting={deleteMutation.isPending}
        locale={locale}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

// CHAT-PERSISTENCE-V1-UI-B applied

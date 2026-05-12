"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, apiClient, TierError } from "@/lib/api/client";
import { useT, useApp } from "@/lib/i18n";
// CHAT-PERSISTENCE-V1-UI-A
import { useTiers } from "@/hooks/useTiers";
import { SaveConversationButton } from "@/components/chat/SaveConversationButton";
import { ChatQuotaIndicator } from "@/components/chat/ChatQuotaIndicator";
// CHAT-PERSISTENCE-V1-UI-B
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { ChatDrawerToggle } from "@/components/chat/ChatDrawerToggle";

// ──────────────────────────────────────────────────────────
// Planètes
// ──────────────────────────────────────────────────────────
const PLANETS = [
  { key: "sun",     nameFr: "Soleil",  nameEn: "Sun",     emoji: "☉", color: "#d4a843" },
  { key: "moon",    nameFr: "Lune",    nameEn: "Moon",    emoji: "☽", color: "#b0adc8" },
  { key: "mercury", nameFr: "Mercure", nameEn: "Mercury", emoji: "☿", color: "#60a5fa" },
  { key: "venus",   nameFr: "Vénus",   nameEn: "Venus",   emoji: "♀", color: "#e879a8" },
  { key: "mars",    nameFr: "Mars",    nameEn: "Mars",    emoji: "♂", color: "#f87171" },
  { key: "jupiter", nameFr: "Jupiter", nameEn: "Jupiter", emoji: "♃", color: "#34d399" },
  { key: "saturn",  nameFr: "Saturne", nameEn: "Saturn",  emoji: "♄", color: "#a78bfa" },
];

// CHAT-DRAFT-PERSIST-V1 : clé sessionStorage pour le draft du chat en cours.
// sessionStorage = persiste pendant la durée de l'onglet (refresh OK, fermeture KO).
// Wipé aussi explicitement au logout (AuthContext) et au "Nouveau chat" (resetChat).
const DRAFT_KEY = "llmastro:chat-draft";

// Greetings locaux (affichés avant le premier tour IA)
const GREETINGS: Record<string, { fr: string; en: string }> = {
  sun:     { fr: "Je suis le Soleil, cœur de ton cosmos. Que souhaites-tu savoir de toi-même ?", en: "I am the Sun, heart of your cosmos. What do you wish to know about yourself?" },
  moon:    { fr: "Je suis la Lune, gardienne de ton monde intérieur. Qu'est-ce qui agite ton âme ?", en: "I am the Moon, keeper of your inner world. What stirs your soul?" },
  mercury: { fr: "Mercure ici — esprit vif, messager. Qu'est-ce qui tourbillonne dans ta tête ?", en: "Mercury here — sharp mind, messenger. What whirls in your head?" },
  venus:   { fr: "Vénus te salue avec grâce. Qu'est-ce qui touche ton cœur ?", en: "Venus greets you with grace. What touches your heart?" },
  mars:    { fr: "Mars, dieu de l'action. Qu'est-ce qui t'arrête ?", en: "Mars, god of action. What stops you?" },
  jupiter: { fr: "Jupiter, le Grand Bénéfique. Vers quoi veux-tu grandir ?", en: "Jupiter, the Greater Benefic. Toward what do you wish to grow?" },
  saturn:  { fr: "Saturne. La discipline crée la liberté. Que dois-tu vraiment construire ?", en: "Saturn. Discipline creates freedom. What must you truly build?" },
};

// HOTFIX-KAIROS-CHAT-CONTEXT-V1 : `planet` est posé sur les messages assistant pour tracker
// quelle planète a émis chaque réponse (affichage pastille + historique API).
interface Message { role: "user" | "assistant"; content: string; planet?: string; }

export default function ChatPage() {
  const t = useT();
  const { locale } = useApp();
  const { accessToken } = useAuth();

  const [planet, setPlanet]   = useState("sun");
  const [messages, setMsgs]   = useState<Message[]>([]);
  const [input, setInput]     = useState("");
  const [isTyping, setTyping] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  // CHAT-PERSISTENCE-V1-UI-A : tracker conv déjà sauvegardée
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // CHAT-DRAFT-PERSIST-V1 : flag posé une fois la tentative de restore terminée.
  // Empêche le useEffect de save d'écraser le sessionStorage avec [] avant le restore.
  // Empêche aussi le useEffect "force greeting" de poser le greeting sur un draft restauré.
  const [draftLoaded, setDraftLoaded] = useState(false);

  // CHAT-PERSISTENCE-V1-UI-B : état d'ouverture du drawer "Mes discussions"
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // CHAT-PERSISTENCE-V1-UI-A : tiers + queryClient
  const queryClient = useQueryClient();
  const { isFree, openPaywall } = useTiers();

  // CHAT-PERSISTENCE-V1-UI-A : quota de sauvegardes
  const { data: quotaRes } = useQuery({
    queryKey: ["chat-quota"],
    queryFn:  () =>
      apiClient.get<{ limit: number; current: number; canSave: boolean }>(
        "/chat/conversations/quota",
        accessToken!,
      ),
    enabled: !!accessToken,
  });
  const quota = (quotaRes as { data?: { limit: number; current: number; canSave: boolean } })?.data ?? null;

  // Charger le premier profil natal
  const { data: profilesRes } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });
  const profiles = (profilesRes as any)?.data?.profiles ?? [];
  const natalId = profiles[0]?.id ?? null;

  const currentPlanet = PLANETS.find(p => p.key === planet)!;

  // HOTFIX-KAIROS-CHAT-CONTEXT-V1 : on ne reset plus le chat à chaque changement de planète.
  // Le chat ne reset que si :
  //  - il est vide (premier rendu)
  //  - il ne contient que le greeting initial (aucun planet stocké dessus)
  // Sinon l'historique reste intact et la nouvelle planète voit tout.
  // Le bouton "Nouveau chat" (↺) permet le reset explicite.
  // CHAT-DRAFT-PERSIST-V1 : ajout de la garde draftLoaded pour éviter que ce useEffect
  // n'écrase un draft restauré au mount (race condition entre setMsgs(restored) et ce setMsgs).
  useEffect(() => {
    if (!draftLoaded) return;
    setMsgs(prev => {
      const onlyGreeting =
        prev.length === 0 ||
        (prev.length === 1 && prev[0].role === "assistant" && !prev[0].planet);
      if (onlyGreeting) {
        const g = GREETINGS[planet]?.[locale] ?? "";
        // CHAT-PERSONA-FIX-V1 : tag le greeting avec la planète qui l'émet,
        // pour que (a) la pastille de rendu reste cohérente après bascule
        // de planète, et (b) le backend préfixe [Soleil/Lune/etc] dans
        // l'historique quand on bascule vers une autre planète.
        return [{ role: "assistant", content: g, planet }];
      }
      return prev;
    });
    setError(null);
  }, [planet, locale, draftLoaded]);

  // CHAT-PERSISTENCE-V1-UI-B : charge une conversation sauvegardée depuis le drawer.
  // Remplace messages + planet, marque la conv comme "déjà sauvegardée"
  // (currentConversationId !== null → bouton save passe en mode ✓ Sauvegardée).
  // Ferme l'erreur courante au passage. Le drawer se ferme côté drawer (onLoadConversation → onClose).
  const handleLoadConversation = (conv: {
    conversationId: string;
    planetKey:      string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }) => {
    // Sécurité : si la planète chargée n'est pas dans notre liste, fallback "sun"
    const validPlanet = PLANETS.some(p => p.key === conv.planetKey)
      ? conv.planetKey
      : "sun";
    setPlanet(validPlanet);
    // Tag tous les messages assistant avec la planète d'origine de la conv pour
    // que la pastille s'affiche correctement et que le backend fasse le
    // préfixage [Planet] cohérent si l'utilisateur bascule ensuite sur une autre planète.
    setMsgs(conv.messages.map(m => ({
      role:    m.role,
      content: m.content,
      ...(m.role === "assistant" ? { planet: validPlanet } : {}),
    })));
    setCurrentConversationId(conv.conversationId);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  };

  // Reset explicite demandé par l'utilisateur (bouton ↺).
  const resetChat = () => {
    const g = GREETINGS[planet]?.[locale] ?? "";
    // CHAT-PERSONA-FIX-V1 : tag le greeting avec la planète émettrice
    setMsgs([{ role: "assistant", content: g, planet }]);
    setInput("");
    setError(null);
    // CHAT-PERSISTENCE-V1-UI-A : reset tracker + refetch quota
    setCurrentConversationId(null);
    void queryClient.invalidateQueries({ queryKey: ["chat-quota"] });
    // CHAT-DRAFT-PERSIST-V1 : wipe le draft sessionStorage (sinon le useEffect save
    // le ré-écrirait avec le greeting au prochain render, ce qui est inutile mais
    // l'explicite est plus clair et évite tout edge case)
    if (typeof window !== "undefined") {
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
    inputRef.current?.focus();
  };

  // CHAT-DRAFT-PERSIST-V1 : restore du draft au mount (1 seule exécution).
  // Garde-fou typeof window pour la phase SSR de Next.js.
  // En cas de JSON corrompu ou d'absence de draft, on continue sans erreur.
  useEffect(() => {
    if (typeof window === "undefined") {
      setDraftLoaded(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as {
          messages?:              Message[];
          planet?:                string;
          currentConversationId?: string | null;
        };
        if (Array.isArray(draft.messages) && draft.messages.length > 0) {
          setMsgs(draft.messages);
        }
        if (typeof draft.planet === "string" && PLANETS.some(p => p.key === draft.planet)) {
          setPlanet(draft.planet);
        }
        if (draft.currentConversationId !== undefined) {
          setCurrentConversationId(draft.currentConversationId);
        }
      }
    } catch {
      // draft corrompu → ignore et continue avec un état vide
    }
    setDraftLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CHAT-DRAFT-PERSIST-V1 : save du draft à chaque change après restore.
  // Garde draftLoaded pour ne pas écraser le draft pré-restore.
  useEffect(() => {
    if (!draftLoaded) return;
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ messages, planet, currentConversationId }),
      );
    } catch {
      // quota dépassé ou autre erreur sessionStorage → on ignore (le draft sera
      // simplement perdu au prochain refresh, pas la peine de spammer la console)
    }
  }, [draftLoaded, messages, planet, currentConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userText = input.trim();
    setInput("");
    setError(null);

    // On ajoute le message user localement
    const nextMessages: Message[] = [...messages, { role: "user", content: userText }];
    setMsgs(nextMessages);
    setTyping(true);

    try {
      // Retirer le greeting initial (il n'est pas dans l'historique IA)
      const historyForApi = nextMessages.filter(m => m.content && m.content.trim().length > 0);

      const res = await apiClient.post("/ai/chat", {
        planet,
        natalId,
        locale,
        messages: historyForApi,
      }, accessToken!);

      const replyText = (res as any)?.data?.reply ?? "";
      if (!replyText) throw new Error("Empty response");

      // HOTFIX-KAIROS-CHAT-CONTEXT-V1 : on stocke la planète qui a émis la réponse pour que
      // l'affichage de la pastille reste correct même après bascule de persona.
      setMsgs(m => [...m, { role: "assistant", content: replyText, planet }]);
    } catch (err) {
      // PAYWALL-FRONT-V1 : si le quota AI est atteint, le paywall modal est
      // déjà ouvert via l'error-bus. On rollback juste le message user pour
      // que l'utilisateur puisse le réessayer après upgrade.
      if (err instanceof TierError) {
        setMsgs(m => m.slice(0, -1));
        setInput(userText);
      } else {
        setError(
          locale === "en"
            ? "The planet is silent for now — try again."
            : "La planète reste silencieuse — réessaye."
        );
      }
    } finally {
      setTyping(false);
      inputRef.current?.focus();
    }
  };

  const planetName = (p: typeof PLANETS[0]) => locale === "en" ? p.nameEn : p.nameFr;

  return (
    <div className="chat-page-wrap">
      <div className="chat-intro">{t("chat_disclaimer")}</div>

      {/* HOTFIX-KAIROS-CHAT-CONTEXT-V1 : Sélecteur planète + bouton Nouveau chat (↺) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="planet-sel" style={{ flex: 1, minWidth: 0 }}>
          {PLANETS.map(p => (
            <button
              key={p.key}
              className={`psel${planet === p.key ? " active" : ""}`}
              onClick={() => setPlanet(p.key)}
              style={
                planet === p.key ? {
                  borderColor: p.color,
                  color: p.color,
                  background: `${p.color}14`,
                } : {}
              }
            >
              <span>{p.emoji}</span>
              <span>{planetName(p)}</span>
            </button>
          ))}
        </div>
        <button
          onClick={resetChat}
          aria-label={locale === "fr" ? "Nouveau chat" : "New chat"}
          title={locale === "fr" ? "Nouveau chat" : "New chat"}
          style={{
            background: "transparent",
            border: "1px solid var(--edge, rgba(255,255,255,.15))",
            color: "var(--muted-2, #8a8598)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 15,
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "inherit",
          }}
        >
          ↺
        </button>
      </div>

      {/* CHAT-PERSISTENCE-V1-UI-A : barre Sauvegarder + indicateur quota */}
      {/* CHAT-PERSISTENCE-V1-UI-B : ajout du toggle drawer à gauche du save */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            10,
        marginTop:      8,
        flexWrap:       "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <ChatDrawerToggle
            onClick={() => setDrawerOpen(true)}
            isOpen={isDrawerOpen}
            locale={locale}
          />
          <SaveConversationButton
          messages={messages}
          planet={planet}
          natalId={natalId}
          accessToken={accessToken}
          quota={quota}
          isFree={isFree}
          isTyping={isTyping}
          currentConversationId={currentConversationId}
          locale={locale}
          openPaywall={openPaywall}
          onSaved={(convId) => {
            setCurrentConversationId(convId);
            void queryClient.invalidateQueries({ queryKey: ["chat-quota"] });
          }}
        />
        </div>
        <ChatQuotaIndicator
          quota={quota}
          isFree={isFree}
          locale={locale}
          onUpgradeClick={() =>
            openPaywall({
              feature: "chat_save_count",
              message: locale === "en"
                ? "Upgrade to save more conversations"
                : "Passe à Essentiel ou Pro pour sauvegarder plus de conversations",
            })
          }
        />
      </div>

      {/* Messages */}
      <div className="chat-msgs">
        {messages.map((msg, i) => {
          if (!msg.content) return null;
          const isAssistant = msg.role === "assistant";
          // HOTFIX-KAIROS-CHAT-CONTEXT-V1 : la pastille reflète la planète qui a émis le message,
          // pas la planète active. Fallback sur currentPlanet pour le greeting
          // initial (qui n'a pas de `planet` stocké).
          const msgPlanet = (isAssistant && msg.planet)
            ? (PLANETS.find(p => p.key === msg.planet) ?? currentPlanet)
            : currentPlanet;
          return (
            <div
              key={i}
              className={`chat-msg ${isAssistant ? "planet" : "user"}`}
              style={isAssistant ? { borderColor: `${msgPlanet.color}33` } : {}}
            >
              {isAssistant && (
                <div className="chat-sender" style={{ color: msgPlanet.color }}>
                  {msgPlanet.emoji} {planetName(msgPlanet)}
                </div>
              )}
              {msg.content.split("\n").map((line, j) => (
                <div key={j}>{line || "\u00A0"}</div>
              ))}
            </div>
          );
        })}

        {isTyping && (
          <div className="chat-typing" style={{ borderColor: `${currentPlanet.color}33` }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ background: currentPlanet.color }} />
            ))}
          </div>
        )}

        {error && (
          <div className="alert-banner" style={{
            background: "rgba(229,69,69,.08)",
            borderColor: "rgba(229,69,69,.25)",
            color: "var(--tension)",
          }}>
            <span className="ab-ico">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-wrap">
        <input
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void sendMessage(); }}
          placeholder={t("chat_input_ph")}
          disabled={isTyping}
        />
        <button
          className="chat-send"
          onClick={() => void sendMessage()}
          disabled={!input.trim() || isTyping}
          aria-label="Send"
        >
          ↑
        </button>
      </div>

      <p style={{
        fontSize: 9, color: "var(--muted-2)",
        textAlign: "center", marginTop: 5, letterSpacing: .3,
      }}>
        {locale === "en"
          // PATCH-KAIROS-NAMING-AND-JPL-V1 : mention Grok remplacée par Kairos (nom user-facing)
          ? "Answers by Kairos — grounded in your natal chart"
          : "Réponses par Kairos — ancrées dans ton thème natal"}
      </p>

      {/* CHAT-PERSISTENCE-V1-UI-B : drawer "Mes discussions" */}
      <ChatDrawer
        isOpen={isDrawerOpen}
        accessToken={accessToken}
        locale={locale}
        onClose={() => setDrawerOpen(false)}
        onLoadConversation={handleLoadConversation}
      />
    </div>
  );
}

/* PATCH-MENAGE-V1 hide-silent-on-tier */
// CHAT-PERSISTENCE-V1-UI-A applied
// CHAT-DRAFT-PERSIST-V1 applied
// CHAT-MOBILE-INPUT-FIX-V1 applied
// CHAT-PERSONA-FIX-V1 applied
// CHAT-PERSISTENCE-V1-UI-B applied

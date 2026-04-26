"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi, apiClient } from "@/lib/api/client";
import { useT, useApp } from "@/lib/i18n";

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

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

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
  useEffect(() => {
    setMsgs(prev => {
      const onlyGreeting =
        prev.length === 0 ||
        (prev.length === 1 && prev[0].role === "assistant" && !prev[0].planet);
      if (onlyGreeting) {
        const g = GREETINGS[planet]?.[locale] ?? "";
        return [{ role: "assistant", content: g }];
      }
      return prev;
    });
    setError(null);
  }, [planet, locale]);

  // Reset explicite demandé par l'utilisateur (bouton ↺).
  const resetChat = () => {
    const g = GREETINGS[planet]?.[locale] ?? "";
    setMsgs([{ role: "assistant", content: g }]);
    setInput("");
    setError(null);
    inputRef.current?.focus();
  };

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
      // Fallback : message d'erreur discret
      setError(
        locale === "en"
          ? "The planet is silent for now — try again."
          : "La planète reste silencieuse — réessaye."
      );
    } finally {
      setTyping(false);
      inputRef.current?.focus();
    }
  };

  const planetName = (p: typeof PLANETS[0]) => locale === "en" ? p.nameEn : p.nameFr;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100dvh - 56px - 60px - var(--safe-top) - var(--safe-bottom))",
      maxHeight: "100dvh",
      maxWidth: 720,
      margin: "0 auto",
      padding: "14px 16px 10px",
      width: "100%",
    }}>
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
    </div>
  );
}

/* PATCH-MENAGE-V1 hide-silent-on-tier */

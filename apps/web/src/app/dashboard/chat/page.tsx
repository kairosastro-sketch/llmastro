"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
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
// KAIROS-HOST-V1 : Kairos = l'hôte central (agent par défaut), les 7
// planètes = ses agents spécialistes. Kairos ouvre toujours l'échange ;
// la barre permet de basculer en direct vers une planète (mode expert).
const KAIROS = { key: "kairos", nameFr: "Kairos", nameEn: "Kairos", emoji: "✦", color: "#cbb6e8" };

const PLANETS = [
  { key: "sun",     nameFr: "Soleil",  nameEn: "Sun",     emoji: "☉", color: "#d4a843" },
  { key: "moon",    nameFr: "Lune",    nameEn: "Moon",    emoji: "☽", color: "#b0adc8" },
  { key: "mercury", nameFr: "Mercure", nameEn: "Mercury", emoji: "☿", color: "#60a5fa" },
  { key: "venus",   nameFr: "Vénus",   nameEn: "Venus",   emoji: "♀", color: "#e879a8" },
  { key: "mars",    nameFr: "Mars",    nameEn: "Mars",    emoji: "♂", color: "#f87171" },
  { key: "jupiter", nameFr: "Jupiter", nameEn: "Jupiter", emoji: "♃", color: "#34d399" },
  { key: "saturn",  nameFr: "Saturne", nameEn: "Saturn",  emoji: "♄", color: "#a78bfa" },
];

// Liste complète des agents (Kairos en tête) pour la barre + les lookups.
const AGENTS = [KAIROS, ...PLANETS];

// KAIROS-HOST-V1 : marqueur émis par Kairos en fin de réponse pour
// suggérer de creuser avec des agents-planètes. Le front l'extrait du
// texte (jamais affiché) et le rend en pastilles cliquables.
const PLANET_KEYS = new Set(PLANETS.map(p => p.key));
function parseSuggestions(text: string): { clean: string; suggestions: string[] } {
  const m = text.match(/\n*::SUGGEST::[ \t]*(.+?)[ \t]*$/i);
  if (!m || m.index === undefined) return { clean: text.trim(), suggestions: [] };
  const keys = m[1]
    .split(/[,\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(k => PLANET_KEYS.has(k));
  return {
    clean: text.slice(0, m.index).trim(),
    suggestions: [...new Set(keys)].slice(0, 3),
  };
}

// KAIROS-FORECAST-V1 : Kairos émet ::FORECAST:: <horizon> quand il a besoin
// des positions futures. Le front détecte l'horizon → rejoue le tour avec
// `forecast=<horizon>` pour que le serveur calcule le ciel à venir.
const FORECAST_HORIZONS = new Set(["week", "month", "quarter", "year", "years"]);
const FORECAST_FR_MAP: Record<string, string> = {
  semaine: "week", mois: "month", trimestre: "quarter",
  an: "year", année: "year", annee: "year",
  ans: "years", années: "years", annees: "years",
};
function parseForecast(text: string): string | null {
  const m = text.match(/::FORECAST::[ \t]*([a-zA-ZéèàÉÈÀ]+)/i);
  if (!m) return null;
  const raw = m[1].trim().toLowerCase();
  const norm = FORECAST_FR_MAP[raw] ?? raw;
  return FORECAST_HORIZONS.has(norm) ? norm : null;
}
// Retire toute ligne ::FORECAST:: résiduelle avant affichage (défensif).
function stripForecastMarker(text: string): string {
  return text.replace(/\n*::FORECAST::[^\n]*/gi, "").trim();
}

// CHAT-DRAFT-PERSIST-V1 : clé sessionStorage pour le draft du chat en cours.
// sessionStorage = persiste pendant la durée de l'onglet (refresh OK, fermeture KO).
// Wipé aussi explicitement au logout (AuthContext) et au "Nouveau chat" (resetChat).
const DRAFT_KEY = "llmastro:chat-draft";

// Greetings locaux (affichés avant le premier tour IA). Format sobre :
// nom de la planète + 3 domaines qu'elle gouverne + une invite courte.
// La bannière de contexte natal (CHAT-FIRST-CONTACT-V1) gère déjà la
// pédagogie « Kairos connaît ton thème » → inutile de la répéter ici.
const GREETINGS: Record<string, { fr: string; en: string }> = {
  kairos:  { fr: "Je suis Kairos, ton guide. Dis-moi ce qui t'amène — une question, une décision à prendre, une période qui t'intrigue ? On regarde ensemble, et je t'orienterai vers la bonne planète quand il faudra creuser.", en: "I'm Kairos, your guide. Tell me what brings you — a question, a decision to make, a period that intrigues you? We'll look together, and I'll point you to the right planet when it's time to dig deeper." },
  sun:     { fr: "Le Soleil représente ton identité profonde, ta vitalité et la direction que tu donnes à ta vie. Demande-moi comment il s'exprime dans ton thème.", en: "The Sun represents your core identity, your vitality and the direction you give your life. Ask me how it plays out in your chart." },
  moon:    { fr: "La Lune influence tes émotions, tes besoins de sécurité et ton monde intérieur. Dis-moi ce qui te traverse en ce moment.", en: "The Moon influences your emotions, your need for security and your inner world. Tell me what you're going through right now." },
  mercury: { fr: "Mercure éclaire ta façon de penser, d'apprendre et de communiquer. Pose-moi une question sur tes idées, tes choix ou tes échanges.", en: "Mercury lights up how you think, learn and communicate. Ask me about your ideas, your choices or your exchanges." },
  venus:   { fr: "Vénus t'informe sur ta manière d'aimer, tes goûts et ce qui te relie aux autres. Parle-moi de tes relations ou de ce qui te fait envie.", en: "Venus tells you about how you love, your tastes and what connects you to others. Talk to me about your relationships or what you long for." },
  mars:    { fr: "Mars gouverne ton énergie, ton désir et ta façon d'agir. Dis-moi où tu veux avancer, ou ce qui te freine.", en: "Mars governs your energy, your desire and the way you act. Tell me where you want to move forward, or what's holding you back." },
  jupiter: { fr: "Jupiter ouvre tes perspectives : sens, croissance et opportunités. Demande-moi où se trouvent tes marges d'expansion.", en: "Jupiter widens your horizons: meaning, growth and opportunity. Ask me where your room to expand lies." },
  saturn:  { fr: "Saturne structure ta discipline, tes responsabilités et tes limites. Interroge-moi sur ce que tu cherches à construire ou à dépasser.", en: "Saturn structures your discipline, your responsibilities and your limits. Ask me what you're trying to build or to overcome." },
};

// HOTFIX-KAIROS-CHAT-CONTEXT-V1 : `planet` est posé sur les messages assistant pour tracker
// quelle planète a émis chaque réponse (affichage pastille + historique API).
interface Message { role: "user" | "assistant"; content: string; planet?: string; suggestions?: string[]; }

export default function ChatPage() {
  const t = useT();
  const { locale } = useApp();
  const { accessToken, refreshTiers } = useAuth();

  const [planet, setPlanet]   = useState("kairos");  // KAIROS-HOST-V1 : Kairos par défaut
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
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // CHAT-FIRST-CONTACT-V1 : auto-resize du textarea. Recalcule la height à
  // chaque changement de `input` (y compris le reset à "" après send), borné
  // à 120 px → au-delà, scroll interne du textarea.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

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

  const currentPlanet = AGENTS.find(p => p.key === planet) ?? KAIROS;

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
    // Syncing the initial greeting with the active planet/locale is a
    // legitimate effect: the greeting depends on derived inputs but must
    // also preserve the user's existing conversation when one exists.
    // Cascading renders are acceptable here — this only fires when planet
    // or locale actually change.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync greeting <-> active planet/locale
    setMsgs(prev => {
      // KAIROS-HOST-V1 : tant qu'aucun échange n'a commencé (0 message, ou le
      // seul message est le greeting d'un agent), changer d'agent rafraîchit le
      // greeting vers la description du nouvel agent. On NE teste plus l'absence
      // de tag `planet` : le greeting est toujours tagué (Kairos ou planète),
      // sinon la bascule ne montrerait jamais la description de la planète.
      const onlyGreeting =
        prev.length === 0 ||
        (prev.length === 1 && prev[0].role === "assistant");
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
    // Sécurité : si l'agent chargé n'est pas dans notre liste, fallback "kairos"
    const validPlanet = AGENTS.some(p => p.key === conv.planetKey)
      ? conv.planetKey
      : "kairos";
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
    // Mount-only draft hydration from sessionStorage. SSR has no access
    // to sessionStorage, so the restore must run in an effect, and the
    // `draftLoaded` flag is set as bookkeeping for downstream effects.
    /* eslint-disable react-hooks/set-state-in-effect -- mount-only restore from sessionStorage */
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
        if (typeof draft.planet === "string" && AGENTS.some(p => p.key === draft.planet)) {
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
    /* eslint-enable react-hooks/set-state-in-effect */
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

  // KAIROS-HOST-V1 : un tour de chat générique, paramétré par l'agent actif.
  // `agentKey` peut être "kairos" (hôte) ou une planète. `restoreOnError`
  // remet le texte dans l'input quand il vient de la saisie utilisateur
  // (pas pour les transitions automatiques d'un hand-off).
  const runTurn = async (userText: string, agentKey: string, restoreOnError: boolean) => {
    setError(null);
    const nextMessages: Message[] = [...messages, { role: "user", content: userText }];
    setMsgs(nextMessages);
    setTyping(true);

    try {
      // Retirer le greeting initial (il n'est pas dans l'historique IA)
      const historyForApi = nextMessages.filter(m => m.content && m.content.trim().length > 0);

      const callApi = async (forecastHorizon?: string): Promise<string> => {
        const res = await apiClient.post("/ai/chat", {
          planet: agentKey,
          natalId,
          locale,
          messages: historyForApi,
          ...(forecastHorizon ? { forecast: forecastHorizon } : {}),
        }, accessToken!);
        return (res as any)?.data?.reply ?? "";
      };

      let replyText = await callApi();
      if (!replyText) throw new Error("Empty response");

      // KAIROS-FORECAST-V1 : si Kairos demande une prévision (::FORECAST::),
      // on rejoue le tour avec l'horizon — le serveur calcule les positions
      // futures et les injecte. Le tour-marqueur n'est jamais affiché ; le
      // loader reste visible le temps du 2e appel. Une seule passe forecast.
      const horizon = parseForecast(replyText);
      if (horizon) {
        replyText = await callApi(horizon);
        if (!replyText) throw new Error("Empty response");
      }

      // KAIROS-HOST-V1 : extrait le marqueur ::SUGGEST:: (planètes proposées)
      // du texte avant affichage. Seul Kairos en émet ; pour une planète la
      // liste sera simplement vide. On retire aussi tout ::FORECAST:: résiduel.
      const { clean, suggestions } = parseSuggestions(stripForecastMarker(replyText));

      // HOTFIX-KAIROS-CHAT-CONTEXT-V1 : on stocke l'agent qui a émis la réponse pour que
      // l'affichage de la pastille reste correct même après bascule de persona.
      setMsgs(m => [...m, {
        role: "assistant",
        content: clean,
        planet: agentKey,
        ...(suggestions.length > 0 ? { suggestions } : {}),
      }]);

      // PAYWALL-FRONT-V2 : décrémente le compteur ai.chat.monthly affiché
      // dans QuotaSummary (top bar du dashboard).
      refreshTiers();
    } catch (err) {
      // PAYWALL-FRONT-V1 : si le quota AI est atteint, le paywall modal est
      // déjà ouvert via l'error-bus. On rollback juste le message user pour
      // que l'utilisateur puisse le réessayer après upgrade.
      if (err instanceof TierError) {
        setMsgs(m => m.slice(0, -1));
        if (restoreOnError) setInput(userText);
      } else {
        setError(
          locale === "en"
            ? "Kairos is silent for now — try again."
            : "Kairos reste silencieux — réessaye."
        );
      }
    } finally {
      setTyping(false);
      inputRef.current?.focus();
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userText = input.trim();
    setInput("");
    await runTurn(userText, planet, true);
  };

  // KAIROS-HOST-V1 : hand-off depuis une pastille suggérée par Kairos.
  // On bascule l'agent actif vers la planète et on enchaîne un tour où
  // elle prend la parole sur le sujet en cours. Le message user de
  // transition rend l'action explicite dans le transcript.
  const digDeeperWith = async (agentKey: string) => {
    if (isTyping) return;
    const target = AGENTS.find(a => a.key === agentKey);
    if (!target) return;
    setPlanet(agentKey);
    const label = locale === "en" ? target.nameEn : target.nameFr;
    const transition = locale === "en"
      ? `Let's dig into this with ${label}.`
      : `Creusons ça avec ${label}.`;
    await runTurn(transition, agentKey, false);
  };

  const planetName = (p: typeof PLANETS[0]) => locale === "en" ? p.nameEn : p.nameFr;

  return (
    <div className="chat-page-wrap">
      <div className="chat-intro">{t("chat_disclaimer")}</div>

      {/* HOTFIX-KAIROS-CHAT-CONTEXT-V1 + KAIROS-HOST-V1 : Kairos (hôte) en
          grand et centré au-dessus, puis ses agents-planètes en dessous. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
        {/* Ligne Kairos centrée (hôte) + bouton Nouveau chat (↺) à droite */}
        <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <button
            onClick={() => setPlanet(KAIROS.key)}
            aria-pressed={planet === KAIROS.key}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              padding: "11px 26px", borderRadius: 999,
              border: `1.5px solid ${planet === KAIROS.key ? KAIROS.color : "var(--border-soft)"}`,
              background: planet === KAIROS.key ? `${KAIROS.color}1f` : "transparent",
              color: planet === KAIROS.key ? KAIROS.color : "var(--star)",
              fontFamily: "var(--font-display)",
              fontSize: 16.5,
              letterSpacing: 0.4,
              cursor: "pointer",
              boxShadow: planet === KAIROS.key ? `0 0 18px ${KAIROS.color}40` : "none",
              transition: "all .22s",
            }}
          >
            <span style={{ fontSize: 20 }}>{KAIROS.emoji}</span>
            <span>{planetName(KAIROS)}</span>
          </button>
          <button
            onClick={resetChat}
            aria-label={locale === "fr" ? "Nouveau chat" : "New chat"}
            title={locale === "fr" ? "Nouveau chat" : "New chat"}
            style={{
              position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
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
        {/* Agents-planètes (override expert), centrés sous Kairos */}
        <div className="planet-sel" style={{ minWidth: 0, justifyContent: "center" }}>
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

      {/* CHAT-FIRST-CONTACT-V1 : indique au user que Kairos a le thème natal en
          mémoire. Visible uniquement tant qu'il n'y a que le greeting initial
          (greeting = seul message, sans `planet` posé). Disparaît au 1er échange. */}
      {messages.length === 1
        && messages[0]?.role === "assistant"
        && (messages[0]?.planet === "kairos" || !messages[0]?.planet)
        && natalId
        && (
        <div className="chat-context-hint">
          <span aria-hidden style={{ color: "var(--gold)" }}>✦</span>
          <span>
            {locale === "fr"
              ? "Kairos a ton thème natal en mémoire — pose-lui des questions précises sur toi, tes transits, ou une période qui t'intrigue."
              : "Kairos has your natal chart in memory — ask precise questions about you, your transits, or a period that intrigues you."}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="chat-msgs">
        {messages.map((msg, i) => {
          if (!msg.content) return null;
          const isAssistant = msg.role === "assistant";
          // HOTFIX-KAIROS-CHAT-CONTEXT-V1 : la pastille reflète la planète qui a émis le message,
          // pas la planète active. Fallback sur currentPlanet pour le greeting
          // initial (qui n'a pas de `planet` stocké).
          const msgPlanet = (isAssistant && msg.planet)
            ? (AGENTS.find(p => p.key === msg.planet) ?? currentPlanet)
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
              {/* CHAT-MARKDOWN-V1 : rend les r\u00E9ponses Kairos en Markdown (gras,
                  italique, listes, code, citations). Les messages user restent
                  en plain-text \u2014 pas d'attente qu'un user tape du Markdown,
                  et pr\u00E9serve les newlines tels quels. react-markdown ne rend
                  PAS le HTML brut par d\u00E9faut \u2192 safe contre XSS. */}
              {isAssistant ? (
                <div className="chat-md">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content.split("\n").map((line, j) => (
                  <div key={j}>{line || "\u00A0"}</div>
                ))
              )}

              {/* KAIROS-HOST-V1 : pastilles \u00AB Creuser avec [plan\u00E8te] \u00BB propos\u00E9es
                  par Kairos. Au clic, la plan\u00E8te prend la parole sur le sujet. */}
              {isAssistant && msg.suggestions && msg.suggestions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {msg.suggestions.map(key => {
                    const ag = PLANETS.find(p => p.key === key);
                    if (!ag) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => void digDeeperWith(key)}
                        disabled={isTyping}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 12px", borderRadius: 999,
                          border: `1px solid ${ag.color}55`,
                          background: `${ag.color}14`,
                          color: ag.color,
                          fontFamily: "inherit", fontSize: 12.5,
                          cursor: isTyping ? "default" : "pointer",
                          opacity: isTyping ? 0.5 : 1,
                        }}
                      >
                        <span aria-hidden>{ag.emoji}</span>
                        <span>
                          {locale === "en" ? `Dig in with ${ag.nameEn}` : `Creuser avec ${ag.nameFr}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
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

      {/* Input — textarea pour permettre Shift+Enter multiline. Auto-resize
          jusqu'à 120 px puis scroll. Enter seul envoie, Shift+Enter = newline.
          Le useEffect sur `input` re-calcule la height à chaque mutation,
          y compris quand setInput("") la remet à zéro après send. */}
      <div className="chat-input-wrap">
        <textarea
          ref={inputRef}
          className="chat-input"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
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

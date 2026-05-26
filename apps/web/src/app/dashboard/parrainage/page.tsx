// ============================================================
// GROWTH-V1-PARRAINAGE-UI
// apps/web/src/app/dashboard/parrainage/page.tsx
// ------------------------------------------------------------
// Page de parrainage utilisateur. Lit GET /referrals/me (livré
// par #135), affiche le code, le lien à partager, les stats du
// cycle 30j glissant, et une explication courte de ce que les
// deux parties gagnent à l'activation.
//
// Note : tant que GROWTH-V1-ACTIVATION-HOOK n'est pas mergé,
// le compteur "activés" reste à 0 (les natals créés ne
// déclenchent encore aucune mise à jour de referrals.status).
// La page le mentionne discrètement.
// ============================================================

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/i18n";
import { referralsApi, type ReferralStatsPayload } from "@/lib/api/client";

function siteOrigin(): string {
  if (typeof window === "undefined") return "https://llmastro.com";
  return window.location.origin;
}

export default function ParrainagePage() {
  const { accessToken, plan } = useAuth();
  const { locale } = useApp();
  const fr = locale === "fr";
  const [copied, setCopied] = useState(false);

  const isPro = plan?.code === "premium";

  const query = useQuery({
    queryKey: ["referrals", "me"],
    queryFn: async () => {
      const res = await referralsApi.me(accessToken!);
      return (res as { success: true; data: ReferralStatsPayload }).data;
    },
    enabled: !!accessToken,
  });

  const data    = query.data ?? null;
  const loading = query.isPending;
  const error   = (query.error as { message?: string } | null)?.message ?? null;

  const shareUrl = data ? `${siteOrigin()}/?ref=${data.code}` : "";

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback : user copie à la main, silencieux */
    }
  };

  return (
    <div style={pageStyle}>
      {/* ─────────────── HERO ─────────────── */}
      <header style={{ textAlign: "center", marginBottom: 36 }}>
        <span style={eyebrowStyle}>
          {fr ? "Parrainage" : "Invite"}
        </span>
        <h1 style={titleStyle}>
          {fr ? "Faites découvrir " : "Share "}
          <span style={titleAccentStyle}>{fr ? "votre ciel" : "your sky"}</span>
        </h1>
        <p style={leadStyle}>
          {fr
            ? "Invitez vos proches à explorer leur thème natal. Quand l'un d'eux crée son premier profil, vous gagnez tous les deux un pack de crédits."
            : "Invite your loved ones to explore their birth chart. When one of them creates their first profile, you both earn a pack of credits."}
        </p>
      </header>

      {loading && (
        <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center" }}>
          {fr ? "Chargement…" : "Loading…"}
        </p>
      )}
      {error && (
        <p style={{ color: "var(--tension)", fontSize: 14, textAlign: "center" }}>
          {error}
        </p>
      )}

      {data && (
        <>
          {/* ─────────────── CODE + LIEN À PARTAGER ─────────────── */}
          <section style={cardStyle}>
            <div style={sectionTitleStyle}>
              {fr ? "Votre code" : "Your code"}
            </div>
            <div style={codeBlockStyle}>{data.code}</div>

            <div style={sectionTitleStyle}>
              {fr ? "Le lien à partager" : "Share link"}
            </div>
            <div style={shareBarStyle}>
              <div style={shareUrlStyle}>{shareUrl}</div>
              <button type="button" onClick={handleCopy} style={primaryButton(false)}>
                {copied ? (fr ? "Copié ✓" : "Copied ✓") : (fr ? "Copier" : "Copy")}
              </button>
            </div>
            <p style={hintStyle}>
              {fr
                ? "Quand quelqu'un s'inscrit via ce lien, il commence avec 14 jours d'essai Essentiel au lieu de 7."
                : "When someone signs up via this link, they start with 14 days of Essential trial instead of 7."}
            </p>
          </section>

          {/* ─────────────── STATS ─────────────── */}
          <section style={cardStyle}>
            <div style={sectionTitleStyle}>
              {fr ? "Votre cycle" : "Your cycle"}
            </div>
            <div style={statsGridStyle}>
              <Stat label={fr ? "Invités" : "Invited"}    value={data.totals.invited}   />
              <Stat label={fr ? "Activés" : "Activated"}  value={data.totals.activated} />
              <Stat label={fr ? "Récompensés" : "Rewarded"} value={data.totals.rewarded} />
            </div>
            <div style={capRowStyle}>
              <div style={capLabelStyle}>
                {fr ? "Plafond glissant 30 jours" : "Rolling 30-day cap"}
              </div>
              <div style={capValueStyle}>
                {data.capMonth.used} / {data.capMonth.max}
                <span style={capResetStyle}>
                  {fr ? " · réinitialisation " : " · resets "}
                  {new Date(data.capMonth.resetsAt).toLocaleDateString(
                    fr ? "fr-FR" : "en-US",
                    { day: "numeric", month: "short" },
                  )}
                </span>
              </div>
            </div>
          </section>

          {/* ─────────────── PACK GAGNÉ ─────────────── */}
          <section style={cardStyle}>
            <div style={sectionTitleStyle}>
              {fr ? "Ce que vous gagnez tous les deux" : "What you both earn"}
            </div>
            {isPro ? (
              <p style={{ ...hintStyle, marginTop: 0 }}>
                {fr ? (
                  <>
                    Vous êtes <strong style={{ color: "var(--gold)" }}>Pro</strong> — les crédits ne vous servent pas. À la place, chaque parrainage activé vous offre un <strong>bon cadeau&nbsp;: 1 mois Essentiel</strong> à transmettre à un proche. (Bientôt disponible.)
                  </>
                ) : (
                  <>
                    You&apos;re on <strong style={{ color: "var(--gold)" }}>Pro</strong> — feature credits don&apos;t help you. Instead, each activated referral gives you a <strong>gift code: 1 month of Essential</strong> to share. (Coming soon.)
                  </>
                )}
              </p>
            ) : (
              <div style={packGridStyle}>
                <PackItem label="Kairos"    value={10} unit={fr ? "messages" : "messages"} />
                <PackItem label="Tarot"     value={3}  unit={fr ? "tirages" : "spreads"}    />
                <PackItem label="Synastrie" value={1}  unit={fr ? "analyse" : "analysis"}   />
              </div>
            )}
            <p style={hintStyle}>
              {fr
                ? "Les crédits arrivent quand votre filleul crée son 1er profil natal et reste 3 jours."
                : "Credits arrive when your referral creates their 1st natal profile and stays for 3 days."}
            </p>
          </section>

          {/* ─────────────── FAQ COURTE ─────────────── */}
          <section style={cardStyle}>
            <div style={sectionTitleStyle}>
              {fr ? "En bref" : "Quick facts"}
            </div>
            <ul style={faqListStyle}>
              <li style={faqItemStyle}>
                <strong style={{ color: "var(--star)" }}>
                  {fr ? "Quand est-ce que je gagne ?" : "When do I earn?"}
                </strong>{" "}
                {fr
                  ? "À l'activation du filleul — création de son 1er thème natal + compte âgé de 3 jours."
                  : "On referral activation — when they create their 1st birth chart and the account is at least 3 days old."}
              </li>
              <li style={faqItemStyle}>
                <strong style={{ color: "var(--star)" }}>
                  {fr ? "Combien de parrainages je peux faire ?" : "How many invites can I make?"}
                </strong>{" "}
                {fr
                  ? `Jusqu'à ${data.capMonth.max} parrainages récompensés par cycle glissant de 30 jours.`
                  : `Up to ${data.capMonth.max} rewarded referrals per rolling 30-day window.`}
              </li>
              <li style={faqItemStyle}>
                <strong style={{ color: "var(--star)" }}>
                  {fr ? "Mon code est-il unique ?" : "Is my code unique?"}
                </strong>{" "}
                {fr
                  ? "Oui — généré une fois, à vie. Vous pouvez le partager partout."
                  : "Yes — generated once, for life. Share it anywhere."}
              </li>
            </ul>
          </section>

          {data.totals.invited > 0 && data.totals.activated === 0 && (
            <p style={{ ...hintStyle, textAlign: "center", marginTop: 24 }}>
              {fr
                ? "✦ Les activations apparaîtront ici dès que vos filleuls auront créé leur 1er thème."
                : "✦ Activations will appear here as soon as your referrals create their 1st chart."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCardStyle}>
      <div style={statValueStyle}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
    </div>
  );
}

function PackItem({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div style={packCardStyle}>
      <div style={packValueStyle}>+{value}</div>
      <div style={packLabelStyle}>{label}</div>
      <div style={packUnitStyle}>{unit}</div>
    </div>
  );
}

// ============================================================
// Styles inline — tokens globals.css uniquement
// ============================================================
const pageStyle: React.CSSProperties = {
  maxWidth: 760,
  margin:   "0 auto",
  padding:  "32px 20px 64px",
};

const eyebrowStyle: React.CSSProperties = {
  display:       "inline-block",
  fontSize:      11,
  letterSpacing: 4,
  textTransform: "uppercase",
  color:         "var(--gold)",
  marginBottom:  12,
};

const titleStyle: React.CSSProperties = {
  fontSize:      "clamp(28px, 4vw, 38px)",
  color:         "var(--star)",
  margin:        "0 0 12px",
  fontWeight:    400,
  letterSpacing: 0.4,
  lineHeight:    1.15,
};

const titleAccentStyle: React.CSSProperties = {
  color:     "var(--gold)",
  fontStyle: "italic",
};

const leadStyle: React.CSSProperties = {
  fontSize:    15,
  color:       "var(--muted)",
  fontStyle:   "italic",
  maxWidth:    560,
  margin:      "0 auto",
  lineHeight:  1.55,
};

const cardStyle: React.CSSProperties = {
  background:    "var(--card-bg)",
  border:        "1px solid var(--card-border)",
  borderRadius:  16,
  padding:       "22px 24px",
  marginBottom:  16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize:      11,
  textTransform: "uppercase",
  letterSpacing: 1.5,
  color:         "var(--muted)",
  marginBottom:  10,
};

const codeBlockStyle: React.CSSProperties = {
  background:    "var(--bg-raised)",
  border:        "1px solid var(--border-mid)",
  borderRadius:  10,
  padding:       "16px 20px",
  fontSize:      24,
  letterSpacing: 4,
  color:         "var(--gold)",
  textAlign:     "center",
  fontFamily:    "ui-monospace, 'SF Mono', Menlo, monospace",
  marginBottom:  20,
};

const shareBarStyle: React.CSSProperties = {
  background:    "var(--bg-raised)",
  border:        "1px solid var(--border-soft)",
  borderRadius:  10,
  padding:       "10px 14px",
  display:       "flex",
  alignItems:    "center",
  gap:           12,
  flexWrap:      "wrap",
  marginBottom:  10,
};

const shareUrlStyle: React.CSSProperties = {
  flex:         1,
  fontFamily:   "ui-monospace, 'SF Mono', Menlo, monospace",
  fontSize:     13,
  color:        "var(--star)",
  whiteSpace:   "nowrap",
  overflow:     "hidden",
  textOverflow: "ellipsis",
  minWidth:     0,
};

const hintStyle: React.CSSProperties = {
  fontSize:   13,
  color:      "var(--muted)",
  lineHeight: 1.55,
  marginTop:  10,
};

const statsGridStyle: React.CSSProperties = {
  display:             "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap:                 12,
  marginBottom:        16,
};

const statCardStyle: React.CSSProperties = {
  background:    "var(--bg-raised)",
  border:        "1px solid var(--border-soft)",
  borderRadius:  10,
  padding:       "14px 12px",
  textAlign:     "center",
};

const statValueStyle: React.CSSProperties = {
  fontSize:    24,
  color:       "var(--star)",
  fontWeight:  300,
  lineHeight:  1,
};

const statLabelStyle: React.CSSProperties = {
  fontSize:      11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color:         "var(--muted-2)",
  marginTop:     6,
};

const capRowStyle: React.CSSProperties = {
  borderTop:     "1px solid var(--border-soft)",
  paddingTop:    14,
  display:       "flex",
  justifyContent: "space-between",
  alignItems:    "center",
  flexWrap:      "wrap",
  gap:           8,
};

const capLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color:    "var(--muted)",
};

const capValueStyle: React.CSSProperties = {
  fontSize: 14,
  color:    "var(--star)",
};

const capResetStyle: React.CSSProperties = {
  fontSize: 12,
  color:    "var(--muted-2)",
};

const packGridStyle: React.CSSProperties = {
  display:             "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap:                 10,
};

const packCardStyle: React.CSSProperties = {
  background:    "var(--bg-raised)",
  border:        "1px solid var(--border-soft)",
  borderRadius:  10,
  padding:       "14px 12px",
  textAlign:     "center",
};

const packValueStyle: React.CSSProperties = {
  fontSize:   20,
  color:      "var(--gold)",
  fontWeight: 400,
};

const packLabelStyle: React.CSSProperties = {
  fontSize:   13,
  color:      "var(--star)",
  marginTop:  3,
};

const packUnitStyle: React.CSSProperties = {
  fontSize: 11,
  color:    "var(--muted-2)",
  marginTop: 3,
};

const faqListStyle: React.CSSProperties = {
  listStyle:  "none",
  padding:    0,
  margin:     0,
  display:    "flex",
  flexDirection: "column",
  gap:        12,
};

const faqItemStyle: React.CSSProperties = {
  fontSize:   13,
  color:      "var(--muted)",
  lineHeight: 1.55,
};

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    background:    "var(--violet)",
    color:         "var(--bg)",
    border:        "1px solid var(--violet)",
    padding:       "9px 18px",
    borderRadius:  8,
    fontSize:      13,
    letterSpacing: 0.5,
    cursor:        disabled ? "not-allowed" : "pointer",
    opacity:       disabled ? 0.55 : 1,
    fontFamily:    "inherit",
  };
}

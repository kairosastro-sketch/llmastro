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
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/i18n";
import { referralsApi, type ReferralStatsPayload, type GiftCodeView } from "@/lib/api/client";

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

  // GROWTH-REFERRAL-CONVERSION-V1 : bons « 1 mois Essentiel » gagnés à la
  // conversion d'un filleul.
  const qc = useQueryClient();
  const giftsQuery = useQuery({
    queryKey: ["referrals", "gifts"],
    queryFn: async () => {
      const res = await referralsApi.gifts(accessToken!);
      return (res as { success: true; data: { codes: GiftCodeView[] } }).data.codes;
    },
    enabled: !!accessToken,
  });
  const gifts = giftsQuery.data ?? [];

  const redeem = useMutation({
    mutationFn: (code: string) => referralsApi.redeemGift(accessToken!, code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referrals", "gifts"] });
      qc.invalidateQueries({ queryKey: ["tiers"] });
    },
  });

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
          {fr ? "Découvrez votre " : "Discover your "}
          <span style={titleAccentStyle}>{fr ? "compatibilité" : "compatibility"}</span>
          {fr ? " à deux" : " together"}
        </h1>
        <p style={leadStyle}>
          {fr
            ? "Invitez un proche à explorer son thème natal. À l'activation, vous débloquez tous les deux 30 jours de synastrie complète — de quoi analyser votre compatibilité ensemble — plus un pack de crédits. Et s'il s'abonne, vous recevez un mois Essentiel offert."
            : "Invite a loved one to explore their birth chart. On activation, you both unlock 30 days of full synastry — to analyze your compatibility together — plus a pack of credits. And if they subscribe, you get a free month of Essential."}
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
            {/* GROWTH-REFERRAL-SYNASTRY-V1 : le bonus synastrie est la récompense phare */}
            <div style={synBonusStyle}>
              <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>♡</span>
              <div>
                <div style={synBonusTitleStyle}>
                  {fr ? "30 jours de synastrie complète, pour vous deux" : "30 days of full synastry, for both of you"}
                </div>
                <div style={synBonusDescStyle}>
                  {fr
                    ? "L'interprétation détaillée de votre compatibilité, débloquée des deux côtés à l'activation."
                    : "The detailed reading of your compatibility, unlocked on both sides on activation."}
                </div>
              </div>
            </div>

            {isPro ? (
              <p style={{ ...hintStyle, marginTop: 14 }}>
                {fr ? (
                  <>
                    Vous êtes <strong style={{ color: "var(--gold)" }}>Pro</strong> — les crédits ne vous servent pas. À la place, chaque parrainage activé vous offre un <strong>bon cadeau&nbsp;: 1 mois Essentiel</strong> à transmettre à un proche. Retrouvez vos bons plus bas.
                  </>
                ) : (
                  <>
                    You&apos;re on <strong style={{ color: "var(--gold)" }}>Pro</strong> — feature credits don&apos;t help you. Instead, each activated referral gives you a <strong>gift code: 1 month of Essential</strong> to share. Find your codes below.
                  </>
                )}
              </p>
            ) : (
              <div style={packGridStyle}>
                <PackItem label="Kairos"    value={10} unit={fr ? "messages" : "messages"} />
                <PackItem label="Synastrie" value={1}  unit={fr ? "crédit en plus" : "extra credit"} />
              </div>
            )}
            <p style={hintStyle}>
              {fr
                ? "La récompense arrive quand votre filleul crée son 1er profil natal et reste 3 jours."
                : "The reward arrives when your referral creates their 1st natal profile and stays for 3 days."}
            </p>
          </section>

          {/* ─────────────── BONS GAGNÉS (conversion) ─────────────── */}
          {gifts.length > 0 && (
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>
                {fr ? "Vos mois offerts" : "Your free months"}
              </div>
              <p style={{ ...hintStyle, marginTop: 0, marginBottom: 14 }}>
                {fr
                  ? "Gagnés quand un filleul s'abonne. Activez-en un pour passer à Essentiel pendant 1 mois."
                  : "Earned when a referral subscribes. Redeem one for 1 month of Essential."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {gifts.map((g) => (
                  <GiftRow
                    key={g.code}
                    gift={g}
                    fr={fr}
                    onRedeem={() => redeem.mutate(g.code)}
                    redeeming={redeem.isPending && redeem.variables === g.code}
                  />
                ))}
              </div>
              {redeem.isError && (
                <p style={{ fontSize: 12.5, color: "var(--tension)", marginTop: 10 }}>
                  {fr ? "Échec de l'activation du bon. Réessayez." : "Couldn't redeem the code. Try again."}
                </p>
              )}
              {redeem.isSuccess && (
                <p style={{ fontSize: 12.5, color: "var(--gold)", marginTop: 10 }}>
                  {fr ? "Bon activé — vous êtes passé à Essentiel ✓" : "Redeemed — you're now on Essential ✓"}
                </p>
              )}
            </section>
          )}

          {/* ─────────────── CTA SYNASTRIE ─────────────── */}
          <Link href="/dashboard/explore?tab=compat" style={ctaCardStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={ctaTitleStyle}>
                {fr ? "Faites votre compatibilité" : "Run your compatibility"}
              </div>
              <div style={ctaDescStyle}>
                {fr
                  ? "Votre filleul a rejoint Llmastro ? Analysez votre synastrie ensemble — ou testez dès maintenant avec les données de naissance d'un proche."
                  : "Your referral joined Llmastro? Analyze your synastry together — or try now with a loved one's birth data."}
              </div>
            </div>
            <span style={{ color: "var(--gold)", fontSize: 18, flexShrink: 0 }} aria-hidden>→</span>
          </Link>

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

// GROWTH-REFERRAL-CONVERSION-V1 — une ligne « bon cadeau » avec action redeem.
function GiftRow({ gift, fr, onRedeem, redeeming }: {
  gift: GiftCodeView; fr: boolean; onRedeem: () => void; redeeming: boolean;
}) {
  const statusLabel =
    gift.status === "redeemed" ? (fr ? "Activé" : "Redeemed")
    : gift.status === "expired" ? (fr ? "Expiré" : "Expired")
    : (fr ? "Disponible" : "Available");
  return (
    <div style={giftRowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={giftCodeStyle}>{gift.code}</div>
        <div style={giftMetaStyle}>
          {statusLabel}
          {gift.status === "unused" && (
            <>
              {" · "}
              {fr ? "expire le " : "expires "}
              {new Date(gift.expiresAt).toLocaleDateString(fr ? "fr-FR" : "en-US", { day: "numeric", month: "short" })}
            </>
          )}
        </div>
      </div>
      {gift.status === "unused" ? (
        <button type="button" onClick={onRedeem} disabled={redeeming} style={primaryButton(redeeming)}>
          {redeeming ? (fr ? "Activation…" : "Redeeming…") : (fr ? "Activer" : "Redeem")}
        </button>
      ) : (
        <span style={{ fontSize: 12, color: "var(--muted-2)" }}>{statusLabel}</span>
      )}
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
  gridTemplateColumns: "repeat(2, 1fr)",
  gap:                 10,
};

// GROWTH-REFERRAL-SYNASTRY-V1 — encart « bonus synastrie » mis en avant.
const synBonusStyle: React.CSSProperties = {
  display:      "flex",
  alignItems:   "flex-start",
  gap:          12,
  background:   "rgba(201,168,76,0.07)",
  border:       "1px solid var(--gold)",
  borderRadius: 12,
  padding:      "14px 16px",
  color:        "var(--gold)",
};

const synBonusTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize:   15,
  color:      "var(--star)",
  lineHeight: 1.35,
};

const synBonusDescStyle: React.CSSProperties = {
  fontSize:   12.5,
  color:      "var(--muted)",
  lineHeight: 1.5,
  marginTop:  4,
};

// CTA vers le flux synastrie (carte cliquable).
const ctaCardStyle: React.CSSProperties = {
  display:        "flex",
  alignItems:     "center",
  gap:            12,
  background:     "var(--card-bg)",
  border:         "1px solid var(--card-border)",
  borderRadius:   16,
  padding:        "18px 22px",
  marginBottom:   16,
  textDecoration: "none",
  color:          "inherit",
};

const ctaTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize:   16,
  color:      "var(--star)",
};

const ctaDescStyle: React.CSSProperties = {
  fontSize:   13,
  color:      "var(--muted)",
  lineHeight: 1.5,
  marginTop:  3,
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

// GROWTH-REFERRAL-CONVERSION-V1 — lignes de bons cadeaux.
const giftRowStyle: React.CSSProperties = {
  display:      "flex",
  alignItems:   "center",
  gap:          12,
  background:   "var(--bg-raised)",
  border:       "1px solid var(--border-soft)",
  borderRadius: 10,
  padding:      "12px 14px",
};

const giftCodeStyle: React.CSSProperties = {
  fontFamily:    "ui-monospace, 'SF Mono', Menlo, monospace",
  fontSize:      14,
  letterSpacing: 1.5,
  color:         "var(--gold)",
};

const giftMetaStyle: React.CSSProperties = {
  fontSize:  11.5,
  color:     "var(--muted)",
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

"use client";

// ============================================================
// COMMUNITY-V1-UI — « Ta place dans le ciel collectif »
// ------------------------------------------------------------
// Surface front des stats sociales anonymes (cf. COMMUNITY-V1.md).
// Backend : routes /community/* (opt-in strict, k-anonymité K_MIN,
// big three Soleil/Lune/Ascendant, feature gratuite).
//
//   • Non inscrit  → encart pédagogique + opt-in (choix du thème "moi").
//   • Inscrit      → placements vs population + distribution par signe
//                     + carte partageable (hook acquisition) + opt-out.
// ============================================================

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/i18n";
import {
  communityApi,
  natalApi,
  referralsApi,
  type CommunityDimension,
  type CommunityPlacement,
  type CommunityPlacementStats,
} from "@/lib/api/client";
import { ShareButton } from "@/components/ui/ShareButton";
import { buildPlacementSlug } from "@/lib/share/placement-slug";

// Signes : le backend renvoie le nom anglais canonique ("Aries" … "Pisces").
const SIGN_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;
const SIGN_GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
const SIGN_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
const SIGN_EN = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

function signIdxOf(name: string): number {
  return SIGN_ORDER.indexOf(name as (typeof SIGN_ORDER)[number]);
}
function signGlyph(name: string): string {
  const i = signIdxOf(name);
  return i >= 0 ? SIGN_GLYPHS[i]! : "✦";
}
function signLabel(name: string, fr: boolean): string {
  const i = signIdxOf(name);
  if (i < 0) return name;
  return (fr ? SIGN_FR : SIGN_EN)[i]!;
}

// Planètes big three : libellé + possessif français accordé en genre.
// La Lune est féminine → « ta Lune » ; Soleil / Ascendant → « ton ».
const PLANET_FR: Record<string, { label: string; poss: string }> = {
  Sun:       { label: "Soleil",    poss: "ton" },
  Moon:      { label: "Lune",      poss: "ta"  },
  Ascendant: { label: "Ascendant", poss: "ton" },
};
const PLANET_EN: Record<string, string> = {
  Sun: "Sun", Moon: "Moon", Ascendant: "Ascendant",
};
const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Ascendant: "Asc",
};

interface NatalProfile {
  id: string;
  label?: string;
  name?: string;
  isSelf?: boolean;
  birthTimeUnknown?: boolean;
}

export default function CommunautePage() {
  const { accessToken } = useAuth();
  const { locale } = useApp();
  const fr = locale !== "en";
  const qc = useQueryClient();

  // Profils natals (pour le choix du thème "moi" à l'opt-in).
  const { data: profilesRes } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });
  const profiles: NatalProfile[] = useMemo(
    () => ((profilesRes as any)?.data?.profiles ?? []) as NatalProfile[],
    [profilesRes],
  );

  // Stats du membre (état d'opt-in + placements vs population).
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ["community", "placement-stats"],
    queryFn: () => communityApi.placementStats(accessToken!),
    enabled: !!accessToken,
  });
  const stats = (statsRes as any)?.data as CommunityPlacementStats | undefined;
  const optedIn = stats?.optedIn === true;

  if (!accessToken || statsLoading) {
    return (
      <div className="page-root">
        <div className="flex-center" style={{ padding: 60 }} role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span className="sr-only">{fr ? "Chargement…" : "Loading…"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root">
      <header className="animate-fade-up" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 6 }}>
          {fr ? "Communauté" : "Community"}
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1.2,
          color: "var(--star)", margin: 0,
        }}>
          {fr ? "Ta place dans le ciel collectif" : "Your place in the collective sky"}
        </h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--muted)", marginTop: 10, maxWidth: "60ch" }}>
          {fr
            ? "Des statistiques anonymes et agrégées : avec combien de membres tu partages ton Soleil, ta Lune, ton Ascendant. Aucun autre membre ne t'est jamais montré, et toi non plus."
            : "Anonymous, aggregated statistics: how many members share your Sun, Moon and Ascendant. No member is ever shown to another — including you."}
        </p>
      </header>

      {optedIn
        ? <OptedInView fr={fr} stats={stats!} token={accessToken} />
        : <OptInGate fr={fr} kMin={stats?.kMin ?? 20} profiles={profiles} token={accessToken} onDone={() => qc.invalidateQueries({ queryKey: ["community"] })} />
      }
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Encart d'opt-in (non inscrit)
// ──────────────────────────────────────────────────────────
function OptInGate({ fr, kMin, profiles, token, onDone }: {
  fr: boolean; kMin: number; profiles: NatalProfile[]; token: string; onDone: () => void;
}) {
  // Défaut : profil "moi" déjà désigné, sinon le premier (le principal en tête).
  const initial = profiles.find(p => p.isSelf)?.id ?? profiles[0]?.id ?? "";
  const [natalId, setNatalId] = useState<string>(initial);
  const chosen = profiles.find(p => p.id === natalId);

  const mutation = useMutation({
    mutationFn: () => communityApi.optIn(token, natalId),
    onSuccess: onDone,
  });

  if (profiles.length === 0) {
    return (
      <div className="empty-state animate-fade-up">
        <div className="ico">✦</div>
        <p className="msg">
          {fr
            ? "Crée d'abord ton thème natal pour rejoindre les statistiques communautaires."
            : "Create your natal chart first to join the community statistics."}
        </p>
        <Link href="/dashboard/natal" className="btn-ghost" style={{ marginTop: 18 }}>
          {fr ? "Créer mon thème" : "Create my chart"} →
        </Link>
      </div>
    );
  }

  return (
    <div className="card animate-fade-up delay-100" style={{ padding: 22 }}>
      {/* Pédagogie : ce qu'on partage, et surtout ce qu'on ne partage pas. */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <Bullet>
          {fr
            ? <>Seuls tes placements <strong>Soleil, Lune et Ascendant</strong> entrent dans les agrégats — jamais ta date, ton heure ni ton lieu de naissance.</>
            : <>Only your <strong>Sun, Moon and Ascendant</strong> feed the aggregates — never your birth date, time or place.</>}
        </Bullet>
        <Bullet>
          {fr
            ? <>Un placement n'est affiché que s'il regroupe <strong>au moins {kMin} membres</strong> (k-anonymité) — impossible de remonter à une personne.</>
            : <>A placement is shown only if it groups <strong>at least {kMin} members</strong> (k-anonymity) — no individual can be identified.</>}
        </Bullet>
        <Bullet>
          {fr
            ? <>Tu peux <strong>te retirer à tout moment</strong> : ta contribution est effacée aussitôt.</>
            : <>You can <strong>leave at any time</strong>: your contribution is erased immediately.</>}
        </Bullet>
        <Bullet>
          {fr
            ? <>C'est <strong>gratuit</strong>, et ça reste anonyme.</>
            : <>It's <strong>free</strong>, and stays anonymous.</>}
        </Bullet>
      </ul>

      <div className="sep" style={{ margin: "20px 0" }} />

      {/* Choix du thème "moi" projeté dans les agrégats. */}
      <label className="form-label" htmlFor="self-profile">
        {fr ? "Le thème qui te représente" : "The chart that represents you"}
      </label>
      <select
        id="self-profile"
        value={natalId}
        onChange={e => setNatalId(e.target.value)}
        style={{ marginTop: 6 }}
      >
        {profiles.map(p => (
          <option key={p.id} value={p.id}>{p.label ?? p.name ?? "—"}</option>
        ))}
      </select>

      {chosen?.birthTimeUnknown && (
        <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", marginTop: 8 }}>
          {fr
            ? "Heure de naissance inconnue pour ce thème : ton Ascendant ne sera pas comptabilisé (Soleil et Lune le seront)."
            : "Birth time unknown for this chart: your Ascendant won't be counted (Sun and Moon will be)."}
        </p>
      )}

      {mutation.isError && (
        <p style={{ fontSize: 12.5, color: "var(--tension)", marginTop: 12 }}>
          {fr ? "Impossible de t'inscrire pour le moment. Réessaie dans un instant."
              : "Couldn't opt you in right now. Please try again shortly."}
        </p>
      )}

      <button
        className="btn-ob"
        disabled={!natalId || mutation.isPending}
        onClick={() => mutation.mutate()}
        style={{
          marginTop: 18, padding: "11px 22px", fontSize: 13.5,
          letterSpacing: ".02em", width: "auto", opacity: mutation.isPending ? 0.6 : 1,
        }}
      >
        {mutation.isPending
          ? (fr ? "Inscription…" : "Joining…")
          : (fr ? "Rejoindre le ciel collectif ✦" : "Join the collective sky ✦")}
      </button>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13.5, lineHeight: 1.55, color: "var(--star)" }}>
      <span aria-hidden style={{ color: "var(--gold)", flexShrink: 0 }}>✦</span>
      <span>{children}</span>
    </li>
  );
}

// ──────────────────────────────────────────────────────────
// Vue inscrite : placements + distribution + carte + opt-out
// ──────────────────────────────────────────────────────────
function OptedInView({ fr, stats, token }: {
  fr: boolean; stats: CommunityPlacementStats; token: string;
}) {
  const qc = useQueryClient();
  const placements = stats.optedIn ? stats.placements : [];
  const kMin = stats.kMin;

  const optOut = useMutation({
    mutationFn: () => communityApi.optOut(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community"] }),
  });

  // Cas limite : opt-in actif mais projection pas encore faite.
  if (stats.optedIn && stats.needsProjection) {
    return (
      <div className="card animate-fade-up delay-100" style={{ padding: 22 }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--star)" }}>
          {fr
            ? "Ton thème vient d'être projeté dans les agrégats. Recharge la page dans un instant pour voir ta place."
            : "Your chart was just projected into the aggregates. Reload in a moment to see your place."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Placements du membre vs population */}
      <section className="animate-fade-up delay-100" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {placements.map(p => (
          <PlacementCard key={p.planet} fr={fr} p={p} kMin={kMin} />
        ))}
        {placements.length === 0 && (
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
              {fr ? "Aucun placement à afficher pour l'instant." : "No placement to show yet."}
            </p>
          </div>
        )}
      </section>

      {/* Carte partageable (hook acquisition) */}
      <ShareCard fr={fr} placements={placements} token={token} />

      {/* Distribution agrégée par dimension */}
      <DistributionPanel fr={fr} token={token} />

      {/* Opt-out discret */}
      <div className="animate-fade-up" style={{ marginTop: 26, textAlign: "center" }}>
        <button
          onClick={() => optOut.mutate()}
          disabled={optOut.isPending}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 12, color: "var(--muted)", textDecoration: "underline",
            opacity: optOut.isPending ? 0.5 : 1,
          }}
        >
          {optOut.isPending
            ? (fr ? "Retrait…" : "Leaving…")
            : (fr ? "Quitter les statistiques communautaires" : "Leave community statistics")}
        </button>
      </div>
    </>
  );
}

// Carte d'un placement : « Tu partages ta Lune en Scorpion avec 8% des membres ».
function PlacementCard({ fr, p, kMin }: { fr: boolean; p: CommunityPlacement; kMin: number }) {
  const planetName = fr ? (PLANET_FR[p.planet]?.label ?? p.planet) : (PLANET_EN[p.planet] ?? p.planet);
  const poss = PLANET_FR[p.planet]?.poss ?? "ton";
  const sign = signLabel(p.sign, fr);
  const glyph = signGlyph(p.sign);

  return (
    <div className="card" style={{ padding: 18, display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{
        flexShrink: 0, width: 44, height: 44, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-raised)", border: "1px solid var(--border-soft)",
        fontSize: 20, color: "var(--gold)",
      }} aria-hidden>
        {glyph}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          <span aria-hidden style={{ marginRight: 5 }}>{PLANET_GLYPH[p.planet] ?? "✦"}</span>
          {planetName} {fr ? "en" : "in"} {sign}
        </div>

        {p.kOk && p.sharePct !== null ? (
          <>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 15.5, lineHeight: 1.45, color: "var(--star)", margin: 0 }}>
              {fr
                ? <>Tu partages {poss} {planetName} en {sign} avec <strong style={{ color: "var(--gold)" }}>{p.sharePct}%</strong> des membres.</>
                : <>You share your {planetName} in {sign} with <strong style={{ color: "var(--gold)" }}>{p.sharePct}%</strong> of members.</>}
            </p>
            <div className="score-gauge" role="img" aria-label={`${p.sharePct}%`} style={{ marginTop: 10 }}>
              <div className="score-gauge-fill" style={{ width: `${Math.max(3, Math.min(100, p.sharePct))}%` }} />
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", margin: 0 }}>
            {fr
              ? `Encore trop peu de membres partagent ce placement pour l'afficher (seuil de ${kMin}). Reviens quand la communauté aura grandi.`
              : `Too few members share this placement to show it yet (threshold of ${kMin}). Come back as the community grows.`}
          </p>
        )}
      </div>
    </div>
  );
}

// Carte partageable : reprend le placement le plus distinctif (part la plus
// faible parmi les buckets k-OK) — meilleur hook — sinon le Soleil. Lien ?ref=
// réutilisant le code de parrainage du membre (O-05).
function ShareCard({ fr, placements, token }: {
  fr: boolean; placements: CommunityPlacement[]; token: string;
}) {
  const { data: refRes } = useQuery({
    queryKey: ["referrals", "me"],
    queryFn: () => referralsApi.me(token),
    enabled: !!token,
    retry: false,
  });
  const refCode = (refRes as any)?.data?.code as string | undefined;

  const visible = placements.filter(p => p.kOk && p.sharePct !== null);
  if (visible.length === 0) return null;

  // Placement phare = le plus rare (sharePct le plus bas).
  const star = visible.reduce((a, b) => (b.sharePct! < a.sharePct! ? b : a));
  const planetName = fr ? (PLANET_FR[star.planet]?.label ?? star.planet) : (PLANET_EN[star.planet] ?? star.planet);
  const sign = signLabel(star.sign, fr);
  const glyph = signGlyph(star.sign);

  // COMMUNITY-SHARE-OG-V1 : lien vers la page de partage publique (OG dynamique
  // par placement, 100 % anonyme), avec ?ref= si le membre a un code parrainage.
  const origin = typeof window !== "undefined" ? window.location.origin : "https://llmastro.com";
  const slug = buildPlacementSlug(star.planet, star.sign, star.sharePct!);
  // EN partage la route préfixée /en ; FR garde la route nue.
  const base = `${origin}${fr ? "" : "/en"}/partage/placement/${slug}`;
  const shareUrl = refCode ? `${base}?ref=${encodeURIComponent(refCode)}` : base;
  const shareText = fr
    ? `Je fais partie des ${star.sharePct}% qui ont leur ${planetName} en ${sign} ✦ Découvre ta place dans le ciel collectif sur Llmastro.`
    : `I'm among the ${star.sharePct}% with ${planetName} in ${sign} ✦ Find your place in the collective sky on Llmastro.`;

  return (
    <section className="animate-fade-up delay-200" style={{ marginTop: 22 }}>
      <div className="section-title">{fr ? "Ta carte à partager" : "Your shareable card"}</div>
      <div className="card-gold card" style={{
        padding: 26, textAlign: "center", position: "relative", overflow: "hidden",
        border: "1px solid var(--gold)",
      }}>
        <div aria-hidden style={{
          position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 65%)", pointerEvents: "none",
        }} />
        <div style={{ fontSize: 40, color: "var(--gold)", lineHeight: 1 }} aria-hidden>{glyph}</div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1.4, color: "var(--star)", margin: "14px 0 6px" }}>
          {fr ? <>Je fais partie des <span style={{ color: "var(--gold)" }}>{star.sharePct}%</span></>
              : <>I'm among the <span style={{ color: "var(--gold)" }}>{star.sharePct}%</span></>}
        </p>
        <p style={{ fontSize: 14, color: "var(--star)", margin: 0 }}>
          {fr ? `avec ${planetName} en ${sign}` : `with ${planetName} in ${sign}`}
        </p>
        <div style={{ marginTop: 18, fontSize: 11, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase" }}>
          ✦ Llmastro
        </div>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
          <ShareButton
            url={shareUrl}
            title="Llmastro"
            text={shareText}
            label={fr ? "Partager" : "Share"}
            copiedLabel={fr ? "Lien copié ✓" : "Link copied ✓"}
          />
        </div>
      </div>
    </section>
  );
}

// Distribution agrégée d'une dimension (onglets Soleil / Lune / Ascendant).
function DistributionPanel({ fr, token }: { fr: boolean; token: string }) {
  const [dim, setDim] = useState<CommunityDimension>("sun");

  const { data: distRes, isLoading } = useQuery({
    queryKey: ["community", "distribution", dim],
    queryFn: () => communityApi.distribution(token, dim),
    enabled: !!token,
  });
  const dist = (distRes as any)?.data as
    | { dimension: CommunityDimension; kMin: number; total: number | null; hiddenSigns: number; buckets: { sign: string; count: number; sharePct: number }[] }
    | undefined;

  const TABS: { key: CommunityDimension; fr: string; en: string }[] = [
    { key: "sun", fr: "Soleil", en: "Sun" },
    { key: "moon", fr: "Lune", en: "Moon" },
    { key: "ascendant", fr: "Ascendant", en: "Ascendant" },
  ];
  const maxShare = dist?.buckets.reduce((m, b) => Math.max(m, b.sharePct), 0) ?? 0;

  return (
    <section className="animate-fade-up" style={{ marginTop: 26 }}>
      <div className="section-title">{fr ? "Répartition de la communauté" : "Community distribution"}</div>

      <div className="subnav no-print" style={{ marginBottom: 12 }}>
        {TABS.map(tb => (
          <button
            key={tb.key}
            className={`subnav-tab${dim === tb.key ? " active" : ""}`}
            onClick={() => setDim(tb.key)}
          >
            {fr ? tb.fr : tb.en}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 18 }}>
        {isLoading ? (
          <div className="flex-center" style={{ padding: 20 }}><div className="spinner" aria-hidden /></div>
        ) : !dist || dist.buckets.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
            {fr
              ? `Pas encore assez de membres inscrits pour cette dimension (seuil de ${dist?.kMin ?? 20} par signe).`
              : `Not enough members opted in for this dimension yet (threshold of ${dist?.kMin ?? 20} per sign).`}
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dist.buckets.map(b => (
                <div key={b.sign} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 22, fontSize: 16, color: "var(--gold)", flexShrink: 0, textAlign: "center" }} aria-hidden>
                    {signGlyph(b.sign)}
                  </span>
                  <span style={{ width: 84, fontSize: 12.5, color: "var(--star)", flexShrink: 0 }}>
                    {signLabel(b.sign, fr)}
                  </span>
                  <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--bg-raised)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${maxShare > 0 ? Math.max(2, (b.sharePct / maxShare) * 100) : 0}%`,
                      background: "var(--gold)", borderRadius: 999,
                    }} />
                  </div>
                  <span style={{ width: 38, fontSize: 12, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
                    {b.sharePct}%
                  </span>
                </div>
              ))}
            </div>
            {dist.hiddenSigns > 0 && (
              <p style={{ fontSize: 11.5, color: "var(--muted)", fontStyle: "italic", marginTop: 14 }}>
                {fr
                  ? `${dist.hiddenSigns} signe${dist.hiddenSigns > 1 ? "s" : ""} regroupe${dist.hiddenSigns > 1 ? "nt" : ""} encore trop peu de membres pour être affiché${dist.hiddenSigns > 1 ? "s" : ""} (k-anonymité).`
                  : `${dist.hiddenSigns} sign${dist.hiddenSigns > 1 ? "s" : ""} still group${dist.hiddenSigns > 1 ? "" : "s"} too few members to be shown (k-anonymity).`}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// COMMUNITY-V1-UI applied

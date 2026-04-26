"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";

interface PlanPayload {
  id: string;
  code: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  billingPeriod: string;
  sortOrder: number;
  entitlements: { featureKey: string; valueType: string; value: unknown }[];
}

const FEATURE_DISPLAY: { key: string; label: string }[] = [
  { key: "natal.profiles.max",       label: "Profils natals" },
  { key: "ai.chat.daily",            label: "Messages Kairos / jour" },
  { key: "tarot.daily",              label: "Tirages de tarot / jour" },
  { key: "horoscope.daily",          label: "Horoscope du jour" },
  { key: "horoscope.weekly",         label: "Horoscope de la semaine" },
  { key: "horoscope.monthly",        label: "Horoscope du mois" },
  { key: "horoscope.yearly",         label: "Horoscope de l'année" },
  { key: "transits.forecast_days",   label: "Prévisions transits" },
  { key: "transits.biwheel",         label: "Bi-wheel (thème + transits)" },
  { key: "synastry.monthly",         label: "Synastries / mois" },
  { key: "natal.aspects_advanced",   label: "Aspects avancés" },
  { key: "ai.natal_reading.monthly", label: "Lectures complètes IA / mois" },
  { key: "reports.monthly_credits",  label: "Rapports détaillés / mois" },
  { key: "reports.export_pdf",       label: "Export PDF" },
  { key: "data.export",              label: "Export de tes données" },
  { key: "support.priority",         label: "Support prioritaire" },
];

export default function PricingPage() {
  const [plans, setPlans]             = useState<PlanPayload[] | null>(null);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<{ plans: PlanPayload[] }>("/subscriptions/plans")
      .then((res: any) => setPlans((res.data.plans as PlanPayload[]).sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setError("Impossible de charger les plans."));

    const token = typeof window !== "undefined" ? sessionStorage.getItem("astro:access_token") : null;
    if (!token) return;
    setIsLoggedIn(true);
    apiClient.get("/auth/me", token)
      .then((res: any) => setCurrentCode(res.data?.plan?.code ?? null))
      .catch(() => {});
  }, []);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "var(--gold)", marginBottom: 8 }}>
          Choisis ton plan
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", fontStyle: "italic", letterSpacing: ".3px" }}>
          Découvre ton ciel à ton rythme. Change ou annule quand tu veux.
        </p>
        {/* PATCH-KAIROS-NAMING-AND-JPL-V1 : trust signal JPL NASA sur la page pricing */}
        <p style={{ fontSize: 12, color: "var(--muted-2, #8a8598)", marginTop: 8, letterSpacing: ".2px" }}>
          Positions planétaires issues des tables JPL de la NASA — précision astronomique.
        </p>
        <div className="sep" />
      </header>

      {error && (
        <div className="alert-banner" style={{ marginBottom: 20 }}>
          <span className="ab-ico">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {!plans ? (
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ height: 480 }}>
              <div className="spinner" style={{ margin: "40% auto 0" }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} isCurrent={currentCode === p.code} isLoggedIn={isLoggedIn} />
          ))}
        </div>
      )}

      <p style={{ marginTop: 32, textAlign: "center", fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
        Pas encore prêt ? Tu peux continuer à profiter du plan Découverte gratuitement.
      </p>
    </main>
  );
}

function PlanCard({ plan, isCurrent, isLoggedIn }: { plan: PlanPayload; isCurrent: boolean; isLoggedIn: boolean }) {
  const isHighlighted = plan.code === "essential";
  // PATCH-PLANS-REBRAND-V1 : le plan Pro (code "premium") est en soft-launch.
  // priceCents=0 côté DB → on affiche "Sur mesure" pour lever l'ambiguïté
  // avec le plan free (qui affiche "Gratuit").
  const isComingSoon  = plan.code === "premium";
  const priceLabel    = isComingSoon
    ? "Sur mesure"
    : plan.priceCents === 0
      ? "Gratuit"
      : `${(plan.priceCents / 100).toFixed(plan.priceCents % 100 === 0 ? 0 : 2)}€`;

  const entMap = new Map<string, unknown>();
  for (const e of plan.entitlements) entMap.set(e.featureKey, e.value);

  return (
    <div
      className="card"
      style={{
        display:      "flex",
        flexDirection: "column",
        padding:      24,
        position:     "relative",
        borderColor:  isHighlighted ? "var(--gold)" : "var(--card-border)",
        borderWidth:  isHighlighted ? 2 : 1,
        borderStyle:  "solid",
        boxShadow:    isHighlighted ? "var(--shadow-gold)" : "var(--shadow-soft)",
      }}
    >
      {isHighlighted && (
        <div
          className="pill-gold"
          style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)" }}
        >
          POPULAIRE
        </div>
      )}
      {/* PATCH-PLANS-REBRAND-V1 : badge soft-launch pour plan Pro */}
      {isComingSoon && (
        <div
          style={{
            position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
            background: "var(--bg-raised, rgba(255,255,255,.05))",
            color: "var(--muted, #8a8598)",
            border: "1px solid var(--border-soft)",
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 10,
            letterSpacing: ".5px",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Bientôt disponible
        </div>
      )}

      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--gold)", marginBottom: 4 }}>
        {plan.name}
      </h2>
      <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", marginBottom: 16, minHeight: 34 }}>
        {plan.description}
      </p>

      <div style={{ marginBottom: 20, display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 38, color: "var(--star)" }}>
          {priceLabel}
        </span>
        {plan.priceCents > 0 && !isComingSoon && (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>/ mois</span>
        )}
      </div>

      <ul style={{ flex: 1, listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid var(--border-soft)", paddingTop: 14 }}>
        {FEATURE_DISPLAY.map((f) => (
          <FeatureRow key={f.key} label={f.label} value={entMap.get(f.key)} />
        ))}
      </ul>

      <div style={{ marginTop: 16 }}>
        {isCurrent ? (
          <div className="pill-gold" style={{ width: "100%", textAlign: "center", padding: "10px" }}>
            Ton plan actuel
          </div>
        ) : plan.code === "free" ? (
          <Link href={isLoggedIn ? "/dashboard" : "/auth/register"} className="btn-ghost" style={{ width: "100%" }}>
            {isLoggedIn ? "Revenir au gratuit" : "Commencer gratuitement"}
          </Link>
        ) : isComingSoon ? (
          // PATCH-PLANS-REBRAND-V1 : CTA spécifique plan Pro (soft-launch)
          <a
            href="mailto:pro@llmastro.com?subject=Intérêt%20plan%20Pro"
            className="btn-ob"
            style={{ width: "100%", textAlign: "center", textDecoration: "none" }}
          >
            Nous contacter
          </a>
        ) : (
          <button type="button" disabled className="btn-ob" style={{ opacity: 0.55, cursor: "not-allowed" }}>
            Bientôt disponible
          </button>
        )}
      </div>
    </div>
  );
}

function FeatureRow({ label, value }: { label: string; value: unknown }) {
  let text: string | null = null;
  let absent = false;

  if (value === undefined || value === null) absent = true;
  else if (typeof value === "boolean") absent = !value;
  else if (typeof value === "number") {
    if (value === -1) text = "illimité";
    else if (value === 0) absent = true;
    else text = String(value);
  } else if (typeof value === "object" && value && "max" in value) {
    const max = (value as { max: number }).max;
    if (max === -1) text = "illimité";
    else if (max === 0) absent = true;
    else text = String(max);
  }

  return (
    <li style={{
      display:       "flex",
      alignItems:    "center",
      justifyContent:"space-between",
      gap:           8,
      padding:       "6px 0",
      fontSize:      12.5,
      opacity:       absent ? 0.4 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            display:       "inline-flex",
            alignItems:    "center",
            justifyContent:"center",
            width:  16, height: 16,
            borderRadius:  "50%",
            fontSize:      10,
            background:    absent ? "transparent" : "rgba(62,207,142,.14)",
            color:         absent ? "var(--muted)" : "var(--harmony)",
            border:        absent ? "1px solid var(--border-soft)" : "none",
          }}
        >
          {absent ? "·" : "✓"}
        </span>
        <span style={{ color: absent ? "var(--muted)" : "var(--star)" }}>{label}</span>
      </div>
      {text && (
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize:   12,
          color:      absent ? "var(--muted)" : "var(--gold)",
          whiteSpace: "nowrap",
        }}>
          {text}
        </span>
      )}
    </li>
  );
}

/* PATCH-MENAGE-V1 passionne-mailto */

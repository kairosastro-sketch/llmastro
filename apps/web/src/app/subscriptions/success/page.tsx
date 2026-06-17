// STRIPE-MVP-V1
// Page d'atterrissage après un Checkout Stripe réussi.
// Stripe redirige ici avec ?session_id={CHECKOUT_SESSION_ID}. On ne valide
// pas la session côté front (le webhook /subscriptions/webhook a déjà fait
// foi côté backend) : on rafraîchit juste plan + entitlements via
// useAuth().refreshTiers() pour que l'UI reflète le nouvel état tout de suite.

"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header as LandingHeader } from "@/components/landing/Header";
import { useAuth } from "@/lib/auth/AuthContext";
import styles from "@/components/pricing/pricing.module.css";

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessFallback />}>
      <SuccessContent />
    </Suspense>
  );
}

function SuccessFallback() {
  return (
    <main className={styles.page}>
      <LandingHeader />
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Confirmation en cours…</h1>
        </div>
      </div>
    </main>
  );
}

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params?.get("session_id") ?? null;
  const { plan, refreshTiers, accessToken } = useAuth();

  // Polling léger : le webhook peut prendre 1-2 secondes pour propager
  // l'état. On retry refreshTiers jusqu'à voir plan.code = "essential",
  // 5 essais max espacés de 1.5 s.
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    let attempt = 0;
    const tick = async () => {
      if (cancelled) return;
      attempt += 1;
      await refreshTiers();
      // refreshTiers ne renvoie pas le plan ; on relit via re-render au tour suivant.
      // Le composant re-render via le useAuth changement de state.
      if (attempt >= 5) {
        setSynced(true);
        return;
      }
      setTimeout(tick, 1500);
    };
    void tick();
    return () => { cancelled = true; };
  }, [accessToken, refreshTiers]);

  const isEssentialish = plan?.code === "essential" || plan?.code === "premium";

  return (
    <main className={styles.page}>
      <LandingHeader />
      <div className={styles.container}>
        <header className={styles.hero}>
          <span className={styles.heroEyebrow}>Abonnement confirmé</span>
          <h1 className={styles.heroTitle}>
            Bienvenue sur <span className={styles.heroTitleAccent}>Essentiel</span> ✦
          </h1>
          <p className={styles.heroLead}>
            {isEssentialish
              ? "Tes nouveaux accès sont actifs. Ton thème, tes lectures et Kairos t'attendent."
              : synced
                ? "Paiement enregistré. L'activation est en cours — recharge la page d'ici quelques secondes si besoin."
                : "Activation en cours…"}
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/dashboard" className={`${styles.ctaBtn}`} style={{ width: "auto", padding: "12px 28px" }}>
              Aller au dashboard
            </Link>
            <Link href="/dashboard/account" className={`${styles.ctaBtn} ${styles.ctaBtnGhost}`} style={{ width: "auto", padding: "12px 28px" }}>
              Voir mon abonnement
            </Link>
          </div>
          {/* STRIPE-WELCOME-FEEDBACK-V1 : disclaimer première version + appel aux retours. */}
          <div
            style={{
              marginTop: 32,
              maxWidth: 520,
              marginLeft: "auto",
              marginRight: "auto",
              padding: "16px 20px",
              border: "1px solid var(--border)",
              borderRadius: 14,
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--muted)",
            }}
          >
            Llmastro en est à sa <strong>première version</strong> : quelques bugs peuvent
            encore se glisser. Tous tes retours sont les bienvenus et seront lus
            attentivement — ils façonnent directement la suite.{" "}
            <Link href="/contact" style={{ color: "var(--gold)", textDecoration: "underline" }}>
              Nous écrire
            </Link>
            .
          </div>

          {sessionId && (
            <p style={{ marginTop: 24, fontSize: 11, color: "var(--muted)" }}>
              Ref Stripe : <code>{sessionId.slice(0, 24)}…</code>
            </p>
          )}
        </header>
      </div>
    </main>
  );
}

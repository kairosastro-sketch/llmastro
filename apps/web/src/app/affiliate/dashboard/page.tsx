// GROWTH-V1-AFFILIATE-UI
// Dashboard affilié. Auth-gated. Récupère les stats détaillées via
// GET /affiliate/me/stats. Trois états :
//   - non connecté          → redirect vers /auth/login
//   - connecté, pas affilié → message + lien vers /affiliate
//   - connecté, affilié OK  → lien à partager + stats + tier
//
// Les commissions arrivent en GROWTH-V2-STRIPE — affichées à 0 € en
// attendant, avec une note explicite.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header as LandingHeader } from "@/components/landing/Header";
import { apiClient } from "@/lib/api/client";
import styles from "../affiliate.module.css";

interface AffiliateStats {
  affiliateId:    string;
  slug:           string;
  displayName:    string;
  status:         "pending" | "active" | "paused" | "banned";
  tier:           "standard" | "vip" | "top" | "partner";
  terms:          { pct: number; months: number; source: "tier" | "override" };
  monthToDate: {
    clicks:                 number;
    signups:                number;
    activeAttributions:     number;
    commissionAccruedCents: number;
  };
  lifetime: {
    clicks:               number;
    signups:              number;
    commissionPaidCents:  number;
  };
}

function siteOrigin(): string {
  if (typeof window === "undefined") return "https://llmastro.com";
  return window.location.origin;
}

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    style:                 "currency",
    currency:              "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function statusClass(status: AffiliateStats["status"]): string {
  if (status === "active")  return styles.dashStatusActive!;
  if (status === "pending") return styles.dashStatusPending!;
  return styles.dashStatusPaused!;
}

function statusLabel(status: AffiliateStats["status"]): string {
  switch (status) {
    case "active":  return "Actif";
    case "pending": return "En attente";
    case "paused":  return "En pause";
    case "banned":  return "Suspendu";
  }
}

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = sessionStorage.getItem("astro:access_token");
    if (!t) {
      router.replace("/auth/login?next=/affiliate/dashboard");
      return;
    }
    setToken(t);
  }, [router]);

  const statsQuery = useQuery({
    queryKey: ["affiliate", "stats", token],
    queryFn: async () => {
      const res = await apiClient.get<AffiliateStats>("/affiliate/me/stats", token!);
      return (res as { data: AffiliateStats }).data;
    },
    enabled: !!token,
    retry:   false,
  });

  if (!token) {
    return (
      <main className={styles.page}>
        <LandingHeader />
        <div className={styles.container}>
          <p className={styles.heroLead} style={{ textAlign: "center" }}>
            Redirection vers la connexion…
          </p>
        </div>
      </main>
    );
  }

  if (statsQuery.isLoading) {
    return (
      <main className={styles.page}>
        <LandingHeader />
        <div className={styles.container}>
          <p className={styles.heroLead} style={{ textAlign: "center" }}>
            Chargement de vos statistiques…
          </p>
        </div>
      </main>
    );
  }

  // 404 NOT_AFFILIATE → on bascule sur l'écran d'invitation à postuler.
  if (statsQuery.error) {
    return (
      <main className={styles.page}>
        <LandingHeader />
        <div className={styles.container}>
          <header className={styles.hero}>
            <span className={styles.heroEyebrow}>Espace Ambassadeurs</span>
            <h1 className={styles.heroTitle}>
              Vous n&apos;êtes pas <span className={styles.heroTitleAccent}>encore</span> ambassadeur
            </h1>
            <p className={styles.heroLead}>
              Le programme est sur invitation et candidature manuelle. Découvrez les
              conditions, puis postulez si l&apos;univers Llmastro résonne avec le vôtre.
            </p>
            <div className={styles.heroCtaRow}>
              <Link href="/affiliate" className={styles.ctaGhost}>Voir le programme</Link>
              <Link href="/affiliate/apply" className={styles.ctaPrimary}>Postuler</Link>
            </div>
          </header>
        </div>
      </main>
    );
  }

  const stats = statsQuery.data!;
  const shareUrl = `${siteOrigin()}/?aff=${stats.slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pas de Clipboard API → on sélectionne le texte
      // (silencieux, l'utilisateur peut copier manuellement).
    }
  };

  return (
    <main className={styles.page}>
      <LandingHeader />
      <div className={styles.container}>

        <div className={styles.dashGreeting}>
          <span className={styles.heroEyebrow}>Espace Ambassadeurs</span>
          <h1 className={styles.heroTitle}>
            Bienvenue, <span className={styles.heroTitleAccent}>{stats.displayName}</span>
          </h1>
          <span className={`${styles.dashStatusChip} ${statusClass(stats.status)}`}>
            {statusLabel(stats.status)}
          </span>
        </div>

        {/* Lien à partager */}
        <div className={styles.dashShareBar}>
          <div className={styles.dashShareUrl}>{shareUrl}</div>
          <button type="button" className={styles.ctaPrimary} onClick={handleCopy}>
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>

        {/* Conditions effectives */}
        <div className={styles.dashTermsCard} style={{ marginBottom: 32 }}>
          <div>
            <div className={styles.dashTermsLabel}>Vos conditions</div>
            <div className={styles.dashTermsValue}>
              {stats.terms.pct}% pendant {stats.terms.months} mois
            </div>
          </div>
          <div>
            <div className={styles.dashTermsLabel}>Niveau</div>
            <div className={styles.dashTermsValue} style={{ textTransform: "capitalize" }}>
              {stats.tier}
            </div>
          </div>
        </div>

        {/* Stats ce mois-ci */}
        <h2 className={styles.sectionTitle} style={{ marginBottom: 18 }}>
          Ce mois-ci
        </h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.monthToDate.clicks}</div>
            <div className={styles.statLabel}>Clics</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.monthToDate.signups}</div>
            <div className={styles.statLabel}>Inscriptions</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.monthToDate.activeAttributions}</div>
            <div className={styles.statLabel}>Attributions actives</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>
              {formatEuros(stats.monthToDate.commissionAccruedCents)}
            </div>
            <div className={styles.statLabel}>Commission accumulée</div>
          </div>
        </div>

        {/* Stats lifetime */}
        <h2 className={styles.sectionTitle} style={{ marginTop: 48, marginBottom: 18 }}>
          Depuis le début
        </h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.lifetime.clicks}</div>
            <div className={styles.statLabel}>Clics totaux</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.lifetime.signups}</div>
            <div className={styles.statLabel}>Inscriptions totales</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>
              {formatEuros(stats.lifetime.commissionPaidCents)}
            </div>
            <div className={styles.statLabel}>Commission payée</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>—</div>
            <div className={styles.statLabel}>Bientôt</div>
          </div>
        </div>

        <p
          className={styles.sectionLead}
          style={{ marginTop: 32, fontSize: 12, fontStyle: "italic" }}
        >
          Les montants de commission s&apos;activeront avec le branchement
          Stripe (prochaine phase). En attendant, on enregistre déjà les clics
          et les inscriptions attribuées à votre lien.
        </p>

      </div>
    </main>
  );
}

// ============================================================
// ASTROCARTOGRAPHY-V1 — Section carte personnelle (page horoscope)
// ------------------------------------------------------------
// Réservée aux plans payants (entitlement astro.cartography).
//  - autorisé  → carte natale (<Astrocartography source=personal>) + la
//    « lecture de vos lieux » (interprétation LLM des lignes/parans).
//  - non autorisé → teaser premium + CTA upgrade (aucun fetch premium).
// ============================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useEntitlement } from "@/hooks/useEntitlement";
import { Astrocartography } from "@/components/landing/Astrocartography";
import { UpgradeCTA } from "@/components/tiers/UpgradeCTA";
import { AstroText } from "@/components/ui/AstroText";
import styles from "@/components/landing/astrocartography.module.css";

interface Props {
  natalId: string | null;
  token?: string;
}

export function PersonalAstrocartographySection({ natalId, token }: Props) {
  const { allowed, known } = useEntitlement("astro.cartography");

  if (!natalId) return null;     // pas de profil natal
  if (!known) return null;       // entitlements pas encore chargés

  if (allowed) {
    return (
      <>
        <Astrocartography source={{ kind: "personal", natalId, token }} />
        <PersonalReading natalId={natalId} token={token} />
      </>
    );
  }

  // Teaser premium (pas de fetch).
  return (
    <section className={styles.module} aria-label="Votre carte personnelle (premium)">
      <header className={styles.header}>
        <span className={styles.eyebrow}>✦ Votre carte personnelle</span>
        <h2 className={styles.title}>Vos lignes de naissance, sur la carte du monde</h2>
        <p className={styles.accroche}>
          L’astrocartographie révèle où, sur Terre, votre ciel de naissance s’exprime le plus fort —
          vos lieux de <b>Vénus</b>, de <b>Jupiter</b>, de <b>Soleil</b>… Là où vous aimez, où vous
          réussissez, où vous vous sentez chez vous. Une carte unique : la vôtre, pour toujours.
        </p>
      </header>
      <div className={styles.cta}>
        <UpgradeCTA feature="astro.cartography" label="Débloquer ma carte personnelle" />
      </div>
    </section>
  );
}

// Lecture LLM « vos lieux » — fetch séparé (appel xAI, caché par profil).
function PersonalReading({ natalId, token }: { natalId: string; token?: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["acg-reading", natalId],
    queryFn: () => apiClient.get<{ text: string }>(
      `/natal/${natalId}/astrocartography/reading`, token,
    ),
    enabled: Boolean(natalId),
    staleTime: Infinity,   // lecture fixe (carte natale figée) → cachée serveur
    retry: 1,
  });
  const text = (data as { data?: { text?: string } } | undefined)?.data?.text;

  if (isError) return null;
  if (isLoading) {
    return (
      <div className={styles.reading}>
        <div className={styles.readingTitle}>✦ Lecture de vos lieux</div>
        <div className={styles.readingLoading}>
          <span className="spinner" aria-hidden /> Kairos lit vos lieux…
        </div>
      </div>
    );
  }
  if (!text) return null;

  return (
    <div className={styles.reading}>
      <div className={styles.readingTitle}>✦ Lecture de vos lieux</div>
      <div className={styles.readingBody}><AstroText>{text}</AstroText></div>
    </div>
  );
}

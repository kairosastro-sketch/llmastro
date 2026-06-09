// ============================================================
// ASTROCARTOGRAPHY-V1 — Section carte personnelle (page horoscope)
// ------------------------------------------------------------
// Réservée aux plans payants (entitlement astro.cartography).
//  - autorisé  → la vraie carte natale de l'utilisateur (<Astrocartography
//    source=personal>), qui interroge GET /natal/:id/astrocartography.
//  - non autorisé → teaser premium + CTA upgrade (ouvre le paywall). On NE
//    fetch PAS l'endpoint dans ce cas (pas de fuite des données premium).
// ============================================================

"use client";

import { useEntitlement } from "@/hooks/useEntitlement";
import { Astrocartography } from "@/components/landing/Astrocartography";
import { UpgradeCTA } from "@/components/tiers/UpgradeCTA";
import styles from "@/components/landing/astrocartography.module.css";

interface Props {
  natalId: string | null;
  token?: string;
}

export function PersonalAstrocartographySection({ natalId, token }: Props) {
  const { allowed, known } = useEntitlement("astro.cartography");

  // Pas de profil natal → rien à cartographier.
  if (!natalId) return null;
  // Entitlements pas encore chargés → on n'affiche rien (évite le flash teaser).
  if (!known) return null;

  if (allowed) {
    return <Astrocartography source={{ kind: "personal", natalId, token }} />;
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

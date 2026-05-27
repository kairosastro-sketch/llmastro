// GROWTH-V1-AFFILIATE-UI
// Page marketing publique /affiliate. Pitch + 3 étapes + grille des
// commissions par tier + FAQ + CTA vers /affiliate/apply.
//
// Spec : GROWTH_PLAN.md (section "Mécanique affiliation"). Tiers
// alignés sur apps/api/src/config/affiliate-tiers.config.ts (les
// valeurs sont dupliquées volontairement ici — le marketing affiche
// les conditions standard, pas la grille interne qui peut bouger).

import type { Metadata } from "next";
import Link from "next/link";
import { Header as LandingHeader } from "@/components/landing/Header";
import styles from "./affiliate.module.css";

export const metadata: Metadata = {
  title: "Programme Ambassadeurs — Llmastro",
  description:
    "Partagez Llmastro et gagnez 20% du MRR pendant 12 mois sur chaque âme qui rejoint le voyage.",
};

interface Tier {
  name:    string;
  pct:     number;
  months:  number;
  note:    string;
}

const PUBLIC_TIERS: Tier[] = [
  { name: "Standard",  pct: 20, months: 12, note: "Notre offre de base, pour démarrer ensemble." },
  { name: "VIP",       pct: 25, months: 12, note: "Pour une audience engagée et ciblée." },
  { name: "Top",       pct: 30, months: 18, note: "Pour les voix qui inspirent vraiment." },
  { name: "Partner",   pct: 35, months: 24, note: "Réservé aux partenariats exceptionnels." },
];

export default function AffiliatePage() {
  return (
    <main className={styles.page}>
      <LandingHeader />

      <div className={styles.container}>

        {/* ──────────── HERO ──────────── */}
        <header className={styles.hero}>
          <span className={styles.heroEyebrow}>Programme Ambassadeurs</span>
          <h1 className={styles.heroTitle}>
            Partagez le ciel,<br />
            <span className={styles.heroTitleAccent}>récoltez les étoiles</span>
          </h1>
          <p className={styles.heroLead}>
            Vous parlez d&apos;astrologie, de spiritualité, d&apos;introspection ?
            Faites découvrir Llmastro à votre audience et touchez une commission
            récurrente sur chaque âme qui rejoint l&apos;aventure.
          </p>
          <div className={styles.heroOrnament}>
            <span className={styles.heroOrnamentLine} />
            <span>✦</span>
            <span className={styles.heroOrnamentLine} />
          </div>
          <div className={styles.heroCtaRow}>
            <Link href="/affiliate/apply" className={styles.ctaPrimary}>
              Postuler
            </Link>
            <a href="#tiers" className={styles.ctaGhost}>
              Voir les conditions
            </a>
          </div>
        </header>

        {/* ──────────── COMMENT ÇA MARCHE ──────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Comment ça marche</h2>
          <p className={styles.sectionLead}>
            Trois étapes simples, une relation qui dure.
          </p>

          <div className={styles.stepsGrid}>
            <div className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <h3 className={styles.stepTitle}>Postulez</h3>
              <p className={styles.stepBody}>
                Quelques mots sur vous, votre audience, votre univers.
                On répond sous 5 jours ouvrés.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <h3 className={styles.stepTitle}>Recevez votre lien</h3>
              <p className={styles.stepBody}>
                Un lien unique à votre nom. Partagez-le sur vos posts,
                stories, lives, descriptions de vidéos.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <h3 className={styles.stepTitle}>Gagnez chaque mois</h3>
              <p className={styles.stepBody}>
                Pour chaque personne qui souscrit via votre lien,
                vous touchez un pourcentage récurrent, pendant 12 mois minimum.
              </p>
            </div>
          </div>
        </section>

        {/* ──────────── GRILLE TIERS ──────────── */}
        <section className={styles.section} id="tiers">
          <h2 className={styles.sectionTitle}>Les conditions, en transparence</h2>
          <p className={styles.sectionLead}>
            Tout le monde commence en Standard. Selon l&apos;ampleur et l&apos;engagement
            de votre audience, on ajuste ensemble.
          </p>

          <div className={styles.tiersGrid}>
            {PUBLIC_TIERS.map((t) => (
              <div key={t.name} className={styles.tierCard}>
                <div className={styles.tierName}>{t.name}</div>
                <div className={styles.tierPct}>
                  {t.pct}
                  <span className={styles.tierPctUnit}>%</span>
                </div>
                <div className={styles.tierMonths}>pendant {t.months} mois</div>
                <p className={styles.tierNote}>{t.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ──────────── FAQ ──────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Questions fréquentes</h2>

          <div className={styles.faqList}>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Sur quoi est calculée la commission ?</h3>
              <p className={styles.faqAnswer}>
                Sur le montant HT effectivement encaissé chaque mois, après remboursement
                éventuel. Si la personne se désabonne ou est remboursée, la commission de
                ce mois-là est annulée — mais vous gardez les mois précédents.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Combien de temps dure l&apos;attribution ?</h3>
              <p className={styles.faqAnswer}>
                Une personne qui clique sur votre lien est attribuée pendant 60 jours.
                Si elle souscrit dans cette fenêtre, vous touchez la commission sur
                tous ses abonnements pendant la durée indiquée à votre niveau.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Quand suis-je payé(e) ?</h3>
              <p className={styles.faqAnswer}>
                Une fois par mois, sur facture. Seuil minimum de 50&nbsp;€ — en dessous,
                le solde se reporte au mois suivant. Il faut être en règle avec un statut
                permettant l&apos;émission de factures (micro-entreprise minimum en France).
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Quels contenus puis-je publier ?</h3>
              <p className={styles.faqAnswer}>
                Tout ce qui reste fidèle à l&apos;esprit de Llmastro — pas de promesses
                divinatoires, pas de garanties miracle, pas de spam. La mention
                <em> #partenariatrémunéré </em> ou <em>#publicité</em> est obligatoire
                sur chaque post sponsorisé (loi du 9 juin 2023 en France).
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Et si je n&apos;ai pas une grosse audience ?</h3>
              <p className={styles.faqAnswer}>
                Pas grave. On regarde l&apos;engagement et l&apos;adéquation avec notre univers,
                pas juste le nombre. Postulez quand même, on vous répondra honnêtement.
              </p>
            </div>
          </div>
        </section>

        {/* ──────────── CTA FINAL ──────────── */}
        <section className={styles.section} style={{ textAlign: "center", marginBottom: 0 }}>
          <h2 className={styles.sectionTitle}>Prêt(e) à rejoindre ?</h2>
          <p className={styles.sectionLead}>
            Une candidature courte, une réponse rapide.
          </p>
          <Link href="/affiliate/apply" className={styles.ctaPrimary}>
            Postuler maintenant
          </Link>
          <p style={{ marginTop: 18, fontSize: 12, color: "var(--muted-2)" }}>
            En postulant, vous reconnaissez avoir pris connaissance des{" "}
            <Link
              href="/cgu-affilies"
              style={{
                color: "var(--gold)",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Conditions Générales du programme Ambassadeurs
            </Link>
            .
          </p>
        </section>

      </div>
    </main>
  );
}

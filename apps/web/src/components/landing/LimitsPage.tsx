// ============================================================
// ARCHIVE-LIMITS-PAGE-V1 — LimitsPage (page /limites)
// Catalogue honnête des limitations de Llmastro.
// Structure calquée sur MethodPage.tsx pour cohérence visuelle.
// ============================================================

"use client";

import { Header } from "./Header";
import { RevealOnScroll } from "./RevealOnScroll";
import { StarsBackground } from "@/components/ui/StarsBackground";
import styles from "./landing.module.css";

type Limitation = {
  index: string;
  title: string;
  text: string;
  precision?: string;
};

const limitations: Limitation[] = [
  {
    index: "01",
    title: "Pas d'astrologie médicale",
    text:
      "Llmastro ne diagnostique aucune pathologie et ne suggère aucun traitement, qu'il soit physique ou psychique. Pour toute question de santé, consultez un professionnel qualifié.",
    precision:
      "Aucun aspect, transit ou configuration ne peut prédire ou expliquer un trouble médical. Toute lecture qui le suggérerait est à ignorer.",
  },
  {
    index: "02",
    title: "Les transits ne prédisent pas d'événements précis",
    text:
      "Un transit indique une coloration énergétique, pas un fait à venir. Aucune étude statistique sérieuse n'a démontré la capacité prédictive de l'astrologie sur des événements concrets — rencontres, promotions, accidents, dates de mariage.",
    precision:
      "Llmastro parle de tendances et d'archétypes, jamais de certitudes datées. Les formulations affirmatives type « vous rencontrerez X le Y » sont absentes par conception.",
  },
  {
    index: "03",
    title: "L'IA peut halluciner sur les aspects rares",
    text:
      "Kairos s'appuie sur la littérature astrologique consolidée. Sur des configurations rares — Chiron carré Lilith, points sensibles exotiques, harmoniques au-delà du 8e — la qualité des interprétations baisse mécaniquement.",
    precision:
      "Si une interprétation vous semble bancale, consultez la fiche technique du thème : les calculs eux-mêmes restent exacts, c'est l'interprétation qui s'éloigne.",
  },
  {
    index: "04",
    title: "L'astrologie n'est pas validée scientifiquement",
    text:
      "Aucune méta-analyse n'a confirmé la validité prédictive de l'astrologie. Llmastro l'utilise comme un langage symbolique structurant, pas comme une science prédictive. La rigueur ici est méthodologique — calculs reproductibles, sources tracées — pas épistémologique.",
    precision:
      "Lire l'astrologie comme on lirait un poème : exigeant sur la forme, libre sur l'usage, sceptique sur la portée.",
  },
  {
    index: "05",
    title: "La précision dépend de l'heure de naissance",
    text:
      "L'ascendant et le découpage des maisons varient de plusieurs degrés en quelques minutes. Une heure approximative — « vers 14h » — rend l'analyse de l'ascendant et des maisons peu fiable, même si les positions planétaires restent valides.",
    precision:
      "À défaut d'heure exacte, Llmastro signale les éléments dégradés et privilégie les analyses solaires et planétaires plutôt que les configurations dépendant de l'heure.",
  },
  {
    index: "06",
    title: "Le système de maisons dégénère aux pôles",
    text:
      "Au-delà de 66° de latitude environ — cercle polaire — Placidus et la plupart des systèmes de maisons produisent des résultats incohérents ou indéfinis. Certaines maisons disparaissent, d'autres deviennent gigantesques.",
    precision:
      "Concerne principalement les naissances en Scandinavie nord, Alaska, certaines régions du Canada et de la Russie. Llmastro avertit dans ces cas et propose un système de maisons plus robuste (Whole Sign).",
  },
  {
    index: "07",
    title: "La compatibilité couvre la synastrie, pas le composite",
    text:
      "L'analyse de compatibilité repose exclusivement sur la synastrie — c'est-à-dire le croisement des positions natales et des aspects entre les planètes de deux thèmes. Les approches dites composite (carte des points médians de deux thèmes) et Davison (thème de la date médiane) ne sont pas implémentées.",
    precision:
      "La synastrie éclaire la dynamique interpersonnelle (ce que A déclenche chez B et inversement), mais ne dit rien de l'identité propre du couple comme entité tierce. Pour cette lecture-là, une consultation humaine ou un autre outil reste pertinent.",
  },
  {
    index: "08",
    title: "Si l'IA est indisponible, le contenu manque",
    text:
      "Les lectures Kairos dépendent d'un appel à xAI Grok. En cas d'erreur du provider — surcharge, panne, dépassement de quota côté serveur — le système réessaie trois fois puis abandonne pour cette publication. Le champ texte reste vide jusqu'à la prochaine régénération planifiée.",
    precision:
      "Les calculs astrologiques eux-mêmes (positions, aspects, transits) restent disponibles : seul l'habillage narratif est manquant. La fiche technique du thème reste consultable indépendamment.",
  },
];

export function LimitsPage() {
  return (
    <>
      <StarsBackground count={100} />
      <div className={styles.page}>
        <Header />
        <main>
          {/* Hero */}
          <section
            className={`${styles.section} ${styles.methodHero}`}
            style={{ marginTop: 0 }}
          >
            <p className={styles.sectionEyebrow}>Honnêteté</p>
            <h1
              className={styles.sectionTitle}
              style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", marginTop: 14 }}
            >
              Ce que Llmastro ne fait pas
            </h1>
            <p className={styles.methodHeroChapeau}>
              Aucune plateforme d&apos;astrologie ne devrait promettre ce
              qu&apos;elle ne peut pas tenir. Voici les limites de Llmastro,
              en clair&nbsp;: techniques, méthodologiques et épistémologiques.
              La confiance se construit autant sur ce qu&apos;on sait
              <em> ne pas </em>
              faire que sur ce qu&apos;on fait bien.
            </p>
          </section>

          {/* 6 limitations en liste verticale */}
          <section className={`${styles.section} ${styles.methodPiliers}`}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 56,
              }}
            >
              {limitations.map((l, i) => (
                <RevealOnScroll key={l.index} delay={i * 80}>
                  <article style={{ maxWidth: "62ch" }}>
                    <p className={styles.methodPilierEyebrow}>{l.index}</p>
                    <h2 className={styles.methodPilierTitle}>{l.title}</h2>
                    <p className={styles.methodPilierText}>{l.text}</p>
                    {l.precision ? (
                      <p className={styles.methodPilierTech}>{l.precision}</p>
                    ) : null}
                  </article>
                </RevealOnScroll>
              ))}
            </div>
          </section>

          {/* Postface — pourquoi cette page */}
          <section
            className={`${styles.section} ${styles.methodTransparence}`}
          >
            <RevealOnScroll>
              <h2 className={styles.methodTransparenceTitle}>
                Pourquoi cette page&nbsp;?
              </h2>

              <div className={styles.methodTransparenceProse}>
                <p>
                  Le marché de l&apos;astrologie en ligne est saturé de
                  promesses floues&nbsp;: prédictions affirmatives,
                  compatibilités déterministes, conseils médicaux déguisés.
                  Cette opacité ne sert ni les utilisateurs, ni la discipline
                  elle-même.
                </p>
                <p>
                  Llmastro fait le pari inverse&nbsp;: afficher ses limites
                  comme on afficherait une fiche technique. Vous savez
                  exactement ce que vous lisez, comment c&apos;est calculé, et
                  où les analyses cessent d&apos;être fiables.
                </p>
                <p>
                  Si une limite vous paraît mal posée, ou une catégorie
                  manquante, écrivez-nous. Cette page est vivante.
                </p>
              </div>
            </RevealOnScroll>
          </section>
        </main>
      </div>
    </>
  );
}

// ARCHIVE-LIMITS-PAGE-V1 applied

// ============================================================
// GEO-CONTENT-V1 — AstrologieIaPage (page /astrologie-ia)
// Page GEO : définition canonique (G5) + comparatif (G3) + FAQ (G4).
// Structure calquée sur LimitsPage/MethodPage pour cohérence « Céleste ».
// Tout le texte vit dans des variables/données → rendu serveur extractible
// par les moteurs génératifs, et apostrophes sans échappement JSX.
// ============================================================

"use client";

import { Header } from "./Header";
import { Footer } from "./Footer";
import { RevealOnScroll } from "./RevealOnScroll";
import { StarsBackground } from "@/components/ui/StarsBackground";
import styles from "./landing.module.css";
import geo from "./astrologie-ia.module.css";
import { GEO_FAQ } from "./geo-faq-data";

const DEFINITION =
  "Llmastro est une plateforme d'astrologie en français qui calcule ton thème natal, tes transits et le ciel du jour avec une précision astronomique — les éphémérides Swiss Ephemeris et les tables JPL de la NASA — puis les fait interpréter par une intelligence artificielle. Les positions sont calculées, jamais devinées : le modèle interprète, il ne calcule pas.";

const COMPARE_INTRO =
  "La plupart des horoscopes te rangent dans une case sur douze et te servent le même texte qu'à des millions d'autres. Llmastro fait l'inverse : il part de ton ciel de naissance et calcule tout avec une précision d'observatoire. Voici ce qui change concrètement.";

const COMPARE_OUTRO =
  "Résultat : une lecture qui te ressemble vraiment, sérieuse sans être froide, chaleureuse sans être complaisante. Tu peux vérifier nos calculs, lire nos sources et connaître nos limites — avant même de créer un compte.";

type Row = { dim: string; generic: string; llmastro: string };

const COMPARE: Row[] = [
  { dim: "Point de départ", generic: "Ton signe solaire (1/12 de l'humanité)", llmastro: "Ton thème natal complet : date, heure, lieu" },
  { dim: "Calcul des positions", generic: "Approximatif, éditorial", llmastro: "Swiss Ephemeris + tables JPL de la NASA, côté serveur" },
  { dim: "Rôle de l'IA", generic: "Génère un texte vague", llmastro: "Interprète des positions réelles fournies comme faits" },
  { dim: "Sources", generic: "Aucune", llmastro: "Bibliographie publique et assumée" },
  { dim: "Honnêteté", generic: "Promesses floues", llmastro: "Limites posées noir sur blanc" },
  { dim: "Tes données", generic: "Souvent revendues", llmastro: "Jamais vendues ni partagées (RGPD)" },
];

export function AstrologieIaPage() {
  return (
    <>
      <StarsBackground count={100} />
      <div className={styles.page}>
        <Header />
        <main>
          {/* G5 — Définition canonique (hero) */}
          <section
            className={`${styles.section} ${styles.methodHero}`}
            style={{ marginTop: 0 }}
          >
            <p className={styles.sectionEyebrow}>Astrologie &amp; IA</p>
            <h1
              className={styles.sectionTitle}
              style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", marginTop: 14 }}
            >
              Astrologie sérieuse, pas horoscope générique
            </h1>
            <p className={styles.methodHeroChapeau}>{DEFINITION}</p>
          </section>

          {/* G3 — Comparatif */}
          <section className={styles.section}>
            <p className={geo.lead}>{COMPARE_INTRO}</p>
            <RevealOnScroll>
              <div className={geo.tableWrap}>
                <table className={geo.compare}>
                  <thead>
                    <tr>
                      <th scope="col" aria-hidden="true" />
                      <th scope="col">Horoscope générique</th>
                      <th scope="col">Llmastro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE.map((r) => (
                      <tr key={r.dim}>
                        <th scope="row">{r.dim}</th>
                        <td>{r.generic}</td>
                        <td className={geo.win}>{r.llmastro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </RevealOnScroll>
            <p className={geo.kicker}>{COMPARE_OUTRO}</p>
          </section>

          {/* G4 — FAQ générale */}
          <section className={styles.section}>
            <h2 className={geo.faqTitle}>Questions fréquentes</h2>
            <div className={geo.faqList}>
              {GEO_FAQ.map((f) => (
                <details key={f.q} className={geo.faqItem}>
                  <summary className={geo.faqQ}>
                    <span>{f.q}</span>
                  </summary>
                  <div className={geo.faqA}>{f.a}</div>
                </details>
              ))}
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}

// GEO-CONTENT-V1 applied

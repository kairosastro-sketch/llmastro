// ============================================================
// ARCHIVE-BIBLIOGRAPHY-V1 — BibliographyPage
// ------------------------------------------------------------
// Page publique listant les sources astrologiques utilisées
// par Llmastro, regroupées par école.
// Calquée sur la structure de /methode et /limites.
// ============================================================

"use client";

import { Header } from "./Header";
import { RevealOnScroll } from "./RevealOnScroll";
import { StarsBackground } from "@/components/ui/StarsBackground";
import styles from "./landing.module.css";
import {
  REFERENCES,
  SCHOOL_LABELS_FR,
  SCHOOL_DESCRIPTIONS_FR,
  type SchoolKey,
  type Reference,
} from "@/lib/astro-sources";

const SCHOOLS_ORDER: SchoolKey[] = [
  "psychological",
  "archetypal",
  "humanist",
  "traditional",
];

const SCHOOL_EYEBROWS: Record<SchoolKey, string> = {
  psychological: "I. École psychologique",
  archetypal: "II. Approche archétypale",
  humanist: "III. Astrologie humaniste",
  traditional: "IV. Tradition technique",
};

export function BibliographyPage() {
  // Grouper les références par école
  const grouped: Record<SchoolKey, Reference[]> = {
    psychological: [],
    archetypal: [],
    traditional: [],
    humanist: [],
  };
  for (const ref of REFERENCES) {
    grouped[ref.school].push(ref);
  }

  // Trier chaque groupe par année (chronologique)
  for (const school of SCHOOLS_ORDER) {
    grouped[school].sort((a, b) => a.year - b.year);
  }

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
            <p className={styles.sectionEyebrow}>Sources</p>
            <h1
              className={styles.sectionTitle}
              style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", marginTop: 14 }}
            >
              Bibliographie
            </h1>
            <p className={styles.methodHeroChapeau}>
              Llmastro s&apos;appuie sur le corpus consolidé de l&apos;astrologie
              occidentale du XX<sup>e</sup> et XXI<sup>e</sup> siècle. Cette
              page liste les références qui informent les interprétations
              générées, regroupées par école&nbsp;: psychologique,
              archétypale, humaniste, traditionnelle.
            </p>
            <p className={styles.methodHeroChapeau} style={{ marginTop: 14, fontStyle: "italic" }}>
              Les ouvrages cités ne sont pas reproduits ni paraphrasés en
              copie&nbsp;: ils servent de balises intellectuelles et
              d&apos;ancrages méthodologiques.
            </p>
          </section>

          {/* 4 sections — une par école */}
          {SCHOOLS_ORDER.map((schoolKey, sectionIdx) => {
            const refs = grouped[schoolKey];
            if (refs.length === 0) return null;

            return (
              <section
                key={schoolKey}
                className={`${styles.section} ${styles.methodTransparence}`}
                aria-labelledby={`school-${schoolKey}`}
              >
                <RevealOnScroll>
                  <p className={styles.sectionEyebrow}>{SCHOOL_EYEBROWS[schoolKey]}</p>
                  <h2
                    id={`school-${schoolKey}`}
                    className={styles.methodTransparenceTitle}
                  >
                    {SCHOOL_LABELS_FR[schoolKey]}
                  </h2>

                  <div className={styles.methodTransparenceProse}>
                    <p style={{ marginBottom: 24 }}>
                      {SCHOOL_DESCRIPTIONS_FR[schoolKey]}
                    </p>

                    <ul style={listStyle}>
                      {refs.map((ref) => (
                        <li key={ref.id} style={refItemStyle}>
                          <div style={refHeaderStyle}>
                            <strong style={{ color: "var(--star)" }}>
                              {ref.author}
                            </strong>
                            <span style={refYearStyle}>·&nbsp;{ref.year}</span>
                          </div>
                          <div style={refTitleStyle}>
                            <em>{ref.title}</em>
                            {ref.context ? (
                              <span style={refContextStyle}> — {ref.context}</span>
                            ) : null}
                          </div>
                          <p style={refContribStyle}>{ref.contribution}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </RevealOnScroll>
              </section>
            );
          })}

          {/* Postface */}
          <section
            className={`${styles.section} ${styles.methodTransparence}`}
          >
            <RevealOnScroll>
              <p className={styles.sectionEyebrow}>V. Posture</p>
              <h2 className={styles.methodTransparenceTitle}>
                Pourquoi cette bibliographie&nbsp;?
              </h2>

              <div className={styles.methodTransparenceProse}>
                <p>
                  L&apos;astrologie en ligne souffre d&apos;un déficit
                  d&apos;ancrage&nbsp;: la plupart des plateformes synthétisent
                  des interprétations sans jamais nommer les traditions dont
                  elles dérivent. C&apos;est confortable côté UX, mais
                  c&apos;est aussi opaque.
                </p>
                <p>
                  Cette page existe pour rendre visible la généalogie
                  intellectuelle. Quand Llmastro évoque la composante saturnienne
                  d&apos;un thème, c&apos;est une lecture que Liz Greene a
                  largement façonnée à partir de 1976. Quand il parle des cycles
                  Pluton-Uranus, c&apos;est dans le sillage de Tarnas.
                </p>
                <p>
                  Sous chaque lecture générée, une mention discrète indique les
                  références principalement consultées par catégorie de
                  configuration astrologique. L&apos;objectif n&apos;est pas
                  l&apos;érudition pour l&apos;érudition, mais la traçabilité.
                </p>
                <p style={{ marginTop: 18, fontStyle: "italic", color: "var(--muted)" }}>
                  Si une référence vous paraît mal placée ou en manque, écrivez-nous —
                  cette page est vivante.
                </p>
              </div>
            </RevealOnScroll>
          </section>
        </main>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Styles inline (cohérents avec MethodDetails / LimitsPage)
// ──────────────────────────────────────────────────────────

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
};

const refItemStyle: React.CSSProperties = {
  marginBottom: 28,
  paddingLeft: 20,
  borderLeft: "2px solid var(--gold)",
};

const refHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  marginBottom: 4,
  fontSize: "1.05rem",
  fontFamily: "var(--font-display)",
};

const refYearStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.85rem",
};

const refTitleStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  color: "var(--gold)",
  marginBottom: 6,
};

const refContextStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontStyle: "normal",
  fontSize: "0.85rem",
};

const refContribStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  lineHeight: 1.6,
  color: "var(--star)",
  opacity: 0.82,
  margin: 0,
};

// ARCHIVE-BIBLIOGRAPHY-V1 applied

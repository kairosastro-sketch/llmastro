// ============================================================
// ARCHIVE-METHOD-DEEP-DOC-V1 — MethodDetails component
// Documentation technique enrichie pour la page /methode.
// 7 sections : origine des calculs, choix astrologiques, orbes,
// points sensibles, pipeline Kairos, versions, pour aller plus loin.
// Texte hardcodé en FR (sweep i18n EN dans le backlog).
// ============================================================

"use client";

import { RevealOnScroll } from "./RevealOnScroll";
import Link from "next/link";
import styles from "./landing.module.css";

// ──────────────────────────────────────────────────────────
// Données structurées : table des orbes par défaut
// ──────────────────────────────────────────────────────────

interface AspectRow {
  symbol: string;
  name: string;
  angle: string;
  orb: string;
  tone: "h" | "t" | "n";
}

const ASPECT_ORBS: AspectRow[] = [
  { symbol: "☌", name: "Conjonction",  angle: "0°",   orb: "8°",  tone: "n" },
  { symbol: "☍", name: "Opposition",   angle: "180°", orb: "8°",  tone: "t" },
  { symbol: "△", name: "Trigone",      angle: "120°", orb: "7°",  tone: "h" },
  { symbol: "□", name: "Carré",        angle: "90°",  orb: "7°",  tone: "t" },
  { symbol: "⚹", name: "Sextile",      angle: "60°",  orb: "5°",  tone: "h" },
  { symbol: "⚻", name: "Quinconce",    angle: "150°", orb: "3°",  tone: "n" },
];

// ──────────────────────────────────────────────────────────
// Composant
// ──────────────────────────────────────────────────────────

export function MethodDetails() {
  return (
    <>
      {/* ========== Section 1 : Origine des calculs ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-origine"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>I. Calculs</p>
          <h2
            id="method-section-origine"
            className={styles.methodTransparenceTitle}
          >
            D&apos;où viennent nos calculs
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              Llmastro s&apos;appuie sur <strong>Swiss Ephemeris</strong> en
              mode Moshier comme moteur principal de calcul. Cette
              bibliothèque, référence dans le milieu astrologique
              professionnel, dérive ses positions planétaires des tables{" "}
              <strong>JPL DE431</strong> publiées par le Jet Propulsion
              Laboratory de la NASA — les mêmes utilisées pour la
              navigation des sondes interplanétaires. La précision
              annoncée est <em>sub-seconde d&apos;arc</em> sur la période
              utile (de l&apos;Antiquité au futur lointain).
            </p>
            <p>
              En cas d&apos;indisponibilité du binaire natif Swiss Ephemeris
              (build sans node-gyp, environnement contraint), Llmastro
              bascule automatiquement sur un <strong>moteur de secours
              maison</strong> implémentant les algorithmes VSOP87 et Meeus.
              La précision reste sub-seconde sur les corps majeurs, avec
              une dégradation marginale sur les corps lents en dehors de
              la fenêtre 1900–2100. Le fallback est tracé côté serveur et
              consultable via diagnostic d&apos;administration.
            </p>
            <p>
              La conversion entre heure locale de naissance et instant
              UTC absolu passe par <strong>Luxon</strong> couplé à la base
              IANA tzdata. Cela garantit une gestion correcte des
              changements d&apos;heure d&apos;été/hiver, des décalages historiques
              (ex&nbsp;: la Russie a changé plusieurs fois ses fuseaux au
              XX<sup>e</sup> siècle), ainsi que des heures ambiguës ou
              inexistantes lors des transitions DST. Le terme correctif{" "}
              <strong>Delta T</strong> — différence entre temps universel et
              temps terrestre — est appliqué automatiquement par le
              moteur Swiss Ephemeris (de l&apos;ordre de 70 secondes en 2026).
            </p>
          </div>
        </RevealOnScroll>
      </section>

      {/* ========== Section 2 : Choix astrologiques ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-choix"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>II. Conventions</p>
          <h2
            id="method-section-choix"
            className={styles.methodTransparenceTitle}
          >
            Choix astrologiques par défaut
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              Les conventions ci-dessous sont celles de l&apos;astrologie
              occidentale moderne. Elles peuvent être modifiées dans
              l&apos;interface lors du calcul d&apos;un thème, sauf mention
              contraire.
            </p>
            <ul style={listStyle}>
              <li style={liStyle}>
                <strong>Zodiaque</strong> &mdash; tropical (aligné sur le point
                vernal et les saisons). Convention occidentale dominante.
                Les zodiaques sidéraux ne sont pas exposés dans l&apos;UI
                actuelle.
              </li>
              <li style={liStyle}>
                <strong>Système de maisons</strong> &mdash; Placidus par défaut.
                Alternatives proposées : Koch (variante de Placidus,
                utilisée en astrologie moderne allemande) et Whole Sign
                Houses (système ancien, plus stable aux hautes
                latitudes).
              </li>
              <li style={liStyle}>
                <strong>Corps célestes inclus</strong> &mdash; Soleil, Lune,
                Mercure, Vénus, Mars, Jupiter, Saturne, Uranus, Neptune,
                Pluton, plus le Nœud Nord lunaire (vrai), Chiron et
                Lilith moyenne. Soit treize points au total.
              </li>
              <li style={liStyle}>
                <strong>Points angulaires</strong> &mdash; ascendant et milieu du
                ciel calculés et exposés. Descendant et fond du ciel
                déduits par symétrie (180° opposés).
              </li>
            </ul>
          </div>
        </RevealOnScroll>
      </section>

      {/* ========== Section 3 : Orbes par aspect ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-orbes"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>III. Orbes</p>
          <h2
            id="method-section-orbes"
            className={styles.methodTransparenceTitle}
          >
            Orbes par aspect
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              L&apos;orbe est l&apos;écart toléré autour de l&apos;angle exact d&apos;un
              aspect pour qu&apos;il soit considéré comme actif. Plus l&apos;orbe
              est large, plus l&apos;aspect a de chances d&apos;exister, mais plus
              son influence est diffuse.
            </p>

            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Aspect</th>
                    <th style={thStyle}>Symbole</th>
                    <th style={thStyle}>Angle</th>
                    <th style={thStyle}>Orbe par défaut</th>
                  </tr>
                </thead>
                <tbody>
                  {ASPECT_ORBS.map((row) => (
                    <tr key={row.name}>
                      <td style={tdNameStyle}>{row.name}</td>
                      <td style={tdSymStyle(row.tone)}>{row.symbol}</td>
                      <td style={tdMonoStyle}>{row.angle}</td>
                      <td style={tdMonoStyle}>{row.orb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 24, fontSize: "0.95rem" }}>
              Ces valeurs sont les <em>défauts Llmastro</em>, alignés sur
              les usages dominants de l&apos;astrologie occidentale moderne
              (notamment les conventions de Robert Hand et Liz Greene).
              Les conjonctions et oppositions impliquant les luminaires
              (Soleil, Lune) peuvent admettre des orbes plus larges dans
              certains cadrages traditionnels — non implémentés ici par
              souci de cohérence inter-aspects.
            </p>
          </div>
        </RevealOnScroll>
      </section>

      {/* ========== Section 4 : Points sensibles ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-points"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>IV. Points sensibles</p>
          <h2
            id="method-section-points"
            className={styles.methodTransparenceTitle}
          >
            Ce qui est calculé, ce qui ne l&apos;est pas
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              <strong>Calculés et exposés</strong> dans les thèmes natals&nbsp;:
              les douze cuspides de maisons, l&apos;ascendant, le milieu du
              ciel, les positions des treize corps célestes (Soleil →
              Pluton, Nœud Nord vrai, Chiron, Lilith moyenne), les
              aspects entre planètes, le numéro de chemin de vie
              (numérologie pythagoricienne).
            </p>
            <p>
              <strong>Calculés mais non encore exposés</strong> dans
              l&apos;interface utilisateur&nbsp;: les phases lunaires précises et
              les rétrogradations sont disponibles côté API mais
              n&apos;apparaissent pas systématiquement dans l&apos;UI dashboard.
              Le datasheet à venir (chantier 6) les rendra accessibles.
            </p>
            <p>
              <strong>Non implémentés à ce jour</strong>&nbsp;: Part de Fortune,
              Vertex, antiscia et contre-antiscia, dignités planétaires
              (domicile, exaltation, exil, chute), aspects mineurs
              (semi-carré, semi-sextile, sesquicarré, quintile), points
              arabes au-delà de la Part de Fortune, harmoniques au-delà
              du 8<sup>e</sup>. Ces éléments sont parqués dans la
              feuille de route, sans engagement de date.
            </p>
          </div>
        </RevealOnScroll>
      </section>

      {/* ========== Section 5 : Comment Kairos génère vos lectures ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-kairos"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>V. Kairos</p>
          <h2
            id="method-section-kairos"
            className={styles.methodTransparenceTitle}
          >
            Comment Kairos génère vos lectures
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              Kairos est le service interne qui produit les
              interprétations textuelles de Llmastro. Son pipeline est{" "}
              <strong>déterministe en entrée</strong> (les positions
              astrologiques exactes) et <strong>génératif en sortie</strong>{" "}
              (un modèle de langage rédige le texte). Voici les étapes :
            </p>
            <ol style={listStyle}>
              <li style={liStyle}>
                Le moteur d&apos;éphémérides calcule les positions, maisons et
                aspects du thème, puis enrichit le résultat avec des
                métadonnées (offset UTC appliqué, résolution timezone,
                indicateur d&apos;heure connue ou inconnue).
              </li>
              <li style={liStyle}>
                Un prompt structuré est composé à partir de ces données.
                Il contient les positions exactes, les aspects majeurs,
                la phase lunaire, et des consignes éditoriales (ton,
                longueur, registres à éviter).
              </li>
              <li style={liStyle}>
                Le modèle de langage utilisé est <strong>xAI Grok</strong>{" "}
                (modèle <code>grok-4.3</code> à ce
                jour). Il rédige une réponse en français en suivant le
                cadrage du prompt.
              </li>
              <li style={liStyle}>
                Un post-traitement applique des règles de cohérence
                (formatage Markdown, suppression d&apos;artefacts), puis la
                réponse est mise en cache pour éviter de re-générer le
                même thème à chaque consultation.
              </li>
            </ol>
            <p>
              Le contenu exact des prompts n&apos;est pas public, mais{" "}
              <strong>aucune information personnelle</strong> au-delà des
              données astrologiques anonymisées (date, heure, lieu,
              positions calculées) n&apos;est transmise au modèle. Le LLM ne
              connaît ni votre nom, ni votre email, ni l&apos;historique de
              vos précédentes lectures.
            </p>
            <p>
              <strong>Limites assumées</strong>&nbsp;: comme tout système
              génératif, Kairos peut produire des phrases imprécises sur
              les configurations rares (voir{" "}
              <Link
                href="/limites"
                style={{ color: "var(--gold)", borderBottom: "1px solid currentColor" }}
              >
                la page Limites
              </Link>
              ). Les calculs eux-mêmes restent exacts&nbsp;: la fiche
              technique du thème permet toujours de vérifier
              indépendamment.
            </p>
          </div>
        </RevealOnScroll>
      </section>

      {/* ========== Section 6 : Mises à jour et versions ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-versions"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>VI. Versions</p>
          <h2
            id="method-section-versions"
            className={styles.methodTransparenceTitle}
          >
            Mises à jour et versions
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              Llmastro évolue par <strong>archives versionnées</strong>. Chaque
              modification du code est encapsulée dans un patch testé,
              idempotent, et accompagné d&apos;un script de rollback
              bit-perfect. Les fichiers modifiés portent en commentaire
              de fin un marker du type{" "}
              <code style={codeStyle}>{"// ARCHIVE-NOM-V1 applied"}</code>,
              ce qui permet d&apos;auditer en lecture rapide quelles
              modifications ont été appliquées à quelle partie du
              système.
            </p>
            <p>
              Ce protocole évite les régressions silencieuses et garantit
              qu&apos;une mise à jour peut être annulée intégralement, sans
              effets résiduels, en cas de problème détecté en production.
              Il s&apos;inscrit dans la même logique de transparence que le
              reste de cette page&nbsp;: la maintenance n&apos;est pas opaque,
              elle est traçable.
            </p>
            <p>
              Les changements de fond touchant aux conventions
              astrologiques ou aux algorithmes de calcul feront
              systématiquement l&apos;objet d&apos;une note dans cette section,
              rétroactivement si nécessaire.
            </p>
          </div>
        </RevealOnScroll>
      </section>

      {/* ========== Section 7 : Pour aller plus loin ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-aller-plus-loin"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>VII. Lectures</p>
          <h2
            id="method-section-aller-plus-loin"
            className={styles.methodTransparenceTitle}
          >
            Pour aller plus loin
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              Llmastro s&apos;appuie sur le corpus consolidé de l&apos;astrologie
              occidentale du XX<sup>e</sup> et XXI<sup>e</sup> siècle.
              Pour les lectrices et lecteurs souhaitant approfondir, voici
              quelques points d&apos;entrée fiables&nbsp;:
            </p>
            <ul style={listStyle}>
              <li style={liStyle}>
                <strong>Robert Hand</strong>, <em>Horoscope Symbols</em>{" "}
                (1981) &mdash; référence sur les significations symboliques des
                planètes et aspects.
              </li>
              <li style={liStyle}>
                <strong>Liz Greene</strong>, <em>Saturn: A New Look at an
                Old Devil</em> (1976) &mdash; ouvrage fondateur de l&apos;approche
                psychologique en astrologie.
              </li>
              <li style={liStyle}>
                <strong>Stephen Arroyo</strong>, <em>Astrology, Psychology,
                and the Four Elements</em> (1975) &mdash; cadre élémentaire
                (feu, terre, air, eau) appliqué à l&apos;astrologie.
              </li>
              <li style={liStyle}>
                <strong>Howard Sasportas</strong>, <em>The Twelve
                Houses</em> (1985) &mdash; lecture détaillée du symbolisme des
                maisons astrologiques.
              </li>
              <li style={liStyle}>
                <strong>Reinhold Ebertin</strong>, <em>The Combination of
                Stellar Influences</em> (1940) &mdash; ouvrage technique de
                référence sur les configurations à trois planètes.
              </li>
            </ul>
            <p>
              Une bibliographie plus complète, avec attribution explicite
              des sources d&apos;inspiration par catégorie d&apos;aspect, sera
              ajoutée prochainement (chantier dédié).
            </p>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Styles inline (cohérents avec landing.module.css existant)
// ──────────────────────────────────────────────────────────

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  marginTop: 18,
  marginBottom: 0,
};

const liStyle: React.CSSProperties = {
  marginBottom: 14,
  paddingLeft: 22,
  position: "relative",
  lineHeight: 1.65,
};

const tableWrapStyle: React.CSSProperties = {
  marginTop: 24,
  overflowX: "auto",
  border: "1px solid var(--border-soft)",
  borderRadius: 8,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontFamily: "var(--font-body)",
  fontSize: "0.95rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  borderBottom: "1px solid var(--border-soft)",
  fontWeight: 500,
  fontSize: "0.78rem",
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  color: "var(--gold)",
  opacity: 0.85,
  background: "rgba(201, 168, 76, 0.04)",
};

const tdNameStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--border-soft)",
  color: "var(--star)",
};

const tdMonoStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--border-soft)",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  color: "var(--muted)",
  fontSize: "0.92rem",
};

function tdSymStyle(tone: "h" | "t" | "n"): React.CSSProperties {
  const color =
    tone === "h"
      ? "var(--harmony, #3ecf8e)"
      : tone === "t"
      ? "var(--tension, #e54545)"
      : "var(--gold)";
  return {
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-soft)",
    fontSize: "1.15rem",
    color,
    textAlign: "center",
    width: "1%",
  };
}

const codeStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.9em",
  background: "rgba(201, 168, 76, 0.08)",
  border: "1px solid var(--border-soft)",
  padding: "1px 6px",
  borderRadius: 4,
  color: "var(--gold)",
};

// ARCHIVE-METHOD-DEEP-DOC-V1 applied

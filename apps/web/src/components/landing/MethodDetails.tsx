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
  { symbol: "△", name: "Trigone",      angle: "120°", orb: "8°",  tone: "h" },
  { symbol: "□", name: "Carré",        angle: "90°",  orb: "7°",  tone: "t" },
  { symbol: "⚹", name: "Sextile",      angle: "60°",  orb: "6°",  tone: "h" },
  { symbol: "⚻", name: "Quinconce",    angle: "150°", orb: "3°",  tone: "t" },
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
              Llmastro s&apos;appuie sur <strong>Swiss Ephemeris</strong>, en{" "}
              <strong>mode Moshier</strong>, comme moteur principal de
              calcul. Swiss Ephemeris est la bibliothèque de référence du
              milieu astrologique professionnel ; son mode Moshier est une{" "}
              <em>approximation semi-analytique de haute précision</em> de
              l&apos;éphéméride du Jet Propulsion Laboratory de la NASA, qui
              ne nécessite aucun fichier de données externe. La précision
              sur les positions planétaires est de l&apos;ordre de
              l&apos;<em>arcseconde</em> sur toute la plage utile (de l&apos;an
              −3000 à +3000).
            </p>
            <p>
              En cas d&apos;indisponibilité du binaire natif Swiss Ephemeris
              (build sans node-gyp, environnement contraint), Llmastro
              bascule automatiquement sur un <strong>moteur de secours
              maison</strong>. Celui-ci calcule le Soleil et la Lune par les
              séries de Jean Meeus (<em>Astronomical Algorithms</em>) et les
              planètes par éléments orbitaux képlériens. Sa précision est
              volontairement plus modeste — de l&apos;ordre de l&apos;arcminute
              sur le Soleil, du dixième de degré sur la Lune, jusqu&apos;à
              quelques degrés sur les planètes lentes : suffisante pour
              garantir le bon signe et la bonne maison, mais non destinée à
              l&apos;analyse fine. Le recours au moteur de secours est tracé
              côté serveur et consultable via le diagnostic
              d&apos;administration.
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
                Alternatives proposées : Koch (système horaire répandu en
                astrologie moderne, notamment germanophone) et Whole Sign
                Houses (système ancien, plus stable aux hautes
                latitudes).
              </li>
              <li style={liStyle}>
                <strong>Corps célestes inclus</strong> &mdash; Soleil, Lune,
                Mercure, Vénus, Mars, Jupiter, Saturne, Uranus, Neptune,
                Pluton, ainsi que le <strong>Nœud Nord lunaire moyen</strong>{" "}
                et la <strong>Lilith moyenne</strong> (Lune noire). Chiron,
                qui exige des fichiers d&apos;éphémérides supplémentaires,
                figure dans la feuille de route.
              </li>
              <li style={liStyle}>
                <strong>Points angulaires</strong> &mdash; ascendant, milieu du
                ciel et Vertex calculés et exposés. Descendant et fond du
                ciel déduits par symétrie (180° opposés).
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
              Ces valeurs sont les <em>orbes par défaut du thème natal</em>.
              Les aspects impliquant un <strong>luminaire</strong> (Soleil
              ou Lune) bénéficient d&apos;un élargissement de{" "}
              <strong>+2°</strong>, ces deux corps étant les plus
              structurants du thème. Les <strong>transits</strong> utilisent
              des orbes plus <em>serrés</em> (sextile 5°, trigone 7°…) : un
              transit est un événement daté, et un orbe large l&apos;étalerait
              sur plusieurs semaines. Ces conventions suivent les usages
              dominants de l&apos;astrologie occidentale moderne — il
              n&apos;existe pas de norme universelle des orbes.
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
              <strong>Calculés et exposés</strong> dans les thèmes
              natals&nbsp;: les douze cuspides de maisons, l&apos;ascendant, le
              milieu du ciel et le Vertex, les positions des corps célestes
              listés plus haut, les aspects entre planètes, les
              rétrogradations, la phase lunaire de naissance, la{" "}
              <strong>Part de Fortune</strong>, les antiscia et
              contre-antiscia, et le nombre de chemin de vie (numérologie
              pythagoricienne). La fiche technique du thème (datasheet)
              rassemble l&apos;ensemble de ces éléments.
            </p>
            <p>
              <strong>Non implémentés à ce jour</strong>&nbsp;: dignités
              planétaires (domicile, exaltation, exil, chute), aspects
              mineurs (semi-carré, semi-sextile, sesquicarré, quintile),
              points arabes au-delà de la Part de Fortune, harmoniques
              au-delà du 8<sup>e</sup>. Ces éléments figurent dans la
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
          <p className={styles.sectionEyebrow}>VI. Évolutions</p>
          <h2
            id="method-section-versions"
            className={styles.methodTransparenceTitle}
          >
            Comment Llmastro évolue
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              Llmastro est en évolution continue. Chaque mise à jour est
              testée, rejouable, et peut être annulée intégralement en cas
              de problème détecté en production. L&apos;objectif&nbsp;:
              améliorer la plateforme sans jamais casser ce qui marchait
              pour toi.
            </p>
            <p>
              Les changements de fond — ceux qui touchent aux conventions
              astrologiques, aux algorithmes de calcul ou au ton des
              lectures — font l&apos;objet d&apos;une note dans cette section,
              rétroactivement si nécessaire. Tu sauras pourquoi une
              lecture change si elle change.
            </p>
            <p>
              Les évolutions purement techniques (sécurité, performance,
              compatibilité navigateur) restent silencieuses&nbsp;: elles
              n&apos;affectent pas le contenu de ce que tu lis.
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
              Une bibliographie complète, avec attribution des sources par
              catégorie, est disponible sur la page{" "}
              <Link
                href="/bibliographie"
                style={{ color: "var(--gold)", borderBottom: "1px solid currentColor" }}
              >
                Bibliographie
              </Link>
              .
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

// ARCHIVE-METHOD-DEEP-DOC-V1 applied

// ============================================================
// ARCHIVE-METHOD-DEEP-DOC-V1 — MethodDetails component
// Page /methode condensée en 4 sections orientées bénéfice :
// 1. Des calculs de niveau pro (calculs + astres + conventions)
// 2. Ce que ton thème révèle (datasheet + orbes + aspects)
// 3. Comment Kairos écrit tes lectures (pipeline IA + surfaces)
// 4. Notre honnêteté (limites + évolutions + sources)
// Ton grand public, transparence préservée. Texte hardcodé FR.
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

const linkStyle: React.CSSProperties = {
  color: "var(--gold)",
  borderBottom: "1px solid currentColor",
};

// ──────────────────────────────────────────────────────────
// Composant
// ──────────────────────────────────────────────────────────

export function MethodDetails() {
  return (
    <>
      {/* ========== 1 : Des calculs de niveau pro ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-calculs"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>1. Calculs</p>
          <h2
            id="method-section-calculs"
            className={styles.methodTransparenceTitle}
          >
            Des calculs dignes d&apos;un observatoire
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              Chez Llmastro, rien n&apos;est inventé&nbsp;: chaque position
              d&apos;astre est <em>calculée</em>. Nous utilisons{" "}
              <strong>Swiss Ephemeris</strong>, la référence des astrologues
              professionnels, nourrie par les données de la NASA &mdash; les
              mêmes que celles des observatoires. La précision atteint
              l&apos;arcseconde, sur plusieurs millénaires. Ton thème repose
              donc sur de l&apos;astronomie réelle, jamais sur des à-peu-près.
            </p>
            <p>
              On convertit aussi ton heure de naissance en tenant compte des
              fuseaux horaires, des changements d&apos;heure et de leurs
              subtilités historiques &mdash; automatiquement, pour que ton
              ascendant tombe juste.
            </p>

            <p style={{ marginTop: 8 }}>
              <strong>Les astres et conventions de ton thème&nbsp;:</strong>
            </p>
            <ul style={listStyle}>
              <li style={liStyle}>
                <strong>Les corps célestes</strong>{" "}&mdash; du Soleil à Pluton,
                plus les Nœuds lunaires, la Lilith (Lune noire), Chiron et les
                astéroïdes Cérès, Pallas, Junon et Vesta. De quoi dresser un
                portrait riche, sans surcharger la lecture.
              </li>
              <li style={liStyle}>
                <strong>Le zodiaque tropical</strong>{" "}&mdash; la convention
                occidentale, alignée sur les saisons.
              </li>
              <li style={liStyle}>
                <strong>Les maisons</strong>{" "}&mdash; Placidus par défaut, avec
                Koch et Whole Sign en option si tu préfères.
              </li>
              <li style={liStyle}>
                <strong>Les points clés</strong>{" "}&mdash; ascendant, milieu du
                ciel et Vertex calculés&nbsp;; le reste se déduit par symétrie.
              </li>
            </ul>
          </div>
        </RevealOnScroll>
      </section>

      {/* ========== 2 : Ce que ton thème révèle ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-theme"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>2. Ton thème</p>
          <h2
            id="method-section-theme"
            className={styles.methodTransparenceTitle}
          >
            Ce que ton thème révèle
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              Ta fiche technique rassemble tout&nbsp;: tes douze maisons, ton
              ascendant et ton milieu du ciel, la position de chaque astre, les
              aspects qu&apos;ils forment, les rétrogradations, la phase de la
              Lune à ta naissance, les sept <strong>lots hermétiques</strong>{" "}
              (Fortune, Esprit, Éros…) et même ton chemin de vie. Tout est
              affiché&nbsp;: tu peux toujours vérifier par toi-même.
            </p>
            <p>
              Les <strong>aspects</strong>{" "}sont les angles que les astres
              forment entre eux. Chacun a une «&nbsp;marge&nbsp;» (l&apos;orbe)
              en deçà de laquelle on le considère actif&nbsp;: plus elle est
              large, plus l&apos;aspect compte. Voici nos réglages par défaut.
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
              Le Soleil et la Lune, les plus structurants, gagnent un peu de
              marge (+2°). Les <strong>transits</strong>{" "}du jour, eux, sont
              calculés plus serré&nbsp;: un transit est un rendez-vous daté, pas
              une ambiance de plusieurs semaines. On suit là les usages
              dominants de l&apos;astrologie occidentale &mdash; il n&apos;existe
              pas de norme universelle.
            </p>
          </div>
        </RevealOnScroll>
      </section>

      {/* ========== 3 : Comment Kairos écrit tes lectures ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-kairos"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>3. Kairos</p>
          <h2
            id="method-section-kairos"
            className={styles.methodTransparenceTitle}
          >
            Comment Kairos écrit tes lectures
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              Kairos, c&apos;est notre plume. Le principe est simple&nbsp;:{" "}
              <strong>les chiffres d&apos;abord, les mots ensuite</strong>. Nos
              calculs déterminent les positions exactes de ton ciel, puis un
              modèle de langage les met en récit, en français, avec un cadrage
              éditorial précis (ton, longueur, registres à éviter).
            </p>
            <p>
              Côté vie privée, c&apos;est cadré&nbsp;: le modèle ne reçoit que
              des données astrologiques anonymisées (date, heure, lieu,
              positions). Il ne connaît <em>ni</em>{" "}ton nom, <em>ni</em>{" "}ton
              email, <em>ni</em>{" "}l&apos;historique de tes lectures.
            </p>

            <p style={{ marginTop: 8 }}>
              <strong>Là où Kairos t&apos;accompagne&nbsp;:</strong>
            </p>
            <ul style={listStyle}>
              <li style={liStyle}>
                <strong>Ton horoscope</strong>{" "}&mdash; au jour, à la semaine, au
                mois ou à l&apos;année. Plus la fenêtre est large, plus le texte
                parle de tendances de fond&nbsp;: pour une question précise et
                datée, vise le jour ou la semaine.
              </li>
              <li style={liStyle}>
                <strong>La compatibilité</strong>{" "}&mdash; l&apos;analyse croise
                vos deux thèmes (synastrie) pour éclairer ce qui vous lie et ce
                qui vous travaille.
              </li>
              <li style={liStyle}>
                <strong>Le dialogue</strong>{" "}&mdash; une conversation libre avec
                Kairos, qui a ton thème en tête et suit le fil de l&apos;échange.
                Sauvegarde une conversation pour la reprendre&nbsp;; sinon,
                chaque session repart d&apos;une page blanche.
              </li>
            </ul>
          </div>
        </RevealOnScroll>
      </section>

      {/* ========== 4 : Notre honnêteté ========== */}
      <section
        className={`${styles.section} ${styles.methodTransparence}`}
        aria-labelledby="method-section-honnetete"
      >
        <RevealOnScroll>
          <p className={styles.sectionEyebrow}>4. Honnêteté</p>
          <h2
            id="method-section-honnetete"
            className={styles.methodTransparenceTitle}
          >
            Notre honnêteté
          </h2>

          <div className={styles.methodTransparenceProse}>
            <p>
              On préfère le dire&nbsp;: comme tout système qui écrit, Kairos
              peut être imprécis sur les configurations rares. On en parle
              ouvertement sur{" "}
              <Link href="/limites" style={linkStyle}>
                la page Limites
              </Link>
              . Les calculs, eux, restent exacts&nbsp;: ta fiche technique te
              permet toujours de vérifier.
            </p>
            <p>
              Llmastro s&apos;améliore en continu, et chaque mise à jour est
              testée et réversible. Notre objectif&nbsp;: enrichir la plateforme
              sans jamais casser ce qui marchait pour toi. Quand un changement
              touche au fond &mdash; conventions, calculs, ton des lectures
              &mdash; on te l&apos;explique.
            </p>
            <p>
              Enfin, nos lectures s&apos;appuient sur le corpus de l&apos;astrologie
              occidentale moderne (Robert Hand, Liz Greene, Stephen Arroyo…).
              Les sources complètes sont sur la page{" "}
              <Link href="/bibliographie" style={linkStyle}>
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

// ============================================================
// LANDING-V1 — HistoirePage (page /histoire)
// Frise chronologique de la lecture du ciel, des premières
// pierres dressées jusqu'à l'IA. Maquette portée et harmonisée
// sur le design « Céleste ». ARCHIVE-EDITORIAL-PAGES-V1.
// ============================================================

"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { RevealOnScroll } from "./RevealOnScroll";
import { StarsBackground } from "@/components/ui/StarsBackground";
import shell from "./landing.module.css";
import s from "./editorial.module.css";

export function HistoirePage() {
  const t = useT();

  return (
    <>
      <StarsBackground count={120} />
      <div className={shell.page}>
        <Header />
        <main>
          {/* HÉRO — photo NASA plein cadre */}
          <section className={s.histHero}>
            <p className={s.edEyebrow}>{t("hist_hero_eyebrow")}</p>
            <h1 className={s.edHeroTitle}>
              {t("hist_hero_title_1")}
              <br />
              {t("hist_hero_title_2")}
              <br />
              <em>{t("hist_hero_title_em")}</em>
            </h1>
            <p className={s.edHeroLede}>{t("hist_hero_p")}</p>
            <div className={s.histGlyph} aria-hidden="true" />
            <div className={s.histCredit}>{t("hist_hero_credit")}</div>
          </section>

          <div className={s.edWrap}>
            <RevealOnScroll>
              <p className={`${s.edLead} ${s.histLead}`}>
                <span className={s.drop}>{t("hist_lead")}</span>
              </p>
            </RevealOnScroll>

            <div className={s.histTimeline}>
              {/* 1 — Avant l'écriture */}
              <RevealOnScroll>
                <article className={s.histChapter}>
                  <span className={s.histNode} aria-hidden="true" />
                  <div className={s.histText}>
                    <div className={s.histEra}>{t("hist_c1_era")}</div>
                    <h2>{t("hist_c1_title")}</h2>
                    <p>{t("hist_c1_p1")}</p>
                    <p>{t("hist_c1_p2")}</p>
                  </div>
                  <div>
                    <div className={s.edFactcard}>
                      <div className={s.k}>{t("hist_c1_fact_k")}</div>
                      <div className={s.v}>{t("hist_c1_fact_v")}</div>
                      <div className={s.d}>{t("hist_c1_fact_d")}</div>
                    </div>
                  </div>
                </article>
              </RevealOnScroll>

              {/* 2 — Mésopotamie (image Met) */}
              <RevealOnScroll>
                <article className={s.histChapter}>
                  <span className={s.histNode} aria-hidden="true" />
                  <div>
                    <figure className={s.edPlate}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        loading="lazy"
                        src="/heritage/babylonian-eclipse-tablet.jpg"
                        alt="Tablette cunéiforme babylonienne d'éphémérides d'éclipses"
                      />
                      <figcaption>
                        <b>{t("hist_c2_fig_title")}</b>
                        {t("hist_c2_fig_caption")}
                      </figcaption>
                    </figure>
                  </div>
                  <div className={s.histText}>
                    <div className={s.histEra}>{t("hist_c2_era")}</div>
                    <h2>{t("hist_c2_title")}</h2>
                    <p>{t("hist_c2_p1")}</p>
                    <p>{t("hist_c2_p2")}</p>
                  </div>
                </article>
              </RevealOnScroll>

              {/* 3 — Égypte (image Met) */}
              <RevealOnScroll>
                <article className={s.histChapter}>
                  <span className={s.histNode} aria-hidden="true" />
                  <div className={s.histText}>
                    <div className={s.histEra}>{t("hist_c3_era")}</div>
                    <h2>{t("hist_c3_title")}</h2>
                    <p>{t("hist_c3_p1")}</p>
                    <p>{t("hist_c3_p2")}</p>
                  </div>
                  <div>
                    <figure className={s.edPlate}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        loading="lazy"
                        src="/heritage/senmut-ceiling.jpg"
                        alt="Fac-similé du plafond astronomique de la tombe de Senmout"
                      />
                      <figcaption>
                        <b>{t("hist_c3_fig_title")}</b>
                        {t("hist_c3_fig_caption")}
                      </figcaption>
                    </figure>
                  </div>
                </article>
              </RevealOnScroll>

              {/* 4 — Chine (image British Library) */}
              <RevealOnScroll>
                <article className={s.histChapter}>
                  <span className={s.histNode} aria-hidden="true" />
                  <div>
                    <figure className={s.edPlate}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        loading="lazy"
                        src="/heritage/oracle-bone-shang.png"
                        alt="Os oraculaire de la dynastie Shang gravé d'inscriptions divinatoires"
                      />
                      <figcaption>
                        <b>{t("hist_c4_fig_title")}</b>
                        {t("hist_c4_fig_caption")}
                      </figcaption>
                    </figure>
                  </div>
                  <div className={s.histText}>
                    <div className={s.histEra}>{t("hist_c4_era")}</div>
                    <h2>{t("hist_c4_title")}</h2>
                    <p>{t("hist_c4_p1")}</p>
                    <p>{t("hist_c4_p2")}</p>
                  </div>
                </article>
              </RevealOnScroll>

              {/* 5 — Inde & Mésoamérique */}
              <RevealOnScroll>
                <article className={s.histChapter}>
                  <span className={s.histNode} aria-hidden="true" />
                  <div className={s.histText}>
                    <div className={s.histEra}>{t("hist_c5_era")}</div>
                    <h2>{t("hist_c5_title")}</h2>
                    <p>{t("hist_c5_p1")}</p>
                    <p>{t("hist_c5_p2")}</p>
                  </div>
                  <div>
                    <div className={s.edFactcard}>
                      <div className={s.k}>{t("hist_c5_fact_k")}</div>
                      <div className={s.v}>{t("hist_c5_fact_v")}</div>
                      <div className={s.d}>{t("hist_c5_fact_d")}</div>
                    </div>
                  </div>
                </article>
              </RevealOnScroll>
            </div>
          </div>

          {/* PIVOT vers l'IA — bandeau photo */}
          <RevealOnScroll>
            <section className={`${s.edPhotoBand} ${s.histPivot}`}>
              <div className={s.inner}>
                <div className={s.edEyebrow}>{t("hist_pivot_eyebrow")}</div>
                <h2>
                  {t("hist_pivot_title_1")} <em>{t("hist_pivot_title_em")}</em>
                </h2>
                <p>{t("hist_pivot_p1")}</p>
                <p>{t("hist_pivot_p2")}</p>
                <p>{t("hist_pivot_p3")}</p>
                <Link href="/auth/register" className={s.edCta}>
                  {t("hist_pivot_cta")}
                </Link>
              </div>
            </section>
          </RevealOnScroll>

          {/* RÉFÉRENCES — citations bibliographiques (non traduites) */}
          <RevealOnScroll>
            <section className={s.histRefs}>
              <h3>{t("hist_refs_title")}</h3>
              <ol className={s.histRefsList}>
                <li>
                  Malville, J. M., Wendorf, F., Mazar, A. A. &amp; Schild, R.{" "}
                  <i>Megaliths and Neolithic astronomy in southern Egypt.</i> Nature, vol. 392
                  (1998) ; voir aussi Malville et al., <i>Astronomy of Nabta Playa</i>, African
                  Skies (2007).
                </li>
                <li>
                  Reiner, E. &amp; Pingree, D.{" "}
                  <i>Babylonian Planetary Omens : Enūma Anu Enlil, tablette 63.</i> Undena / Brill.
                  Notice :{" "}
                  <a
                    href="https://www.metmuseum.org/art/collection/search/321969"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    The Met, n° 86.11.345
                  </a>
                  .
                </li>
                <li>
                  Hunger, H. &amp; Pingree, D. <i>MUL.APIN : An Astronomical Compendium in
                  Cuneiform.</i> Sur l'origine du zodiaque à 12 signes : Rochberg, F.{" "}
                  <i>The Heavenly Writing.</i> Cambridge University Press (2004).
                </li>
                <li>
                  Parker, R. A. <i>The Calendars of Ancient Egypt.</i> University of Chicago Press
                  (1950) ; notice{" "}
                  <a
                    href="https://www.metmuseum.org/art/collection/search/544566"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    The Met, n° 48.105.52
                  </a>{" "}
                  (plafond de Senmout).
                </li>
                <li>
                  Keightley, D. N. <i>Sources of Shang History: The Oracle-Bone Inscriptions of
                  Bronze Age China.</i> University of California Press (1978) ; Pang, K. D. &amp;
                  Yau, K. K. C., sur les éclipses des inscriptions oraculaires.
                </li>
              </ol>

              <div className={s.histCredits}>
                <h3>{t("hist_credits_title")}</h3>
                <ol className={s.histRefsList}>
                  <li>
                    Voie lactée depuis l'ISS (ISS041-E-045469),{" "}
                    <a
                      href="https://www.nasa.gov/image-article/panorama-of-night-sky-milky-way/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      NASA
                    </a>{" "}
                    / Reid Wiseman — domaine public.
                  </li>
                  <li>
                    Tablette d'éphémérides d'éclipses, Babylone —{" "}
                    <a
                      href="https://www.metmuseum.org/art/collection/search/321969"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      The Metropolitan Museum of Art
                    </a>
                    , n° 86.11.345, Open Access (CC0).
                  </li>
                  <li>
                    Plafond astronomique de la tombe de Senmout, fac-similé de C. K. Wilkinson —{" "}
                    <a
                      href="https://www.metmuseum.org/art/collection/search/544566"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      The Metropolitan Museum of Art
                    </a>
                    , n° 48.105.52, Open Access (CC0).
                  </li>
                  <li>
                    Os oraculaire inscrit, dynastie Shang —{" "}
                    <a
                      href="https://commons.wikimedia.org/wiki/File:Oracle_bone_-_BL_Or._1595_recto.png"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      British Library
                    </a>
                    , Or. 1595, domaine public (CC0).
                  </li>
                </ol>
              </div>

              <p className={s.histNote}>{t("hist_note")}</p>
            </section>
          </RevealOnScroll>

          {/* LIEN RÉCIPROQUE → Le ciel & l'IA */}
          <RevealOnScroll>
            <div className={s.edWrap}>
              <Link href="/le-ciel-et-l-ia" className={s.edCrossLink}>
                <span className={s.edCrossKicker}>{t("hist_crosslink_kicker")}</span>
                <span className={s.edCrossTitle}>{t("hist_crosslink_title")}</span>
                <span className={s.edCrossP}>{t("hist_crosslink_p")}</span>
                <span className={s.edCrossCta}>
                  {t("hist_crosslink_cta")} <span aria-hidden="true">→</span>
                </span>
              </Link>
            </div>
          </RevealOnScroll>
        </main>
        <Footer />
      </div>
    </>
  );
}

// ARCHIVE-EDITORIAL-PAGES-V1 applied

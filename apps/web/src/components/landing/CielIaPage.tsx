// ============================================================
// LANDING-V1 — CielIaPage (page /le-ciel-et-l-ia)
// « Le ciel & l'IA » : la métaphore des constellations — relier
// les points pour faire du sens. Maquette portée et harmonisée
// sur le design « Céleste ». ARCHIVE-EDITORIAL-PAGES-V1.
// ============================================================

"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { Header } from "./Header";
import { RevealOnScroll } from "./RevealOnScroll";
import { StarsBackground } from "@/components/ui/StarsBackground";
import shell from "./landing.module.css";
import s from "./editorial.module.css";

// Constellation décorative du héro : segments puis sommets.
const C_LINES = [
  { x1: 160, y1: 120, x2: 300, y2: 210, d: "0.2s" },
  { x1: 300, y1: 210, x2: 430, y2: 160, d: "0.5s" },
  { x1: 430, y1: 160, x2: 560, y2: 280, d: "0.8s" },
  { x1: 560, y1: 280, x2: 720, y2: 220, d: "1.1s" },
  { x1: 720, y1: 220, x2: 840, y2: 360, d: "1.4s" },
  { x1: 300, y1: 210, x2: 380, y2: 380, d: "1.7s" },
  { x1: 560, y1: 280, x2: 500, y2: 450, d: "2s" },
];
const C_DOTS = [
  { cx: 160, cy: 120, r: 3.2, d: "0.1s" },
  { cx: 300, cy: 210, r: 4, d: "0.4s" },
  { cx: 430, cy: 160, r: 3, d: "0.7s" },
  { cx: 560, cy: 280, r: 4.2, d: "1s" },
  { cx: 720, cy: 220, r: 3, d: "1.3s" },
  { cx: 840, cy: 360, r: 3.6, d: "1.6s" },
  { cx: 380, cy: 380, r: 2.6, d: "1.9s" },
  { cx: 500, cy: 450, r: 2.8, d: "2.2s" },
];

export function CielIaPage() {
  const t = useT();

  return (
    <>
      <StarsBackground count={120} />
      <div className={shell.page}>
        <Header />
        <main>
          {/* HÉRO — constellation animée */}
          <section className={s.cielHero}>
            <svg
              className={s.cielConstellation}
              viewBox="0 0 1000 600"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
            >
              {C_LINES.map((l, i) => (
                <line
                  key={`l${i}`}
                  className={s.cielCLine}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  style={{ animationDelay: l.d }}
                />
              ))}
              {C_DOTS.map((c, i) => (
                <circle
                  key={`c${i}`}
                  className={s.cielCDot}
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  style={{ animationDelay: c.d }}
                />
              ))}
            </svg>
            <div className={s.edEyebrow}>{t("cielia_hero_eyebrow")}</div>
            <h1 className={s.edHeroTitle}>
              {t("cielia_hero_title_1")}
              <br />
              <em>{t("cielia_hero_title_em")}</em>
            </h1>
            <p className={s.edHeroLede}>{t("cielia_hero_p")}</p>
          </section>

          <div className={s.edWrap}>
            {/* Lead */}
            <RevealOnScroll>
              <p className={s.edLead}>
                {t("cielia_lead_1")}
                <em>{t("cielia_lead_em")}</em>
                {t("cielia_lead_2")}
              </p>
            </RevealOnScroll>

            {/* Diptyque Hier / Aujourd'hui */}
            <RevealOnScroll>
              <div className={s.cielDiptych}>
                <div className={s.cielPast}>
                  <h3>{t("cielia_dip_past_h")}</h3>
                  <p>{t("cielia_dip_past_p")}</p>
                </div>
                <div className={s.cielNow}>
                  <h3>{t("cielia_dip_now_h")}</h3>
                  <p>{t("cielia_dip_now_p")}</p>
                </div>
              </div>
            </RevealOnScroll>

            {/* Comment ça marche */}
            <RevealOnScroll>
              <div className={s.edSecHead}>
                <div className={s.edKicker}>{t("cielia_steps_kicker")}</div>
                <h2 className={s.edSecTitle}>{t("cielia_steps_title")}</h2>
              </div>
            </RevealOnScroll>
            <RevealOnScroll>
              <div className={s.cielSteps}>
                <div className={s.cielStep}>
                  <div className={s.cielStepNum}>I</div>
                  <h3>{t("cielia_step1_title")}</h3>
                  <p>{t("cielia_step1_p")}</p>
                </div>
                <div className={s.cielStep}>
                  <div className={s.cielStepNum}>II</div>
                  <h3>{t("cielia_step2_title")}</h3>
                  <p>{t("cielia_step2_p")}</p>
                </div>
                <div className={s.cielStep}>
                  <div className={s.cielStepNum}>III</div>
                  <h3>{t("cielia_step3_title")}</h3>
                  <p>{t("cielia_step3_p")}</p>
                </div>
              </div>
            </RevealOnScroll>

            {/* Nos principes */}
            <RevealOnScroll>
              <div className={s.edSecHead}>
                <div className={s.edKicker}>{t("cielia_pr_kicker")}</div>
                <h2 className={s.edSecTitle}>{t("cielia_pr_title")}</h2>
              </div>
            </RevealOnScroll>
            <RevealOnScroll>
              <div className={s.cielPrinciples}>
                <div className={s.cielPr}>
                  <svg className={s.cielPrIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                  </svg>
                  <div>
                    <h4>{t("cielia_pr1_h")}</h4>
                    <p>{t("cielia_pr1_p")}</p>
                  </div>
                </div>
                <div className={s.cielPr}>
                  <svg className={s.cielPrIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 12h18" />
                    <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  <div>
                    <h4>{t("cielia_pr2_h")}</h4>
                    <p>{t("cielia_pr2_p")}</p>
                  </div>
                </div>
                <div className={s.cielPr}>
                  <svg className={s.cielPrIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2l2.4 6.5L21 9l-5 4.2L17.5 21 12 17.3 6.5 21 8 13.2 3 9l6.6-.5z" />
                  </svg>
                  <div>
                    <h4>{t("cielia_pr3_h")}</h4>
                    <p>{t("cielia_pr3_p")}</p>
                  </div>
                </div>
                <div className={s.cielPr}>
                  <svg className={s.cielPrIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M16 16l5 5" />
                  </svg>
                  <div>
                    <h4>{t("cielia_pr4_h")}</h4>
                    <p>{t("cielia_pr4_p")}</p>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>

          {/* Citation sur photo */}
          <RevealOnScroll>
            <section className={`${s.edPhotoBand} ${s.cielQuote}`}>
              <blockquote>
                {t("cielia_quote_1")}
                <em>{t("cielia_quote_em")}</em>
                {t("cielia_quote_2")}
              </blockquote>
              <div className={s.credit}>{t("cielia_quote_credit")}</div>
            </section>
          </RevealOnScroll>

          <div className={s.edWrap}>
            {/* Note honnête */}
            <RevealOnScroll>
              <div className={s.cielHonest}>
                <h3>{t("cielia_honest_h")}</h3>
                <p>{t("cielia_honest_p")}</p>
              </div>
            </RevealOnScroll>

            {/* CTA final */}
            <RevealOnScroll>
              <div className={s.edCtaWrap}>
                <h2>{t("cielia_cta_h")}</h2>
                <p>{t("cielia_cta_p")}</p>
                <Link href="/auth/register" className={s.edCta}>
                  {t("cielia_cta_btn")}
                </Link>
              </div>
            </RevealOnScroll>

            {/* LIEN RÉCIPROQUE → Histoire */}
            <RevealOnScroll>
              <Link href="/histoire" className={s.edCrossLink}>
                <span className={s.edCrossKicker}>{t("cielia_crosslink_kicker")}</span>
                <span className={s.edCrossTitle}>{t("cielia_crosslink_title")}</span>
                <span className={s.edCrossP}>{t("cielia_crosslink_p")}</span>
                <span className={s.edCrossCta}>
                  {t("cielia_crosslink_cta")} <span aria-hidden="true">→</span>
                </span>
              </Link>
            </RevealOnScroll>
          </div>
        </main>
      </div>
    </>
  );
}

// ARCHIVE-EDITORIAL-PAGES-V1 applied

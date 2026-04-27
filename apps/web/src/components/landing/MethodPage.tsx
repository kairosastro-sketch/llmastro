// ============================================================
// LANDING-V1 — MethodPage (page /methode)
// ============================================================

"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { RevealOnScroll } from "./RevealOnScroll";
import { StarsBackground } from "@/components/ui/StarsBackground";
import styles from "./landing.module.css";

export function MethodPage() {
  const t = useT();

  const piliers = [
    {
      eyebrow: "method_pilier1_eyebrow",
      title: "method_pilier1_title",
      text: "method_pilier1_text",
      tech: "method_pilier1_tech",
    },
    {
      eyebrow: "method_pilier2_eyebrow",
      title: "method_pilier2_title",
      text: "method_pilier2_text",
      tech: "method_pilier2_tech",
    },
    {
      eyebrow: "method_pilier3_eyebrow",
      title: "method_pilier3_title",
      text: "method_pilier3_text",
      tech: "method_pilier3_tech",
    },
  ];

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
            <p className={styles.sectionEyebrow}>
              {t("method_hero_eyebrow" as any)}
            </p>
            <h1
              className={styles.sectionTitle}
              style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", marginTop: 14 }}
            >
              {t("method_hero_title" as any)}
            </h1>
            <p className={styles.methodHeroChapeau}>
              {t("method_hero_chapeau" as any)}
            </p>
          </section>

          {/* 3 piliers */}
          <section className={`${styles.section} ${styles.methodPiliers}`}>
            <div className={styles.methodPiliersGrid}>
              {piliers.map((p, i) => (
                <RevealOnScroll key={i} delay={i * 100}>
                  <div className={styles.methodPilier}>
                    <p className={styles.methodPilierEyebrow}>
                      {t(p.eyebrow as any)}
                    </p>
                    <h2 className={styles.methodPilierTitle}>
                      {t(p.title as any)}
                    </h2>
                    <p className={styles.methodPilierText}>
                      {t(p.text as any)}
                    </p>
                    <p className={styles.methodPilierTech}>
                      {t(p.tech as any)}
                    </p>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </section>

          {/* Transparence */}
          <section className={`${styles.section} ${styles.methodTransparence}`}>
            <RevealOnScroll>
              <h2 className={styles.methodTransparenceTitle}>
                {t("method_transparence_title" as any)}
              </h2>

              <div className={styles.methodTransparenceProse}>
                <p>{t("method_transparence_p1" as any)}</p>
                <p>{t("method_transparence_p2" as any)}</p>
                <p>{t("method_transparence_p3" as any)}</p>
              </div>

              <div className={styles.methodCta}>
                <Link href="/auth/register" className={styles.ctaPrimary}>
                  {t("method_cta" as any)}
                </Link>
              </div>
            </RevealOnScroll>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}

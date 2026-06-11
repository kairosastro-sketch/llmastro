// ============================================================
// LEGAL-DOCS-V1 — LegalDocLayout
// ------------------------------------------------------------
// Shell partagé pour /cgu, /confidentialite, /mentions-legales.
// Garde le pattern Header sticky + StarsBackground + Footer
// déjà utilisé par les pages /methode, /limites, /bibliographie.
// Applique une typographie "prose" cohérente avec le look Céleste.
// ============================================================

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { StarsBackground } from "@/components/ui/StarsBackground";
import styles from "./landing.module.css";

interface LegalDocLayoutProps {
  title: string;
  version?: string;
  updatedAt?: string;
  children: ReactNode;
}

export function LegalDocLayout({
  title,
  version,
  updatedAt,
  children,
}: LegalDocLayoutProps) {
  return (
    <>
      <StarsBackground count={80} />
      <div className={styles.page}>
        <Header />
        <main
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "140px 24px 80px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 38,
              fontWeight: 300,
              color: "var(--star)",
              letterSpacing: ".03em",
              marginBottom: 8,
              lineHeight: 1.15,
            }}
          >
            {title}
          </h1>

          {(version || updatedAt) && (
            <p
              style={{
                fontSize: 13,
                color: "var(--muted)",
                marginBottom: 32,
                fontStyle: "italic",
              }}
            >
              {updatedAt && <>Dernière mise à jour&nbsp;: {updatedAt}</>}
              {version && updatedAt && " · "}
              {version && <>Version&nbsp;: {version}</>}
            </p>
          )}

          <article className="legal-prose">{children}</article>

          <div style={{ marginTop: 40 }}>
            <Link
              href="/"
              style={{ color: "var(--gold)", fontSize: 14, textDecoration: "none" }}
            >
              ← Retour à l&apos;accueil
            </Link>
          </div>
        </main>
      </div>

      <style jsx global>{`
        .legal-prose {
          color: var(--star);
          font-family: var(--font-body);
          font-size: 15px;
          line-height: 1.75;
        }
        .legal-prose h2 {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 400;
          color: var(--star);
          letter-spacing: 0.02em;
          margin: 48px 0 14px;
          padding-top: 12px;
          border-top: 1px solid var(--border-soft);
        }
        .legal-prose h2:first-child {
          margin-top: 24px;
          border-top: none;
          padding-top: 0;
        }
        .legal-prose h3 {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 400;
          color: var(--gold-l);
          letter-spacing: 0.01em;
          margin: 28px 0 10px;
        }
        .legal-prose h4 {
          font-size: 15px;
          font-weight: 600;
          color: var(--star);
          margin: 20px 0 8px;
        }
        .legal-prose p {
          margin: 0 0 14px;
        }
        .legal-prose ul,
        .legal-prose ol {
          margin: 0 0 16px;
          padding-left: 22px;
        }
        .legal-prose li {
          margin-bottom: 8px;
        }
        .legal-prose strong {
          color: var(--star);
          font-weight: 600;
        }
        .legal-prose em {
          font-style: italic;
          color: var(--muted-2);
        }
        .legal-prose a {
          color: var(--gold);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.18s var(--ease-out);
        }
        .legal-prose a:hover {
          border-bottom-color: var(--gold);
        }
        .legal-prose hr {
          border: 0;
          border-top: 1px solid var(--border-soft);
          margin: 36px 0;
        }
        .legal-prose blockquote {
          margin: 18px 0;
          padding: 14px 18px;
          border-left: 2px solid var(--gold);
          background: var(--bg-2);
          color: var(--muted-2);
          font-size: 14px;
        }
        .legal-prose .legal-table-wrap {
          overflow-x: auto;
          margin: 16px 0 22px;
          border: 1px solid var(--border-soft);
          border-radius: var(--r-md);
        }
        .legal-prose table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .legal-prose th,
        .legal-prose td {
          padding: 10px 12px;
          text-align: left;
          vertical-align: top;
          border-bottom: 1px solid var(--border-soft);
        }
        .legal-prose th {
          font-weight: 600;
          color: var(--star);
          background: var(--bg-2);
          font-size: 13px;
          letter-spacing: 0.02em;
        }
        .legal-prose tr:last-child td {
          border-bottom: none;
        }
        .legal-prose .legal-callout {
          margin: 22px 0;
          padding: 18px 20px;
          border: 1px solid var(--border-soft);
          border-radius: var(--r-md);
          background: var(--bg-2);
          color: var(--muted-2);
          font-size: 14px;
        }
        .legal-prose .legal-meta {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid var(--border-soft);
          font-size: 13px;
          color: var(--muted);
          font-style: italic;
        }
      `}</style>
    </>
  );
}

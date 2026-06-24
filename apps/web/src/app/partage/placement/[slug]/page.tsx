// ============================================================
// COMMUNITY-SHARE-OG-V1 — page de partage publique d'un placement.
// ------------------------------------------------------------
// Landing d'acquisition affichée quand on ouvre un lien partagé depuis
// la carte communautaire. 100 % anonyme (slug = planète-signe-pct).
// L'image Open Graph dynamique est dans opengraph-image.tsx (même segment,
// auto-attachée par Next.js). Le `?ref=` éventuel est capté en cookie par
// le middleware (parrainage).
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { parsePlacementSlug } from "@/lib/share/placement-slug";

export const revalidate = 86400; // contenu déterministe → cache long

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const p = parsePlacementSlug(slug);
  if (!p) {
    return { title: "Ta place dans le ciel collectif" };
  }
  const title = `${p.pct}% partagent leur ${p.planetLabel("fr")} en ${p.signLabel("fr")}`;
  const description =
    "Découvre avec combien de membres tu partages ton Soleil, ta Lune et ton Ascendant — des statistiques anonymes et agrégées sur Llmastro.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", locale: "fr_FR" },
  };
}

export default async function PlacementSharePage(
  { params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ ref?: string }>;
  },
) {
  const { slug } = await params;
  const { ref } = await searchParams;
  const p = parsePlacementSlug(slug);
  if (!p) notFound();

  const registerHref = ref ? `/auth/register?ref=${encodeURIComponent(ref)}` : "/auth/register";

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 20px",
        textAlign: "center",
      }}
    >
      {/* Carte du placement — même esthétique que la carte partageable du dashboard */}
      <div
        className="card-gold card"
        style={{
          maxWidth: 440,
          width: "100%",
          padding: 32,
          position: "relative",
          overflow: "hidden",
          border: "1px solid var(--gold)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 65%)", pointerEvents: "none",
          }}
        />
        <div style={{ fontSize: 52, color: "var(--gold)", lineHeight: 1 }} aria-hidden>
          {p.signGlyph}
        </div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1.35, color: "var(--star)", margin: "16px 0 6px" }}>
          <span style={{ color: "var(--gold)" }}>{p.pct}%</span> partagent leur {p.planetLabel("fr")} en {p.signLabel("fr")}
        </p>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
          Et toi, quelle est ta place dans le ciel collectif ?
        </p>
        <div style={{ marginTop: 18, fontSize: 11, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase" }}>
          ✦ Llmastro
        </div>
      </div>

      {/* CTA acquisition */}
      <div style={{ marginTop: 28, maxWidth: 440, width: "100%" }}>
        <Link
          href={registerHref}
          className="btn-ob"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "13px 26px", fontSize: 14.5, textDecoration: "none", width: "auto",
            letterSpacing: "0.02em",
          }}
        >
          Découvrir mon thème gratuitement ✦
        </Link>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 14, lineHeight: 1.55 }}>
          Llmastro calcule ton thème natal (Swiss Ephemeris) et te dit, avec combien de membres
          tu partages chaque placement — anonymement.
        </p>
        <Link
          href={ref ? `/?ref=${encodeURIComponent(ref)}` : "/"}
          style={{ fontSize: 12.5, color: "var(--gold)", textDecoration: "none" }}
        >
          En savoir plus →
        </Link>
      </div>
    </div>
  );
}

// COMMUNITY-SHARE-OG-V1 page applied

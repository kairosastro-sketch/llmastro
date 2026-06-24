// ============================================================
// COMMUNITY-SHARE-OG-V1 — vue partagée de la page de partage publique
// d'un placement (FR /partage/... et EN /en/partage/...).
// Server component + builder de metadata. 100 % anonyme (slug only).
// ============================================================

import Link from "next/link";
import type { Metadata } from "next";

import { parsePlacementSlug } from "@/lib/share/placement-slug";
import type { Locale } from "@/lib/i18n/translations";

export function buildPlacementMetadata(slug: string, lang: Locale): Metadata {
  const en = lang === "en";
  const p = parsePlacementSlug(slug);
  if (!p) {
    return { title: en ? "Your place in the collective sky" : "Ta place dans le ciel collectif" };
  }
  const title = en
    ? `${p.pct}% share their ${p.planetLabel("en")} in ${p.signLabel("en")}`
    : `${p.pct}% partagent leur ${p.planetLabel("fr")} en ${p.signLabel("fr")}`;
  const description = en
    ? "Discover how many members share your Sun, Moon and Ascendant — anonymous, aggregated statistics on Llmastro."
    : "Découvre avec combien de membres tu partages ton Soleil, ta Lune et ton Ascendant — des statistiques anonymes et agrégées sur Llmastro.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", locale: en ? "en_US" : "fr_FR" },
  };
}

export function PlacementShareView({ slug, lang, refCode }: { slug: string; lang: Locale; refCode?: string }) {
  const en = lang === "en";
  const p = parsePlacementSlug(slug);
  if (!p) return null; // l'appelant aura déjà fait notFound()

  const planet = p.planetLabel(lang);
  const sign = p.signLabel(lang);

  // EN partage l'arborescence /en pour cohérence d'URL ; FR garde la route nue.
  const homeBase = en ? "/en" : "/";
  const registerHref = refCode
    ? `/auth/register?ref=${encodeURIComponent(refCode)}`
    : "/auth/register";
  const homeHref = refCode ? `${homeBase}?ref=${encodeURIComponent(refCode)}` : homeBase;

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
      <div
        className="card-gold card"
        style={{
          maxWidth: 440, width: "100%", padding: 32,
          position: "relative", overflow: "hidden", border: "1px solid var(--gold)",
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
          <span style={{ color: "var(--gold)" }}>{p.pct}%</span>{" "}
          {en ? `share their ${planet} in ${sign}` : `partagent leur ${planet} en ${sign}`}
        </p>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
          {en ? "And you, what's your place in the collective sky?" : "Et toi, quelle est ta place dans le ciel collectif ?"}
        </p>
        <div style={{ marginTop: 18, fontSize: 11, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase" }}>
          ✦ Llmastro
        </div>
      </div>

      <div style={{ marginTop: 28, maxWidth: 440, width: "100%" }}>
        <Link
          href={registerHref}
          className="btn-ob"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "13px 26px", fontSize: 14.5, textDecoration: "none", width: "auto", letterSpacing: "0.02em",
          }}
        >
          {en ? "Discover my chart for free ✦" : "Découvrir mon thème gratuitement ✦"}
        </Link>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 14, lineHeight: 1.55 }}>
          {en
            ? "Llmastro computes your natal chart (Swiss Ephemeris) and tells you, anonymously, how many members share each placement."
            : "Llmastro calcule ton thème natal (Swiss Ephemeris) et te dit, avec combien de membres tu partages chaque placement — anonymement."}
        </p>
        <Link href={homeHref} style={{ fontSize: 12.5, color: "var(--gold)", textDecoration: "none" }}>
          {en ? "Learn more →" : "En savoir plus →"}
        </Link>
      </div>
    </div>
  );
}

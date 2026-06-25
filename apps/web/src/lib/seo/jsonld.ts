// SEO-JSONLD-ARTICLE-V1
// Helper pour générer le JSON-LD Article des pages éditoriales
// (/methode, /histoire, /le-ciel-et-l-ia). Auteur + éditeur = Llmastro,
// image = OG par défaut, langue fr-FR. `date` = date honnête du dernier
// changement de contenu (dérivée de git au moment de l'écriture).

const BASE = "https://llmastro.com";

export function articleJsonLd(opts: {
  headline: string;
  description: string;
  path: string;
  /** ISO date (YYYY-MM-DD) du dernier changement de contenu. */
  date: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    image: `${BASE}/opengraph-image`,
    inLanguage: "fr-FR",
    datePublished: opts.date,
    dateModified: opts.date,
    author: { "@type": "Organization", name: "Llmastro", url: BASE },
    publisher: {
      "@type": "Organization",
      name: "Llmastro",
      logo: { "@type": "ImageObject", url: `${BASE}/brand/llmastro-mark.png` },
    },
    mainEntityOfPage: `${BASE}${opts.path}`,
  };
}

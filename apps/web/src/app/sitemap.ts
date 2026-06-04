// ============================================================
// apps/web/src/app/sitemap.ts
// CIEL-PUBLIC-V1-PAGES · SEO-SITEMAP-LASTMOD-V1
// ------------------------------------------------------------
// Sitemap dynamique généré par Next.js App Router.
// Couvre les pages publiques + les 4 cadences de /ciel (FR + EN).
//
// SEO-SITEMAP-LASTMOD-V1 : `lastModified` honnête par page (date du
// dernier changement de contenu, dérivée de git à l'écriture) au lieu du
// build-time pour TOUTES les URLs — sinon Google apprend à ignorer le
// lastmod. Les pages /ciel changent réellement chaque jour (publication
// du ciel + ISR 24 h), donc `now` y est légitime. Ajout de /histoire et
// /le-ciel-et-l-ia (éditoriales indexables qui manquaient).
// ============================================================

import type { MetadataRoute } from "next";

const BASE = "https://llmastro.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const d = (iso: string) => new Date(iso);

  return [
    { url: `${BASE}/`,                  lastModified: d("2026-06-04"), changeFrequency: "weekly",  priority: 1.0 },

    // /ciel — contenu réellement quotidien → `now` justifié
    { url: `${BASE}/ciel/aujourd-hui`,    lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/ciel/semaine`,        lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/ciel/mois`,           lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/ciel/annee`,          lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/en/ciel/aujourd-hui`, lastModified: now, changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE}/en/ciel/semaine`,     lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${BASE}/en/ciel/mois`,        lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/en/ciel/annee`,       lastModified: now, changeFrequency: "monthly", priority: 0.5 },

    // Pages éditoriales / institutionnelles — lastmod = vrai dernier changement
    { url: `${BASE}/astrologie-ia`,   lastModified: d("2026-06-04"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/methode`,         lastModified: d("2026-04-30"), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/limites`,         lastModified: d("2026-05-28"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/bibliographie`,   lastModified: d("2026-04-30"), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/histoire`,        lastModified: d("2026-06-04"), changeFrequency: "yearly",  priority: 0.5 },
    { url: `${BASE}/le-ciel-et-l-ia`, lastModified: d("2026-06-04"), changeFrequency: "yearly",  priority: 0.5 },
    { url: `${BASE}/pricing`,         lastModified: d("2026-06-04"), changeFrequency: "monthly", priority: 0.7 },
  ];
}

// CIEL-PUBLIC-V1-PAGES sitemap applied
// SEO-SITEMAP-LASTMOD-V1 applied

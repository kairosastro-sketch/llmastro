// ============================================================
// SOCIAL-LINKS-V1 — source unique des profils sociaux Llmastro.
// Consommé par :
//   • le footer public (components/landing/Footer.tsx) — liens visibles
//   • le JSON-LD Organization (app/layout.tsx) — propriété `sameAs`
// Une seule liste à maintenir : ajouter/retirer un réseau ici se
// répercute partout.
// ============================================================

export type SocialNetwork = "instagram" | "tiktok" | "x" | "pinterest";

export interface SocialLink {
  network: SocialNetwork;
  /** Nom accessible (aria-label) — noms propres, identiques FR/EN. */
  label: string;
  url: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    network: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/kairosastraai/",
  },
  {
    network: "tiktok",
    label: "TikTok",
    url: "https://www.tiktok.com/@kairosastro",
  },
  {
    network: "x",
    label: "X (Twitter)",
    url: "https://x.com/LLMAstro_Kairos",
  },
  {
    network: "pinterest",
    label: "Pinterest",
    url: "https://fr.pinterest.com/kairosai/",
  },
];

/** URLs seules — pour le `sameAs` du JSON-LD Organization. */
export const SOCIAL_SAME_AS: string[] = SOCIAL_LINKS.map((l) => l.url);

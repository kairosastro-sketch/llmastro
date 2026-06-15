import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/ui/Providers";
import { SiteFooter } from "@/components/ui/SiteFooter"; // FOOTER-CENTRAL-V1
import { AppProvider } from "@/lib/i18n";
import PageViewTracker from "@/components/analytics/PageViewTracker"; // ANALYTICS-V1
import ConsentBanner from "@/components/analytics/ConsentBanner"; // ANALYTICS-V1
import RegisterSW from "@/components/pwa/RegisterSW"; // PWA-OFFLINE-V1

export const metadata: Metadata = {
  metadataBase: new URL("https://llmastro.com"),
  title: {
    default: "Llmastro — Un moteur d'astrologie dans la poche qui calcule la position des planètes",
    template: "%s · Llmastro",
  },
  description:
    "Plateforme d'astrologie en français : thème natal détaillé, horoscopes personnalisés, synastrie, tarot. Sérieuse et chaleureuse.",
  applicationName: "Llmastro",
  // PWA-MANIFEST-V1 — iOS « Ajouter à l'écran d'accueil » (mode standalone,
  // barre de statut translucide cohérente avec le thème dark).
  appleWebApp: {
    capable: true,
    title: "Llmastro",
    statusBarStyle: "black-translucent",
  },
  authors: [{ name: "Adrian Sauzade" }],
  creator: "Llmastro",
  publisher: "Llmastro",
  keywords: [
    "astrologie",
    "thème natal",
    "horoscope",
    "synastrie",
    "compatibilité amoureuse",
    "tarot",
    "kairos",
    "astrologie en français",
    "swiss ephemeris",
  ],
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // LANDING-V1 : la landing publique sur "/" est indexable.
  // Les pages /dashboard/* sont de toute façon protégées par auth.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://llmastro.com",
    siteName: "Llmastro",
    title: "Llmastro — Un moteur d'astrologie dans la poche qui calcule la position des planètes",
    description:
      "Plateforme d'astrologie en français : thème natal détaillé, horoscopes personnalisés, synastrie, tarot. Sérieuse et chaleureuse.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Llmastro",
    description:
      "Plateforme d'astrologie en français : thème natal, horoscopes, synastrie, tarot.",
  },
};

// SEO-JSONLD-ORG-V1 · GEO-ORG-ENRICH-V1 — donnée structurée Organization
// (sitewide). Aide Google (Knowledge Panel / logo) ET les moteurs génératifs
// (ChatGPT, Perplexity, AI Overviews) à reconnaître l'entité « Llmastro » :
// entité légale, date de fondation, slogan, domaines de compétence.
// `sameAs` (réseaux sociaux) volontairement omis pour l'instant.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Llmastro",
  legalName: "KAIROSAST LTD",
  url: "https://llmastro.com",
  logo: "https://llmastro.com/apple-icon",
  slogan: "Un moteur d'astrologie dans la poche qui calcule la position des planètes",
  foundingDate: "2026",
  description:
    "Plateforme d'astrologie en français : thème natal détaillé, horoscopes personnalisés, synastrie, tarot. Sérieuse et chaleureuse. Positions et transits calculés côté serveur (Swiss Ephemeris, tables JPL NASA), jamais devinés par le modèle de langage.",
  knowsAbout: [
    "Astrologie",
    "Thème natal",
    "Éphémérides astronomiques",
    "Horoscope",
    "Synastrie",
    "Tarot",
    "Astrologie psychologique",
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#14102e" },
    { media: "(prefers-color-scheme: light)", color: "#f6f3fc" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // ← DÉFAUT : dark mode (cohérent avec AppProvider + thème « Céleste »)
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          Anti-flash : on applique le thème AVANT React.
          Défaut = 'dark' si rien n'est stocké — aligné sur le défaut
          d'AppProvider (lib/i18n) pour éviter toute désynchro au boot.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('astro_theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <AppProvider>
          <Providers>
            {/* PWA-OFFLINE-V1 : enregistre le SW pour tous (installabilité + offline) */}
            <RegisterSW />
            {children}
            {/* FOOTER-CENTRAL-V1 : footer global (masqué sur dashboard/auth/admin/ciel) */}
            <SiteFooter />
            {/* ANALYTICS-V1 : mesure d'audience (gated par consentement) */}
            <PageViewTracker />
            <ConsentBanner />
          </Providers>
        </AppProvider>
      </body>
    </html>
  );
}

// PATCH-FAVICON-METADATA-V1 applied

// LANDING-V1 robots applied

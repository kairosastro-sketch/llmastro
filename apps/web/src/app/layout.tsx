import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/ui/Providers";
import { AppProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  metadataBase: new URL("https://llmastro.com"),
  title: {
    default: "Llmastro — Ton vrai thème, pas un horoscope générique",
    template: "%s · Llmastro",
  },
  description:
    "Plateforme d'astrologie en français : thème natal détaillé, horoscopes personnalisés, synastrie, tarot. Sérieuse et chaleureuse.",
  applicationName: "Llmastro",
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
    title: "Llmastro — Ton vrai thème, pas un horoscope générique",
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

// SEO-JSONLD-ORG-V1 — donnée structurée Organization (sitewide).
// Aide Google à constituer le Knowledge Panel / logo de marque.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Llmastro",
  url: "https://llmastro.com",
  logo: "https://llmastro.com/apple-icon",
  description:
    "Plateforme d'astrologie en français : thème natal détaillé, horoscopes personnalisés, synastrie, tarot. Sérieuse et chaleureuse.",
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
            {children}
          </Providers>
        </AppProvider>
      </body>
    </html>
  );
}

// PATCH-FAVICON-METADATA-V1 applied

// LANDING-V1 robots applied

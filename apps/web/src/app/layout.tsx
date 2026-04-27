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
    card: "summary",
    title: "Llmastro",
    description:
      "Plateforme d'astrologie en français : thème natal, horoscopes, synastrie, tarot.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#07050f" },
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // ← DÉFAUT : light mode
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <head>
        {/*
          Anti-flash : on applique le thème AVANT React.
          Défaut = 'light' si rien n'est stocké.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('astro_theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
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

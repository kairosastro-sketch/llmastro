/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone",

  serverExternalPackages: ["swisseph"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  // SECURITY-HEADERS-DEDUPE-V1
  // Les en-têtes de sécurité sont émis UNE seule fois, au bord, par Caddy
  // (cf. caddy/Caddyfile). Auparavant Next ET Caddy les posaient tous deux,
  // ce qui produisait des doublons et un X-Frame-Options contradictoire
  // (DENY vs SAMEORIGIN). Source de vérité unique = Caddyfile.
};

export default nextConfig;

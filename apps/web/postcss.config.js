// ============================================================
// ARCHIVE-POSTCSS-CONFIG-FIX-V1 — postcss.config.js
// ------------------------------------------------------------
// Fichier de configuration PostCSS pour Next.js.
// Sans ce fichier, Next ignore le pipeline PostCSS → les
// directives @tailwind base/components/utilities dans
// globals.css ne sont pas traitées → aucune classe Tailwind
// n'est compilée dans la build.
//
// Ce fichier réactive Tailwind sur l'ensemble du projet.
// ============================================================

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

// ARCHIVE-POSTCSS-CONFIG-FIX-V1 applied

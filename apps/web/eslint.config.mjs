import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "out/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react/jsx-key": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      // react-hooks v7 ships new strict rules. Downgraded to warn to keep
      // the Next 16 / React 19 upgrade scoped — see hygiene follow-ups.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default config;

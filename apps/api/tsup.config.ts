import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  splitting: false,
  external: ["swisseph"],
  noExternal: [
    "@astro-platform/types",
    "@astro-platform/ephemeris",
  ],
  bundle: true,
});

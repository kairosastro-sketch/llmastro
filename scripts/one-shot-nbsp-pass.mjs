// COSMETIC-PASS-V1 — script one-shot : typographie française.
// Insère une espace insécable (U+00A0) avant : ; ! ? » et après «
// dans les littéraux de chaînes (double quotes) des fichiers de
// contenu user-facing. Ne touche pas au code hors chaînes (ternaires,
// etc.). Idempotent : une insécable déjà présente n'est pas doublée.
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "apps/web/src/lib/i18n/translations.ts",
  "apps/web/src/components/pricing/faq-data.ts",
  "apps/web/src/components/pricing/featureGroups.ts",
  "apps/web/src/lib/astro/glossary.ts",
  "apps/web/src/lib/astro/aspect-help.ts",
  "apps/web/src/lib/tiers/feature-labels.ts",
];

const NBSP = " ";
let total = 0;

for (const file of FILES) {
  const src = readFileSync(file, "utf8");
  let count = 0;
  // Remplace uniquement à l'intérieur des littéraux "..." (gère \").
  const out = src.replace(/"(?:[^"\\]|\\.)*"/g, (lit) => {
    const fixed = lit
      .replace(/(\S) ([:;!?»])/g, (_, a, b) => { count++; return a + NBSP + b; })
      .replace(/« (\S)/g, (_, a) => { count++; return "«" + NBSP + a; });
    return fixed;
  });
  if (count > 0) writeFileSync(file, out, "utf8");
  console.log(`${file}: ${count} insertion(s)`);
  total += count;
}
console.log(`total: ${total}`);

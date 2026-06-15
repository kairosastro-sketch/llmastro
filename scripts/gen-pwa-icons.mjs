// PWA-MANIFEST-V1 — Génère les icônes PNG du manifest depuis le ✦ doré.
// Couleurs alignées sur le thème « Céleste » dark (icon.tsx) : bg #14102e, ✦ #e6cb8e.
// Lancer : node scripts/gen-pwa-icons.mjs   (sharp est déjà dans node_modules)
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// sharp n'est pas hoisté au top-level (pnpm) → import depuis le store (URL file://).
const { default: sharp } = await import(
  pathToFileURL(
    join(ROOT, "node_modules", ".pnpm", "sharp@0.34.5", "node_modules", "sharp", "lib", "index.js"),
  ).href
);

const OUT = join(ROOT, "apps", "web", "public");
const BG = "#14102e";
const GOLD = "#e6cb8e";

// ✦ = étoile à 4 branches. On la dessine en <path> (pas de police → rendu
// déterministe quel que soit le backend SVG de sharp).
function starPath(cx, cy, R, r) {
  const pts = [];
  // 8 sommets : alternance externe (R) / interne (r), en partant du haut.
  for (let i = 0; i < 8; i++) {
    const ang = (-90 + i * 45) * (Math.PI / 180);
    const rad = i % 2 === 0 ? R : r;
    pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
  }
  return "M" + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L") + "Z";
}

function svg(size, ratio) {
  const c = size / 2;
  const R = size * ratio;       // rayon externe (branche longue)
  const r = R * 0.34;           // rayon interne (creux) → look « sparkle »
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <path d="${starPath(c, c, R, r)}" fill="${GOLD}"/>
</svg>`;
}

const jobs = [
  // "any" : l'étoile remplit largement (ratio 0.42).
  ["icon-192.png", 192, 0.42],
  ["icon-512.png", 512, 0.42],
  // "maskable" : safe-zone Android → étoile plus petite, plein cadre coloré (ratio 0.30).
  ["icon-512-maskable.png", 512, 0.30],
];

for (const [name, size, ratio] of jobs) {
  await sharp(Buffer.from(svg(size, ratio))).png().toFile(join(OUT, name));
  console.log("✓", name);
}
console.log("Done →", OUT);

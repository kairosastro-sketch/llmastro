// COMMUNITY-V1 — helpers zodiacaux.
// Le moteur d'éphémérides expose les positions via `signIdx` (0 = Bélier … 11 = Poissons)
// mais aucun mapping signe → élément/modalité n'existait dans le codebase. On le pose ici,
// dérivé des cycles canoniques (élément = cycle de 4, modalité = cycle de 3).

export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "cardinal" | "fixed" | "mutable";

export const SIGN_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

const ELEMENTS: Element[] = ["fire", "earth", "air", "water"];
const MODALITIES: Modality[] = ["cardinal", "fixed", "mutable"];

// Modulo positif (gère les index négatifs éventuels).
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Index 0-11 → nom anglais du signe ("Aries" … "Pisces"). */
export function signName(signIdx: number): string {
  return SIGN_NAMES[mod(Math.floor(signIdx), 12)]!;
}

/** Élément du signe : Bélier=feu, Taureau=terre, Gémeaux=air, Cancer=eau, puis cycle. */
export function signElement(signIdx: number): Element {
  return ELEMENTS[mod(Math.floor(signIdx), 4)]!;
}

/** Modalité du signe : Bélier=cardinal, Taureau=fixe, Gémeaux=mutable, puis cycle. */
export function signModality(signIdx: number): Modality {
  return MODALITIES[mod(Math.floor(signIdx), 3)]!;
}

/** Longitude écliptique (0-360) → index de signe (0-11). */
export function longitudeToSignIdx(longitude: number): number {
  return Math.floor(mod(longitude, 360) / 30);
}

/** Longitude écliptique (0-360) → degré dans le signe (0-29). */
export function longitudeToSignDegree(longitude: number): number {
  return Math.floor(mod(longitude, 360) % 30);
}

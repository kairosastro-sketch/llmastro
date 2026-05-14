// ============================================================
// apps/web/src/lib/date-relative.ts
// ------------------------------------------------------------
// HOROSCOPE-GENERATED-AT-V1 : format d'horodatage relatif court
// pour afficher "Généré aujourd'hui à 09:23 (UTC+2)" sur la
// page horoscope. Utilise les API Intl natives — pas de
// dépendance ajoutée.
// ============================================================

type Locale = "fr" | "en";

/**
 * Formatte un ISO 8601 en libellé relatif + heure + offset UTC du
 * navigateur de l'utilisateur. Sortie typique :
 *   • "aujourd'hui à 09:23 (UTC+2)"   (locale fr)
 *   • "today at 9:23 AM (UTC+2)"      (locale en)
 *   • "hier à 22:14 (UTC+2)"
 *   • "il y a 3 jours à 14:00 (UTC+2)"
 *
 * Renvoie chaîne vide si l'ISO est invalide — caller décide d'afficher
 * ou non.
 */
export function formatRelativeDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  // Diff en jours calendaires locaux (pas en heures), pour que "23h hier"
  // → "hier" et pas "il y a 0 jour".
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const that  = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((today - that) / dayMs);

  const time = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: locale === "en",
  }).format(date);

  // Récupère l'offset UTC court (ex: "UTC+2", "UTC-5", "GMT+5:30").
  // shortOffset est supporté par tous les navigateurs ES2022.
  const tzPart = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    timeZoneName: "shortOffset",
  }).formatToParts(date).find(p => p.type === "timeZoneName")?.value ?? "";

  const tzSuffix = tzPart ? ` (${tzPart})` : "";

  // Libellé relatif. On reste sur 4 buckets pour limiter les pluriels
  // exotiques (Intl.RelativeTimeFormat marche aussi, mais 3 lignes
  // ici suffisent pour notre cas).
  let relative: string;
  if (dayDiff === 0) {
    relative = locale === "fr" ? `aujourd'hui à ${time}` : `today at ${time}`;
  } else if (dayDiff === 1) {
    relative = locale === "fr" ? `hier à ${time}` : `yesterday at ${time}`;
  } else if (dayDiff > 1 && dayDiff < 7) {
    relative = locale === "fr"
      ? `il y a ${dayDiff} jours à ${time}`
      : `${dayDiff} days ago at ${time}`;
  } else {
    // > 7 jours : on tombe sur une date complète.
    const dateStr = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric", month: "long", year: "numeric",
    }).format(date);
    relative = locale === "fr" ? `le ${dateStr} à ${time}` : `on ${dateStr} at ${time}`;
  }

  return `${relative}${tzSuffix}`;
}

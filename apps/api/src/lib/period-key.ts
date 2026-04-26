// ARCHIVE-3-TIERS-V1
// Helpers de résolution de "period key" en tz user.
// Utilisés par les compteurs de quota (reset à minuit locale).

/**
 * Renvoie la period key "YYYY-MM-DD" dans la tz donnée.
 *
 * Utilise l'API Intl native pour éviter une dep date-fns-tz supplémentaire.
 * Fallback UTC si tz invalide.
 */
export function dailyPeriodKey(tz: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year:     "numeric",
      month:    "2-digit",
      day:      "2-digit",
    }).formatToParts(now);

    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;

    if (!y || !m || !d) throw new Error("invalid parts");
    return `${y}-${m}-${d}`;
  } catch {
    // fallback UTC
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Renvoie la period key "YYYY-MM" dans la tz donnée.
 */
export function monthlyPeriodKey(tz: string, now: Date = new Date()): string {
  const daily = dailyPeriodKey(tz, now);
  return daily.slice(0, 7);
}

/**
 * Résout la period key selon le type de période.
 */
export function resolvePeriodKey(
  period: "day" | "month",
  tz: string,
  now: Date = new Date()
): string {
  return period === "day" ? dailyPeriodKey(tz, now) : monthlyPeriodKey(tz, now);
}

/**
 * Instant du prochain reset (minuit locale suivante pour day, 1er du mois suivant pour month)
 * renvoyé en ISO UTC. Utile pour afficher "reset dans Xh" côté UI.
 */
export function nextResetAt(
  period: "day" | "month",
  tz: string,
  now: Date = new Date()
): string {
  try {
    // Décale la date de +1 période, puis calcule le début local de cette période.
    const addDays = period === "day" ? 1 : 31;
    const bumped  = new Date(now.getTime() + addDays * 24 * 60 * 60 * 1000);

    const key = period === "day"
      ? dailyPeriodKey(tz, bumped)
      : monthlyPeriodKey(tz, bumped) + "-01";

    // Construit la string "YYYY-MM-DDT00:00:00" interprétée dans la tz.
    // Astuce : on utilise Intl pour trouver l'offset de cette tz à ce moment.
    const localMidnightIso = `${key}T00:00:00`;
    const tzOffsetMinutes = getTzOffsetMinutes(tz, new Date(localMidnightIso + "Z"));

    // Reconstruit l'instant UTC correspondant à minuit locale dans la tz.
    const utcMs = Date.parse(localMidnightIso + "Z") - tzOffsetMinutes * 60_000;
    return new Date(utcMs).toISOString();
  } catch {
    // fallback : +24h / +30j UTC
    const fallbackMs = period === "day"
      ? now.getTime() + 24 * 60 * 60 * 1000
      : now.getTime() + 30 * 24 * 60 * 60 * 1000;
    return new Date(fallbackMs).toISOString();
  }
}

/**
 * Offset en minutes de `tz` au moment `date` (positif pour tz à l'est d'UTC).
 * Ex: Europe/Paris en été → 120
 */
function getTzOffsetMinutes(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
    hour:     "2-digit",
    minute:   "2-digit",
    second:   "2-digit",
    hour12:   false,
  });
  const parts = dtf.formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const mi = Number(parts.find((p) => p.type === "minute")?.value);
  const s = Number(parts.find((p) => p.type === "second")?.value);

  const asUtc = Date.UTC(y, m - 1, d, h, mi, s);
  return (asUtc - date.getTime()) / 60_000;
}

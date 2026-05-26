// ============================================================
// apps/api/src/services/user-preferences.service.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// Lecture / écriture du JSONB `users.preferences` avec merge
// systématique des valeurs par défaut (DEFAULT_USER_PREFERENCES).
//
// L'absence d'un champ côté DB doit toujours retourner la valeur
// par défaut côté API (jamais d'undefined dans la réponse front).
// L'écriture est un PATCH partiel : on merge le body avec l'existant
// et on persiste le résultat.
// ============================================================

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from "../types/notification-payload.js";

// ──────────────────────────────────────────────────────────
// Type de retour : version "résolue" sans optional
// ──────────────────────────────────────────────────────────

export type ResolvedUserPreferences = {
  notify_events: {
    eclipses:  boolean;
    lunations: boolean;
    stations:  boolean;
    ingresses: boolean;
  };
  notify_threshold:        "low" | "medium" | "high";
  notify_email_frequency:  "never" | "weekly" | "instant";
  notify_email_critical:   boolean;
  notify_daily_horoscope:  boolean;
  notify_push:             boolean;
  locale:                  "fr" | "en";
};

// ──────────────────────────────────────────────────────────
// Helpers de merge
// ──────────────────────────────────────────────────────────

function resolveWithDefaults(raw: UserPreferences | null | undefined): ResolvedUserPreferences {
  const r = raw ?? {};
  return {
    notify_events: {
      eclipses:  r.notify_events?.eclipses  ?? DEFAULT_USER_PREFERENCES.notify_events.eclipses,
      lunations: r.notify_events?.lunations ?? DEFAULT_USER_PREFERENCES.notify_events.lunations,
      stations:  r.notify_events?.stations  ?? DEFAULT_USER_PREFERENCES.notify_events.stations,
      ingresses: r.notify_events?.ingresses ?? DEFAULT_USER_PREFERENCES.notify_events.ingresses,
    },
    notify_threshold:        r.notify_threshold        ?? DEFAULT_USER_PREFERENCES.notify_threshold!,
    notify_email_frequency:  r.notify_email_frequency  ?? DEFAULT_USER_PREFERENCES.notify_email_frequency!,
    notify_email_critical:   r.notify_email_critical   ?? DEFAULT_USER_PREFERENCES.notify_email_critical!,
    notify_daily_horoscope:  r.notify_daily_horoscope  ?? DEFAULT_USER_PREFERENCES.notify_daily_horoscope!,
    notify_push:             r.notify_push             ?? DEFAULT_USER_PREFERENCES.notify_push!,
    locale:                  r.locale                  ?? DEFAULT_USER_PREFERENCES.locale!,
  };
}

/**
 * Merge un PATCH partiel dans des prefs existantes.
 * - Pour `notify_events` (sub-object), merge champ par champ.
 * - Pour les scalaires, le patch écrase la valeur si présent.
 * Le résultat est un sous-ensemble de UserPreferences (peut omettre des champs
 * non renseignés explicitement) — ensuite passé à `resolveWithDefaults` au read.
 */
function mergePatch(existing: UserPreferences, patch: UserPreferences): UserPreferences {
  return {
    ...existing,
    ...patch,
    notify_events: {
      ...(existing.notify_events ?? {}),
      ...(patch.notify_events ?? {}),
    },
  };
}

// ──────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────

class UserPreferencesService {
  /**
   * Lit les préférences d'un user, avec valeurs par défaut appliquées
   * pour tout champ absent. Retourne toujours un objet complet.
   */
  async get(userId: string): Promise<ResolvedUserPreferences> {
    const [row] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return resolveWithDefaults(row?.preferences as UserPreferences | undefined);
  }

  /**
   * PATCH partiel : merge le body avec les prefs existantes et persiste.
   * Renvoie la version résolue (avec defaults appliqués) post-merge.
   */
  async update(userId: string, patch: UserPreferences): Promise<ResolvedUserPreferences> {
    const [row] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const existing = (row?.preferences ?? {}) as UserPreferences;
    const merged   = mergePatch(existing, patch);

    await db
      .update(users)
      .set({ preferences: merged as object, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return resolveWithDefaults(merged);
  }
}

export const userPreferencesService = new UserPreferencesService();

// Expose le helper pour être réutilisable depuis le dispatcher (PR #D2),
// qui charge directement les rows users sans repasser par get() pour
// éviter N+1 queries.
export { resolveWithDefaults };

// NOTIFICATIONS-V1 user-preferences applied

// ============================================================
// apps/api/src/services/notifications.service.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// CRUD service pour la table `notifications`.
//   - listForUser(userId, opts)  : liste plate (cap NOTIFICATIONS_CAP_PER_USER
//                                   au moment du dispatch, donc pas de pagination)
//   - markAsRead(id, userId)     : passe read_at = NOW()
//   - countUnread(userId)        : count non-lues (pour badge)
//   - insertSkyEventIfNew(...)   : INSERT idempotent via dedup_key
//
// Pas de notion de "kind" ailleurs que dans les types : un appelant
// peut créer ce qu'il veut tant qu'il fournit kind, data, dedup_key.
// ============================================================

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { notifications, type NotificationRow } from "../db/schema.js";
import type {
  NotificationData,
  SkyEventNotificationData,
} from "../types/notification-payload.js";

// Cap dur : on ne garde que les N notifs les plus récentes par user.
// Au-delà, les anciennes sont supprimées au moment du dispatch (cf. insertIfNew).
const NOTIFICATIONS_CAP_PER_USER = 10;

// ──────────────────────────────────────────────────────────
// Listing (cap dur côté insert → pas de pagination)
// ──────────────────────────────────────────────────────────

export interface ListNotificationsOpts {
  /** Plafond items renvoyés. Défaut 20, max 100. Le backend ne stocke
   *  jamais plus de NOTIFICATIONS_CAP_PER_USER notifs/user, donc en
   *  pratique limit > cap est équivalent à "toutes". */
  limit?: number;
}

export interface ListNotificationsResult {
  items: NotificationRow[];
  /** Total non-lues — pour le badge UI. */
  unreadCount: number;
}

class NotificationsService {
  async listForUser(
    userId: string,
    opts: ListNotificationsOpts = {},
  ): Promise<ListNotificationsResult> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);

    const items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const unreadCount = await this.countUnread(userId);

    return { items, unreadCount };
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.c ?? 0;
  }

  /**
   * Marque une notif comme lue. No-op si déjà lue.
   * Renvoie la notif mise à jour, ou null si elle n'existe pas / n'appartient pas à cet user.
   */
  async markAsRead(id: string, userId: string): Promise<NotificationRow | null> {
    const [row] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ))
      .returning();

    if (row) return row;

    // Soit déjà lue, soit pas la bonne user → on relit pour distinguer.
    const [existing] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .limit(1);
    return existing ?? null;
  }

  /**
   * Marque toutes les notifications non lues d'un user comme lues.
   * Renvoie le nombre de rows mises à jour (peut être 0 si tout
   * était déjà lu). Pas d'erreur dans ce cas.
   */
  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const rows = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ))
      .returning({ id: notifications.id });

    return { updated: rows.length };
  }

  /**
   * Hard delete de toutes les notifs d'un user.
   *
   * Bouton "Effacer tout" dans le drawer. Hard delete plutôt que soft :
   *   - cap=10 → on n'archive pas un historique long de toute façon
   *   - dispatcher idempotent via dedup_key journalier → re-insert au
   *     prochain run si l'event est toujours dans la fenêtre 7j
   *   - simplicité : pas de colonne deleted_at à filtrer partout
   *
   * Renvoie { deleted: number }, peut être 0 (no-op si déjà vide).
   */
  async deleteAllForUser(userId: string): Promise<{ deleted: number }> {
    const rows = await db
      .delete(notifications)
      .where(eq(notifications.userId, userId))
      .returning({ id: notifications.id });

    return { deleted: rows.length };
  }

  // ──────────────────────────────────────────────────────────
  // INSERT idempotent (utilisé par le dispatcher PR #D2)
  // ──────────────────────────────────────────────────────────

  /**
   * Insère une notif. Si la dedup_key existe déjà pour cet user,
   * NO-OP (pas d'erreur). Renvoie true si insérée, false sinon.
   *
   * Utilisé par le dispatcher : ré-exécuter le scheduler ne doit
   * pas créer de doublons (UNIQUE INDEX sur (user_id, dedup_key)).
   */
  async insertIfNew(input: {
    userId:    string;
    kind:      "sky_event" | "system" | "horoscope_daily";
    data:      NotificationData;
    dedupKey:  string;
  }): Promise<boolean> {
    const result = await db
      .insert(notifications)
      .values({
        userId:   input.userId,
        kind:     input.kind,
        data:     input.data as object,
        dedupKey: input.dedupKey,
      })
      .onConflictDoNothing({ target: [notifications.userId, notifications.dedupKey] })
      .returning({ id: notifications.id });

    const inserted = result.length > 0;

    // Purge : on ne garde que les NOTIFICATIONS_CAP_PER_USER plus récentes.
    // Tie-breaker `id DESC` pour rendre le LIMIT déterministe quand created_at
    // est identique (insertions concurrentes en mode batch dispatcher).
    if (inserted) {
      await db.execute(sql`
        DELETE FROM notifications
        WHERE user_id = ${input.userId}
          AND id NOT IN (
            SELECT id FROM notifications
            WHERE user_id = ${input.userId}
            ORDER BY created_at DESC, id DESC
            LIMIT ${NOTIFICATIONS_CAP_PER_USER}
          )
      `);
    }

    return inserted;
  }

  /** Sucre pour les notifs sky_event spécifiquement (PR #D2). */
  async insertSkyEventIfNew(input: {
    userId:    string;
    data:      SkyEventNotificationData;
    dedupKey:  string;
  }): Promise<boolean> {
    return this.insertIfNew({
      userId:   input.userId,
      kind:     "sky_event",
      data:     input.data,
      dedupKey: input.dedupKey,
    });
  }
}

export const notificationsService = new NotificationsService();

// NOTIFICATIONS-V1 service applied

// ============================================================
// apps/api/src/services/notifications.service.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// CRUD service pour la table `notifications`.
//   - listForUser(userId, opts)  : liste paginée (cursor sur created_at)
//   - markAsRead(id, userId)     : passe read_at = NOW()
//   - countUnread(userId)        : count non-lues (pour badge)
//   - insertSkyEventIfNew(...)   : INSERT idempotent via dedup_key
//
// Pas de notion de "kind" ailleurs que dans les types : un appelant
// peut créer ce qu'il veut tant qu'il fournit kind, data, dedup_key.
// ============================================================

import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { notifications, type NotificationRow } from "../db/schema.js";
import type {
  NotificationData,
  SkyEventNotificationData,
} from "../types/notification-payload.js";

// ──────────────────────────────────────────────────────────
// Listing avec pagination cursor
// ──────────────────────────────────────────────────────────

export interface ListNotificationsOpts {
  /** Plafond items renvoyés. Défaut 20, max 100. */
  limit?: number;
  /** Cursor sur `created_at` ISO. La page renvoie les notifs créées AVANT ce timestamp. */
  cursor?: string | null;
}

export interface ListNotificationsResult {
  items: NotificationRow[];
  /** Cursor à passer pour la page suivante (= created_at du dernier item).
   *  null si on est sur la dernière page. */
  nextCursor: string | null;
  /** Total non-lues (toutes pages confondues) — pour le badge UI. */
  unreadCount: number;
}

class NotificationsService {
  async listForUser(
    userId: string,
    opts: ListNotificationsOpts = {},
  ): Promise<ListNotificationsResult> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);

    // Conditions : appartient au user + (si cursor) created_at strictement < cursor
    const conditions = opts.cursor
      ? and(eq(notifications.userId, userId), lt(notifications.createdAt, new Date(opts.cursor)))
      : eq(notifications.userId, userId);

    // +1 pour savoir s'il y a une page suivante sans second roundtrip
    const rows = await db
      .select()
      .from(notifications)
      .where(conditions)
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1);

    const hasMore   = rows.length > limit;
    const items     = hasMore ? rows.slice(0, limit) : rows;
    const lastItem  = items[items.length - 1];
    const nextCursor = hasMore && lastItem
      ? lastItem.createdAt.toISOString()
      : null;

    const unreadCount = await this.countUnread(userId);

    return { items, nextCursor, unreadCount };
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
    kind:      "sky_event" | "system";
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

    return result.length > 0;
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

// ============================================================
// apps/web/src/hooks/useNotifications.ts
// NOTIFICATIONS-V1-UI
// ------------------------------------------------------------
// Hooks React Query pour le centre de notifications.
//
//   useNotificationsList()      — liste + unreadCount, refetch
//                                 toutes les 60s + refocus.
//   useMarkNotificationRead()   — mutation avec optimistic update
//                                 (la notif passe en "lue" dans le
//                                 cache avant la réponse réseau).
//
// Le query key est partagé pour que la mutation invalide
// correctement la liste après PATCH.
// ============================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  notificationsApi,
  type NotificationsListResponse,
  type ResolvedUserPreferences,
  type UserPreferences,
} from "@/lib/api/notifications";

export const NOTIFICATIONS_QUERY_KEY  = ["notifications"]              as const;
export const NOTIFICATIONS_PREFS_KEY  = ["notifications", "prefs"]     as const;

const POLL_INTERVAL_MS = 60_000;

export function useNotificationsList() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async (): Promise<NotificationsListResponse> => {
      const res = await notificationsApi.list(accessToken!, { limit: 20 });
      // apiClient renvoie ApiResponse<T> avec { success: true, data }
      // — on a déjà filtré les erreurs dans apiClient.request().
      return (res as { success: true; data: NotificationsListResponse }).data;
    },
    enabled:              !!accessToken,
    refetchInterval:      POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime:            30_000,
  });
}

export function useMarkNotificationRead() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(accessToken!, id),

    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = qc.getQueryData<NotificationsListResponse>(
        NOTIFICATIONS_QUERY_KEY,
      );
      if (previous) {
        const nowIso = new Date().toISOString();
        const nextItems = previous.items.map((n) =>
          n.id === id && !n.readAt ? { ...n, readAt: nowIso } : n,
        );
        qc.setQueryData<NotificationsListResponse>(NOTIFICATIONS_QUERY_KEY, {
          ...previous,
          items:       nextItems,
          unreadCount: nextItems.filter((n) => !n.readAt).length,
        });
      }
      return { previous };
    },

    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

// ──────────────────────────────────────────────────────────
// Phase 1F : mark-all-read + preferences (read + write)
// ──────────────────────────────────────────────────────────

export function useMarkAllNotificationsRead() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(accessToken!),

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = qc.getQueryData<NotificationsListResponse>(
        NOTIFICATIONS_QUERY_KEY,
      );
      if (previous) {
        const nowIso = new Date().toISOString();
        const nextItems = previous.items.map((n) =>
          n.readAt ? n : { ...n, readAt: nowIso },
        );
        qc.setQueryData<NotificationsListResponse>(NOTIFICATIONS_QUERY_KEY, {
          ...previous,
          items:       nextItems,
          unreadCount: 0,
        });
      }
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

/**
 * Hard-delete de toutes les notifs du user via DELETE /notifications/all.
 *
 * Optimistic update : on vide la liste avant la réponse réseau pour un
 * feedback instantané. Rollback sur erreur via context.previous.
 *
 * Pas de prompt de confirmation ici — c'est la responsabilité du caller
 * (NotificationsPanel utilise window.confirm). Le hook lui-même est
 * "fire and trust" : si on l'appelle, on supprime.
 */
export function useClearAllNotifications() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.clearAll(accessToken!),

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = qc.getQueryData<NotificationsListResponse>(
        NOTIFICATIONS_QUERY_KEY,
      );
      qc.setQueryData<NotificationsListResponse>(NOTIFICATIONS_QUERY_KEY, {
        items:       [],
        unreadCount: 0,
      });
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

export function useNotificationPreferences() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: NOTIFICATIONS_PREFS_KEY,
    queryFn: async (): Promise<ResolvedUserPreferences> => {
      const res = await notificationsApi.getPrefs(accessToken!);
      return (res as { success: true; data: { preferences: ResolvedUserPreferences } })
        .data.preferences;
    },
    enabled:   !!accessToken,
    staleTime: 5 * 60_000, // 5 min — les prefs changent rarement
  });
}

export function useUpdateNotificationPreferences() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (patch: UserPreferences) =>
      notificationsApi.updatePrefs(accessToken!, patch),

    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_PREFS_KEY });
      const previous = qc.getQueryData<ResolvedUserPreferences>(NOTIFICATIONS_PREFS_KEY);
      if (previous) {
        // Merge superficiel + merge profond pour notify_events.
        const next: ResolvedUserPreferences = {
          ...previous,
          ...patch,
          notify_events: {
            ...previous.notify_events,
            ...(patch.notify_events ?? {}),
          },
        };
        qc.setQueryData<ResolvedUserPreferences>(NOTIFICATIONS_PREFS_KEY, next);
      }
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(NOTIFICATIONS_PREFS_KEY, context.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_PREFS_KEY });
    },
  });
}

// NOTIFICATIONS-V1-UI hooks applied
// PHASE-1F hooks applied

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
} from "@/lib/api/notifications";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

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

// NOTIFICATIONS-V1-UI hooks applied

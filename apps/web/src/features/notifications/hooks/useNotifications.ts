import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { NotificationItem } from '@bract/shared';
import type { PaginationMeta } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { notificationsApi } from '../api/notifications.api';

interface UseNotificationsParams {
  page?: number;
  perPage?: number;
  unread?: string;
}

export function useNotifications(params: UseNotificationsParams = {}): {
  notifications: NotificationItem[];
  unreadCount: number;
  meta: PaginationMeta | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: queryKeys.notifications.list(params as Record<string, unknown>),
    queryFn: () => notificationsApi.list(params),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

  return {
    notifications: query.data?.data.items ?? [],
    unreadCount: query.data?.data.unreadCount ?? 0,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

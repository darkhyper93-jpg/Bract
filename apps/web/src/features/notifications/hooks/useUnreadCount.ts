import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { notificationsApi } from '../api/notifications.api';

export function useUnreadCount(): { count: number; isLoading: boolean } {
  const query = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const res = await notificationsApi.list({ page: 1, perPage: 1 });
      return res.data.unreadCount;
    },
    staleTime: 0,
    refetchInterval: 30_000,
  });

  return {
    count: query.data ?? 0,
    isLoading: query.isLoading,
  };
}

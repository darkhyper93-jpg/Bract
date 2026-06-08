import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { notificationsApi } from '../api/notifications.api';

export function useNotificationActions() {
  const queryClient = useQueryClient();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
  }

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidateAll,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidateAll,
  });

  const remove = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: invalidateAll,
  });

  return { markRead, markAllRead, remove };
}

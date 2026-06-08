import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserStatus } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { usersApi } from '../api/users.api';

export function useChangeUserStatus(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: UserStatus) => usersApi.changeUserStatus(userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
    },
  });
}

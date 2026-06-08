import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Role } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { usersApi } from '../api/users.api';

export function useChangeUserRole(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (role: Role) => usersApi.changeUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
    },
  });
}

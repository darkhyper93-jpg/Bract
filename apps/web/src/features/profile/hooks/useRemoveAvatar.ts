import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/authStore';
import { queryKeys } from '../../../lib/queryKeys';
import { profileApi } from '../api/profile.api';

export function useRemoveAvatar() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => profileApi.removeAvatar(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      useAuthStore.getState().setUser(data);
    },
  });

  return { mutate: mutation.mutate, isPending: mutation.isPending };
}

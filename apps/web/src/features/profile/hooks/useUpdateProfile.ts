import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UpdateProfileDto } from '@bract/shared';
import { useAuthStore } from '../../../stores/authStore';
import { queryKeys } from '../../../lib/queryKeys';
import { profileApi } from '../api/profile.api';

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (dto: UpdateProfileDto) => profileApi.updateProfile(dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      useAuthStore.getState().setUser(data);
    },
  });

  return { mutate: mutation.mutate, isPending: mutation.isPending };
}

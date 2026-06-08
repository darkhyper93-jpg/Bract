import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../api/profile.api';

export function useChangePassword() {
  const mutation = useMutation({
    mutationFn: (dto: { currentPassword: string; newPassword: string }) =>
      profileApi.changePassword(dto),
  });

  return { mutate: mutation.mutate, isPending: mutation.isPending };
}

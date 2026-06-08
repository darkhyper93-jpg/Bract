import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: { email: string }) => authApi.forgotPassword(body),
  });
}

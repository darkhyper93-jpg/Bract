import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { RegisterInput } from '@bract/shared';

export function useRegister() {
  return useMutation({
    mutationFn: (body: RegisterInput) => authApi.register(body),
    // DECISIÓN: no llamamos setAuthData aquí — el usuario debe verificar su email
    // antes de autenticarse; si lo hiciéramos, PublicRoute redirige a /dashboard
    // inmediatamente y no puede ver VerifyEmailNotice.
  });
}

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { ResetPasswordInput } from '@bract/shared';

export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: ResetPasswordInput) => authApi.resetPassword(body),
    onSuccess: () => {
      navigate('/login', { state: { passwordReset: true } });
    },
  });
}

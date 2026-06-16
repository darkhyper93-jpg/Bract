import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { authApi } from '../api/auth.api';
import { LoginInput } from '@bract/shared';

export function useLogin() {
  const navigate = useNavigate();
  const { setAuthData } = useAuthStore();

  return useMutation({
    mutationFn: (body: LoginInput) => authApi.login(body),
    onSuccess: ({ user, accessToken }) => {
      setAuthData(user, accessToken);
      navigate('/home');
    },
  });
}

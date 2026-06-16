import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { authApi } from '../api/auth.api';
import { RegisterInput } from '@bract/shared';

// El registro loguea DIRECTO a la app: el backend ya devuelve el par de tokens, así que seteamos
// la sesión y navegamos al Home (espejo de useLogin). Sin pantalla de "verificá tu correo".
export function useRegister() {
  const navigate = useNavigate();
  const { setAuthData } = useAuthStore();

  return useMutation({
    mutationFn: (body: RegisterInput) => authApi.register(body),
    onSuccess: ({ user, accessToken }) => {
      setAuthData(user, accessToken);
      navigate('/home');
    },
  });
}

import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Role } from '@bract/shared';

interface RoleRouteProps {
  role: Role;
  // Destino cuando falta permiso. Default /403; /dashboard lo pasa como /home para un
  // redirect suave (era el landing de todos hasta §8.10), no una pantalla de error.
  redirectTo?: string;
}

export function RoleRoute({ role, redirectTo = '/403' }: RoleRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const hasPermission = () => {
    if (!user) return false;
    if (user.role === Role.SUPER_ADMIN) return true;
    if (role === Role.SUPER_ADMIN) return false;
    if (role === Role.ADMIN) return user.role === Role.ADMIN;
    return true;
  };

  if (!hasPermission()) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

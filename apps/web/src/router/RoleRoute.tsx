import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Role } from '@bract/shared';

interface RoleRouteProps {
  role: Role;
}

export function RoleRoute({ role }: RoleRouteProps) {
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
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}

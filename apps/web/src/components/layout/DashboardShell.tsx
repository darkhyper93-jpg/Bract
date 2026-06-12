import { Navigate, Outlet, useMatches } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Skeleton } from '../ui/Skeleton';
import { Sidebar } from './Sidebar';
import { Header, BreadcrumbItem } from './Header';

interface RouteCrumbHandle {
  labelKey?: string;
  label?: string;
  href?: string;
}

interface RouteHandle {
  titleKey?: string;
  breadcrumb?: RouteCrumbHandle[];
}

export function DashboardShell() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { sidebarOpen } = useUIStore();
  const matches = useMatches();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const currentMatch = matches[matches.length - 1];
  const handle = currentMatch?.handle as RouteHandle | undefined;
  const title = handle?.titleKey ? t(handle.titleKey) : undefined;
  const breadcrumb: BreadcrumbItem[] | undefined = handle?.breadcrumb?.map((crumb) => ({
    label: crumb.labelKey ? t(crumb.labelKey) : (crumb.label ?? ''),
    ...(crumb.href !== undefined ? { href: crumb.href } : {}),
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          {...(title !== undefined && { title })}
          {...(breadcrumb !== undefined && { breadcrumb })}
        />

        <main
          className="flex-1 overflow-y-auto transition-[padding] duration-200"
          style={{ paddingLeft: 0 }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

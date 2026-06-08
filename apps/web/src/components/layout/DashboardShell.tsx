import { Navigate, Outlet, useMatches } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Skeleton } from '../ui/Skeleton';
import { Sidebar } from './Sidebar';
import { Header, BreadcrumbItem } from './Header';

interface RouteHandle {
  title?: string;
  breadcrumb?: BreadcrumbItem[];
}

export function DashboardShell() {
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
  const title = handle?.title;
  const breadcrumb = handle?.breadcrumb;

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

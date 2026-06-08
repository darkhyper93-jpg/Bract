import React from 'react';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { StatCard } from './StatCard';
import { UserGrowthChart } from './UserGrowthChart';
import { ActivityChart } from './ActivityChart';
import { useAnalyticsOverview, useUserGrowth, useActivity } from '../hooks/useAnalytics';
import { useAuthStore } from '../../../stores/authStore';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const overview = useAnalyticsOverview();
  const userGrowth = useUserGrowth(30);
  const activity = useActivity(14);

  const firstName = user?.name?.split(' ')[0] ?? 'usuario';

  return (
    <PageWrapper title="Dashboard" description="Resumen de actividad y métricas del sistema">
      {/* Greeting */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl font-semibold text-text-primary">
          {getGreeting()}, {firstName}
        </h2>
        <p className="text-sm text-text-secondary">
          Aquí está el resumen de actividad del sistema
        </p>
      </div>

      {overview.isError ? (
        <ErrorState
          title="Error al cargar estadísticas"
          message="No se pudo obtener el resumen de métricas."
          onRetry={() => overview.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total usuarios"
            value={overview.data?.totalUsers ?? 0}
            isLoading={overview.isLoading}
          />
          <StatCard
            title="Usuarios activos"
            value={overview.data?.activeUsers ?? 0}
            isLoading={overview.isLoading}
          />
          <StatCard
            title="Nuevos hoy"
            value={overview.data?.newUsersToday ?? 0}
            isLoading={overview.isLoading}
          />
          <StatCard
            title="Nuevos esta semana"
            value={overview.data?.newUsersThisWeek ?? 0}
            isLoading={overview.isLoading}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border-default bg-bg-surface p-6">
          <h2 className="mb-4 text-sm font-medium text-text-primary">
            Crecimiento de usuarios — últimos 30 días
          </h2>
          {!userGrowth.isLoading && (userGrowth.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin datos de crecimiento"
              description="Los datos aparecerán aquí cuando haya actividad de usuarios."
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              }
            />
          ) : (
            <UserGrowthChart
              data={userGrowth.data ?? []}
              isLoading={userGrowth.isLoading}
            />
          )}
        </div>

        <div className="rounded-lg border border-border-default bg-bg-surface p-6">
          <h2 className="mb-4 text-sm font-medium text-text-primary">
            Actividad — últimos 14 días
          </h2>
          {!activity.isLoading && (activity.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin actividad reciente"
              description="Los datos de actividad aparecerán aquí en cuanto haya registros."
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
            />
          ) : (
            <ActivityChart
              data={activity.data ?? []}
              isLoading={activity.isLoading}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

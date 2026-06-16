import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { StatCard } from './StatCard';
import { UserGrowthChart } from './UserGrowthChart';
import { ActivityChart } from './ActivityChart';
import { useAnalyticsOverview, useUserGrowth, useActivity } from '../hooks/useAnalytics';
import { useAuthStore } from '../../../stores/authStore';
import { greetingKey } from '../../../utils/greeting';

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const overview = useAnalyticsOverview();
  const userGrowth = useUserGrowth(30);
  const activity = useActivity(14);

  const firstName = user?.name?.split(' ')[0] ?? t('dashboard.greetingUser');

  return (
    <PageWrapper title={t('dashboard.title')} description={t('dashboard.description')}>
      {/* Greeting */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl font-semibold text-text-primary">
          {t(`dashboard.${greetingKey()}`)}, {firstName}
        </h2>
        <p className="text-sm text-text-secondary">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {overview.isError ? (
        <ErrorState
          title={t('dashboard.errorStatsTitle')}
          message={t('dashboard.errorStatsMessage')}
          onRetry={() => overview.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t('dashboard.stats.totalUsers')}
            value={overview.data?.totalUsers ?? 0}
            isLoading={overview.isLoading}
          />
          <StatCard
            title={t('dashboard.stats.activeUsers')}
            value={overview.data?.activeUsers ?? 0}
            isLoading={overview.isLoading}
          />
          <StatCard
            title={t('dashboard.stats.newToday')}
            value={overview.data?.newUsersToday ?? 0}
            isLoading={overview.isLoading}
          />
          <StatCard
            title={t('dashboard.stats.newThisWeek')}
            value={overview.data?.newUsersThisWeek ?? 0}
            isLoading={overview.isLoading}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border-default bg-bg-surface p-6">
          <h2 className="mb-4 text-sm font-medium text-text-primary">
            {t('dashboard.userGrowthTitle')}
          </h2>
          {!userGrowth.isLoading && (userGrowth.data?.length ?? 0) === 0 ? (
            <EmptyState
              title={t('dashboard.emptyGrowthTitle')}
              description={t('dashboard.emptyGrowthDescription')}
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
            {t('dashboard.activityTitle')}
          </h2>
          {!activity.isLoading && (activity.data?.length ?? 0) === 0 ? (
            <EmptyState
              title={t('dashboard.emptyActivityTitle')}
              description={t('dashboard.emptyActivityDescription')}
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

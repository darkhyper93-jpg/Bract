import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useAnalyticsOverview } from '../../dashboard/hooks/useAnalytics';
import { AnalyticsRangePicker } from './AnalyticsRangePicker';
import { AnalyticsStatCards } from './AnalyticsStatCards';
import { UserGrowthSection } from './UserGrowthSection';
import { ActivitySection } from './ActivitySection';
import { RoleDistributionChart } from './RoleDistributionChart';
import { StatusDistributionChart } from './StatusDistributionChart';

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data: overviewData, isLoading: overviewLoading, isError, refetch } = useAnalyticsOverview();

  if (isError) {
    return (
      <PageWrapper
        title={t('analytics.title')}
        description={t('analytics.description')}
        actions={<AnalyticsRangePicker value={days} onChange={setDays} />}
      >
        <ErrorState
          title={t('common.error')}
          message={t('errors.serverError')}
          onRetry={() => refetch()}
          className="py-32"
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title={t('analytics.title')}
      description={t('analytics.description')}
      actions={<AnalyticsRangePicker value={days} onChange={setDays} />}
    >
      <div className="space-y-6">
        <AnalyticsStatCards
          overview={overviewData}
          isLoading={overviewLoading}
          days={days}
        />

        <UserGrowthSection days={days} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ActivitySection days={days} />
          <RoleDistributionChart
            byRole={overviewData?.byRole}
            isLoading={overviewLoading}
          />
        </div>

        <StatusDistributionChart
          byStatus={overviewData?.byStatus}
          isLoading={overviewLoading}
        />
      </div>
    </PageWrapper>
  );
}

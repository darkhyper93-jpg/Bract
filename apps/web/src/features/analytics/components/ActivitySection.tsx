import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useActivity } from '../../dashboard/hooks/useAnalytics';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';

interface ActivitySectionProps {
  days: number;
}

function formatChartDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

export function ActivitySection({ days }: ActivitySectionProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useActivity(days);

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-6">
      <div className="mb-6">
        <h3 className="text-sm font-medium text-text-primary">{t('analytics.dailyActivity')}</h3>
        <p className="mt-1 text-sm text-text-secondary">{t('analytics.lastDays', { days })}</p>
      </div>

      {isLoading && <Skeleton className="h-[280px] w-full" />}

      {isError && !isLoading && (
        <ErrorState
          title={t('analytics.errorLoadData')}
          message={t('analytics.errorActivityMessage')}
          onRetry={() => refetch()}
          className="h-[280px]"
        />
      )}

      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState
          title={t('analytics.noDataPeriod')}
          className="h-[280px]"
        />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={30}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
              cursor={{ fill: 'var(--bg-overlay)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '13px', color: 'var(--text-secondary)', paddingTop: '16px' }}
            />
            <Bar dataKey="logins" name={t('analytics.logins')} fill="var(--brand-primary)" radius={[3, 3, 0, 0]} maxBarSize={24} />
            <Bar dataKey="registrations" name={t('analytics.registrations')} fill="var(--info)" radius={[3, 3, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
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
import type { TooltipProps } from 'recharts';
import type { ActivityPoint } from '@bract/shared';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface ActivityChartProps {
  data: ActivityPoint[];
  isLoading?: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '10px 14px',
      }}
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: 8 }}>
        {label}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          style={{ color: entry.color, fontSize: '13px', marginBottom: 2 }}
        >
          {entry.name}: {entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function ActivityChart({ data, isLoading }: ActivityChartProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data.length) {
    return (
      <EmptyState
        title={t('dashboard.chartNoDataTitle')}
        description={t('dashboard.chartActivityNoDataDescription')}
        className="h-[300px]"
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border-default)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-overlay)' }} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)', paddingTop: '12px' }}
        />
        <Bar dataKey="logins" name={t('analytics.logins')} fill="var(--brand-primary)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="registrations" name={t('analytics.registrations')} fill="var(--info)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

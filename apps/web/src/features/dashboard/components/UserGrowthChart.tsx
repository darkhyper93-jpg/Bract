import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { UserGrowthPoint } from '@bract/shared';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface UserGrowthChartProps {
  data: UserGrowthPoint[];
  isLoading?: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  const { t } = useTranslation();
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
      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>
        {t('dashboard.usersCount', { count: payload[0]?.value ?? 0 })}
      </p>
    </div>
  );
}

export function UserGrowthChart({ data, isLoading }: UserGrowthChartProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data.length) {
    return (
      <EmptyState
        title={t('dashboard.chartNoDataTitle')}
        description={t('dashboard.chartGrowthNoDataDescription')}
        className="h-[300px]"
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-default)' }} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--brand-primary)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: 'var(--brand-primary)', stroke: 'var(--bg-elevated)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

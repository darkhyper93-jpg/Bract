import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useUserGrowth } from '../../dashboard/hooks/useAnalytics';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';

interface UserGrowthSectionProps {
  days: number;
}

function formatChartDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

export function UserGrowthSection({ days }: UserGrowthSectionProps) {
  const { data, isLoading, isError, refetch } = useUserGrowth(days);

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-6">
      <div className="mb-6">
        <h3 className="text-sm font-medium text-text-primary">Crecimiento de usuarios</h3>
        <p className="mt-1 text-sm text-text-secondary">Últimos {days} días</p>
      </div>

      {isLoading && <Skeleton className="h-[280px] w-full" />}

      {isError && !isLoading && (
        <ErrorState
          title="Error al cargar datos"
          message="No se pudo obtener el crecimiento de usuarios."
          onRetry={() => refetch()}
          className="h-[280px]"
        />
      )}

      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState
          title="Sin datos para este período"
          className="h-[280px]"
        />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              formatter={(value: number) => [value, 'Usuarios']}
              labelFormatter={formatChartDate}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--brand-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--brand-primary)', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

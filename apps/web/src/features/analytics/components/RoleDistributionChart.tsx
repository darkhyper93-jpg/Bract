import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AnalyticsOverview } from '@bract/shared';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface RoleDistributionChartProps {
  byRole: AnalyticsOverview['byRole'] | undefined;
  isLoading: boolean;
}

export function RoleDistributionChart({ byRole, isLoading }: RoleDistributionChartProps) {
  const data = byRole
    ? [
        { name: 'Usuario', value: byRole.USER, fill: 'var(--brand-primary)' },
        { name: 'Admin', value: byRole.ADMIN, fill: 'var(--info)' },
        { name: 'Super Admin', value: byRole.SUPER_ADMIN, fill: 'var(--warning)' },
      ].filter((d) => d.value > 0)
    : [];

  const isEmpty = !isLoading && data.length === 0;

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-6">
      <div className="mb-6">
        <h3 className="text-sm font-medium text-text-primary">Distribución por rol</h3>
      </div>

      {isLoading && (
        <div className="flex h-[280px] items-center justify-center">
          <Skeleton variant="circle" className="h-[180px] w-[180px]" />
        </div>
      )}

      {isEmpty && (
        <EmptyState title="Sin datos" className="h-[280px]" />
      )}

      {!isLoading && !isEmpty && (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              stroke="none"
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
              formatter={(value: number, name: string) => [value, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: '13px', color: 'var(--text-secondary)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

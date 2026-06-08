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
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '8px',
        padding: '10px 14px',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: '12px', marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '14px', fontWeight: 600 }}>
        {payload[0]?.value?.toLocaleString()} usuarios
      </p>
    </div>
  );
}

export function UserGrowthChart({ data, isLoading }: UserGrowthChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data.length) {
    return (
      <EmptyState
        title="Sin datos aún"
        description="No hay datos de crecimiento para el período seleccionado."
        className="h-[300px]"
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.10)' }} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#6366f1', stroke: '#1a1a1a', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

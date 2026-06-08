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
        background: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '8px',
        padding: '10px 14px',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: '12px', marginBottom: 8 }}>
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
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data.length) {
    return (
      <EmptyState
        title="Sin datos aún"
        description="No hay datos de actividad para el período seleccionado."
        className="h-[300px]"
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', paddingTop: '12px' }}
        />
        <Bar dataKey="logins" name="Inicios de sesión" fill="#6366f1" radius={[3, 3, 0, 0]} />
        <Bar dataKey="registrations" name="Registros" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

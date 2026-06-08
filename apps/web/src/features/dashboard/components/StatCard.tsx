import React from 'react';
import { Skeleton } from '../../../components/ui/Skeleton';

interface StatCardChange {
  value: number;
  label: string;
}

interface StatCardProps {
  title: string;
  value: number | string;
  change?: StatCardChange;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function StatCard({ title, value, change, icon, isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-surface p-6">
        <Skeleton className="mb-3 h-4 w-24" />
        <Skeleton className="mb-2 h-8 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
    );
  }

  const isPositive = change && change.value > 0;
  const isNegative = change && change.value < 0;

  return (
    <div className="rounded-lg border border-border-default bg-bg-surface p-6 transition-[transform,box-shadow] duration-[150ms] ease-in-out hover:-translate-y-px hover:shadow-md hover:shadow-black/40">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-text-secondary">{title}</p>
        {icon && <span className="text-text-tertiary">{icon}</span>}
      </div>
      <p className="text-2xl font-semibold text-text-primary">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {change && (
        <p
          className={`mt-2 text-xs ${
            isPositive ? 'text-success' : isNegative ? 'text-error' : 'text-text-tertiary'
          }`}
        >
          {isPositive && '↑'}
          {isNegative && '↓'}
          {Math.abs(change.value)} {change.label}
        </p>
      )}
    </div>
  );
}

import React from 'react';
import { cn } from '../../../utils/cn';

interface AnalyticsRangePickerProps {
  value: 7 | 30 | 90;
  onChange: (days: 7 | 30 | 90) => void;
}

const OPTIONS: { label: string; value: 7 | 30 | 90 }[] = [
  { label: '7 días', value: 7 },
  { label: '30 días', value: 30 },
  { label: '90 días', value: 90 },
];

export function AnalyticsRangePicker({ value, onChange }: AnalyticsRangePickerProps) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-border-default bg-bg-surface p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-[background-color,color] duration-[150ms] ease-in-out',
            value === option.value
              ? 'bg-bg-elevated text-text-primary'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

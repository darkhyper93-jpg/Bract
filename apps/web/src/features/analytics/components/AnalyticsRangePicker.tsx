import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';

interface AnalyticsRangePickerProps {
  value: 7 | 30 | 90;
  onChange: (days: 7 | 30 | 90) => void;
}

const OPTIONS: (7 | 30 | 90)[] = [7, 30, 90];

export function AnalyticsRangePicker({ value, onChange }: AnalyticsRangePickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-0.5 rounded-lg border border-border-default bg-bg-surface p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-[background-color,color] duration-[150ms] ease-in-out',
            value === option
              ? 'bg-bg-elevated text-text-primary'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {t('analytics.rangeDays', { count: option })}
        </button>
      ))}
    </div>
  );
}

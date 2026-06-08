import React from 'react';
import { cn } from '../../utils/cn';

const variants = {
  success: 'bg-success/15 text-success border-success/20',
  warning: 'bg-warning/15 text-warning border-warning/20',
  error: 'bg-error/15 text-error border-error/20',
  info: 'bg-info/15 text-info border-info/20',
  neutral: 'bg-bg-elevated text-text-secondary border-border-default',
} as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
  dot?: boolean;
}

export function Badge({
  variant = 'neutral',
  dot = false,
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full bg-current',
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

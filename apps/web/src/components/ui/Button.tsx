import React from 'react';
import { cn } from '../../utils/cn';

const variants = {
  primary:
    'bg-brand-primary text-white hover:bg-brand-hover active:opacity-90 disabled:bg-brand-primary/40',
  secondary:
    'bg-bg-elevated text-text-primary border border-border-default hover:bg-bg-overlay active:opacity-90 disabled:opacity-40',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-bg-elevated active:opacity-90 disabled:opacity-40',
  danger:
    'bg-error text-white hover:bg-error/90 active:opacity-90 disabled:bg-error/40',
} as const;

const sizes = {
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2.5',
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      className,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium',
          'transition-all duration-[150ms] ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50',
          'disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner size={size} />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

function Spinner({ size }: { size: keyof typeof sizes }) {
  const spinnerSizes = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-5 h-5' };
  return (
    <svg
      className={cn('animate-spin shrink-0', spinnerSizes[size])}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

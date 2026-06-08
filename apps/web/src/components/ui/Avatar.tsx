import React from 'react';
import { cn } from '../../utils/cn';
import { Skeleton } from './Skeleton';

const sizes = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
} as const;

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof sizes;
  loading?: boolean;
  className?: string;
}

export function Avatar({
  src,
  name,
  size = 'md',
  loading = false,
  className,
}: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);

  if (loading) {
    return (
      <Skeleton
        className={cn('rounded-full', sizes[size].split(' ').slice(0, 2).join(' '), className)}
      />
    );
  }

  const initials = name
    ? name
        .trim()
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name ?? 'Avatar'}
        onError={() => setImgError(true)}
        className={cn(
          'rounded-full object-cover shrink-0',
          sizes[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0',
        'bg-brand-muted text-brand-primary font-semibold',
        sizes[size],
        className,
      )}
      aria-label={name ?? 'Avatar'}
    >
      {initials}
    </span>
  );
}

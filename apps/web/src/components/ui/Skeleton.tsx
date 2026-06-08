import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'text' | 'circle';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  variant = 'rect',
  width,
  height,
  lines,
  className,
  style,
  ...props
}: SkeletonProps) {
  const baseStyle: React.CSSProperties = {
    width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
    ...style,
  };

  if (lines && lines > 1) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBase
            key={i}
            variant={variant}
            style={baseStyle}
            className={cn(i === lines - 1 && 'w-3/4', className)}
            {...props}
          />
        ))}
      </div>
    );
  }

  return (
    <SkeletonBase
      variant={variant}
      style={baseStyle}
      className={className}
      {...props}
    />
  );
}

function SkeletonBase({
  variant = 'rect',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: SkeletonProps['variant'] }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-bg-elevated',
        variant === 'circle' ? 'rounded-full' : 'rounded-md',
        variant === 'text' ? 'h-4 w-full' : variant === 'circle' ? 'h-8 w-8' : 'h-4 w-full',
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

import React from 'react';
import { cn } from '../../utils/cn';

interface PageWrapperProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageWrapper({ title, description, actions, children, className }: PageWrapperProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1280px] px-6 pb-10 pt-6',
        className,
      )}
    >
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          )}
        </div>
        {actions && (
          <div className="shrink-0 flex items-center gap-2">{actions}</div>
        )}
      </div>

      <div className="mt-4 border-t border-border-subtle" />

      {/* Page content */}
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </div>
  );
}

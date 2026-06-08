import React from 'react';
import { cn } from '../../utils/cn';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function PaginationButton({
  children,
  active,
  disabled,
  onClick,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2',
        'text-sm transition-colors duration-[150ms]',
        active
          ? 'bg-brand-primary text-white'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      {children}
    </button>
  );
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis')[] = [];
  const delta = 2;

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page - delta > 2) pages.push('ellipsis');
    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
      pages.push(i);
    }
    if (page + delta < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn('flex items-center gap-1', className)}
    >
      <PaginationButton
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </PaginationButton>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-sm text-text-tertiary">
            …
          </span>
        ) : (
          <PaginationButton
            key={p}
            active={p === page}
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
          >
            {p}
          </PaginationButton>
        ),
      )}

      <PaginationButton
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </PaginationButton>
    </nav>
  );
}

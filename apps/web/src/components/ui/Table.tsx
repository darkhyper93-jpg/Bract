import React from 'react';
import { cn } from '../../utils/cn';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  className?: string;
  skeletonRows?: number;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = 'No results found',
  emptyDescription,
  emptyIcon,
  className,
  skeletonRows = 5,
}: TableProps<T>) {
  return (
    <div className={cn('w-full overflow-auto rounded-lg border border-border-subtle', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-elevated">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider',
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="border-b border-border-subtle last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4" />
                  </td>
                ))}
              </tr>
            ))
          ) : error ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-2">
                <ErrorState message={error} onRetry={onRetry} />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-2">
                <EmptyState
                  icon={emptyIcon}
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={rowKey(row)}
                className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 transition-colors duration-[150ms]"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3 text-text-secondary', col.className)}
                  >
                    {col.cell(row, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

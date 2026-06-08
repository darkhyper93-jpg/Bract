import React from 'react';
import { Table } from '../../../components/ui/Table';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Pagination } from '../../../components/ui/Pagination';
import { Tooltip } from '../../../components/ui/Tooltip';
import { Button } from '../../../components/ui/Button';
import { AuditActionBadge } from './AuditActionBadge';
import { timeAgo } from '../../../utils/timeAgo';
import type { AuditLogItem } from '@bract/shared';
import type { Column } from '../../../components/ui/Table';
import type { useAuditLogs } from '../hooks/useAuditLogs';

interface AuditLogTableProps {
  data:              ReturnType<typeof useAuditLogs>['data'];
  isLoading:         boolean;
  isError:           boolean;
  onRetry:           () => void;
  page:              number;
  perPage:           number;
  onPageChange:      (page: number) => void;
  hasActiveFilters:  boolean;
  onClearFilters:    () => void;
}

function IconClipboard() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

const columns: Column<AuditLogItem>[] = [
  {
    key: 'action',
    header: 'Acción',
    cell: (row) => <AuditActionBadge action={row.action} />,
    className: 'w-40',
  },
  {
    key: 'user',
    header: 'Usuario',
    cell: (row) =>
      row.userName ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-text-primary leading-tight">{row.userName}</span>
          <span className="text-xs text-text-tertiary leading-tight">{row.userEmail}</span>
        </div>
      ) : (
        <span className="text-sm text-text-tertiary italic">Sistema</span>
      ),
  },
  {
    key: 'resource',
    header: 'Recurso',
    cell: (row) => (
      <span className="font-mono text-xs text-text-secondary">
        {row.resource}
        {row.resourceId && (
          <span className="text-text-tertiary"> · {row.resourceId}</span>
        )}
      </span>
    ),
  },
  {
    key: 'ip',
    header: 'IP',
    cell: (row) => {
      if (!row.ipAddress) {
        return <span className="text-text-tertiary">—</span>;
      }
      if (!row.userAgent) {
        return (
          <span className="font-mono text-xs text-text-secondary">{row.ipAddress}</span>
        );
      }
      return (
        <Tooltip
          content={
            <span className="block max-w-xs break-all whitespace-pre-wrap">{row.userAgent}</span>
          }
          placement="top"
        >
          <span className="font-mono text-xs text-text-secondary cursor-default underline decoration-dotted underline-offset-2">
            {row.ipAddress}
          </span>
        </Tooltip>
      );
    },
    className: 'w-36',
  },
  {
    key: 'when',
    header: 'Cuándo',
    cell: (row) => (
      <Tooltip
        content={new Date(row.createdAt).toLocaleString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
        placement="top"
      >
        <span className="text-xs text-text-secondary cursor-default whitespace-nowrap">
          {timeAgo(row.createdAt)}
        </span>
      </Tooltip>
    ),
    className: 'w-32',
  },
];

export function AuditLogTable({
  data,
  isLoading,
  isError,
  onRetry,
  page,
  onPageChange,
  hasActiveFilters,
  onClearFilters,
}: AuditLogTableProps) {
  const items = data?.data ?? [];
  const meta  = data?.meta;

  if (isError) {
    return (
      <ErrorState
        title="Error al cargar el audit log"
        message="No se pudo obtener el historial de actividad."
        onRetry={onRetry}
      />
    );
  }

  if (!isLoading && items.length === 0) {
    if (hasActiveFilters) {
      return (
        <EmptyState
          icon={<IconFilter />}
          title="Sin resultados para estos filtros"
          description="Prueba con otros criterios de búsqueda o limpia los filtros."
          action={
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              Limpiar filtros
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<IconClipboard />}
        title="No hay actividad registrada aún"
        description="Las acciones del sistema aparecerán aquí."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Table
        columns={columns}
        data={items}
        rowKey={(row) => row.id}
        loading={isLoading}
        skeletonRows={10}
      />
      {!isLoading && meta && meta.totalPages > 1 && (
        <div className="flex justify-end pt-2">
          <Pagination
            page={page}
            totalPages={meta.totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

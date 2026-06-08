import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { useAdminStats } from '../hooks/useAdminStats';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { AdminStatCards } from './AdminStatCards';
import { AuditLogFilters } from './AuditLogFilters';
import { AuditLogTable } from './AuditLogTable';
import type { AuditLogQuery } from '@bract/shared';

export function AdminPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<Partial<AuditLogQuery>>({ page: 1, perPage: 20 });

  const { data: statsData, isLoading: statsLoading } = useAdminStats();
  const { data: logsData, isLoading: logsLoading, isError, refetch } = useAuditLogs(filters);

  function handleFiltersChange(newFilters: Partial<AuditLogQuery>) {
    setFilters({ ...newFilters, page: 1, ...(filters.perPage !== undefined ? { perPage: filters.perPage } : {}) });
  }

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function handleClearFilters() {
    setFilters({ page: 1, perPage: filters.perPage ?? 20 });
  }

  const hasActiveFilters =
    !!(filters.action || filters.userId || filters.dateFrom || filters.dateTo);

  return (
    <PageWrapper
      title={t('admin.title')}
      description={t('admin.description')}
    >
      <AdminStatCards stats={statsData} isLoading={statsLoading} />

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{t('admin.auditLog')}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {t('admin.auditLogDescription')}
          </p>
        </div>

        <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
          <AuditLogFilters filters={filters} onChange={handleFiltersChange} />
        </div>

        <div className="px-6 py-4">
          <AuditLogTable
            data={logsData}
            isLoading={logsLoading}
            isError={isError}
            onRetry={refetch}
            page={filters.page ?? 1}
            perPage={filters.perPage ?? 20}
            onPageChange={handlePageChange}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>
    </PageWrapper>
  );
}

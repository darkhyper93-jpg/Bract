import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { AUDIT_ACTIONS } from '@bract/shared';
import type { AuditLogQuery } from '@bract/shared';

interface AuditLogFiltersProps {
  filters: Partial<AuditLogQuery>;
  onChange: (filters: Partial<AuditLogQuery>) => void;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN:               'Login',
  REGISTER:            'Registro',
  USER_ROLE_CHANGED:   'Cambio de rol',
  USER_STATUS_CHANGED: 'Cambio de status',
  USER_DELETED:        'Eliminado',
};

const DATE_INPUT_CLASS =
  'h-9 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ' +
  'text-[var(--text-primary)] text-sm px-3 focus:outline-none ' +
  'focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/30 ' +
  'transition-colors duration-150 [color-scheme:dark]';

export function AuditLogFilters({ filters, onChange }: AuditLogFiltersProps) {
  const { t } = useTranslation();
  const [userIdInput, setUserIdInput] = useState(filters.userId ?? '');
  const timerRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const filtersRef = useRef(filters);

  useEffect(() => { onChangeRef.current = onChange; });
  useEffect(() => { filtersRef.current = filters; });

  // Sync input when filters cleared externally
  useEffect(() => {
    setUserIdInput(filters.userId ?? '');
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [filters.userId]);

  const actionOptions = [
    { value: '', label: t('admin.allActions') },
    ...AUDIT_ACTIONS.map((a) => ({ value: a, label: ACTION_LABELS[a] ?? a })),
  ];

  function handleUserIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setUserIdInput(value);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const trimmed = value.trim() || undefined;
      onChangeRef.current({ ...filtersRef.current, userId: trimmed, page: 1 });
    }, 400);
  }

  function handleActionChange(value: string) {
    onChange({
      ...filters,
      action: value ? (value as AuditLogQuery['action']) : undefined,
      page: 1,
    });
  }

  function handleDateFrom(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    onChange({
      ...filters,
      dateFrom: value ? new Date(value).toISOString() : undefined,
      page: 1,
    });
  }

  function handleDateTo(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    onChange({
      ...filters,
      dateTo: value ? new Date(value).toISOString() : undefined,
      page: 1,
    });
  }

  function handleClear() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setUserIdInput('');
    onChange({ page: 1, ...(filters.perPage !== undefined ? { perPage: filters.perPage } : {}) });
  }

  const hasActiveFilters =
    !!filters.action || !!filters.userId || !!filters.dateFrom || !!filters.dateTo;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        options={actionOptions}
        value={filters.action ?? ''}
        onChange={handleActionChange}
        className="w-48"
      />

      <input
        type="text"
        value={userIdInput}
        onChange={handleUserIdChange}
        placeholder={t('admin.userId')}
        className={
          'h-9 w-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ' +
          'text-[var(--text-primary)] text-sm px-3 placeholder:text-[var(--text-tertiary)] ' +
          'focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/30 ' +
          'transition-colors duration-150'
        }
      />

      <input
        type="date"
        value={filters.dateFrom ? filters.dateFrom.slice(0, 10) : ''}
        onChange={handleDateFrom}
        className={DATE_INPUT_CLASS}
      />

      <input
        type="date"
        value={filters.dateTo ? filters.dateTo.slice(0, 10) : ''}
        onChange={handleDateTo}
        className={DATE_INPUT_CLASS}
      />

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          {t('admin.clearFilters')}
        </Button>
      )}
    </div>
  );
}

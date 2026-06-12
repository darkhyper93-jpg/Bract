import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Role, UserStatus } from '@bract/shared';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { UsersFilters as FiltersState } from '../hooks/useUsers';

interface UsersFiltersProps {
  filters: FiltersState;
  onFiltersChange: (updates: Partial<FiltersState>) => void;
}

export function UsersFilters({ filters, onFiltersChange }: UsersFiltersProps) {
  const { t } = useTranslation();
  const roleOptions = [
    { value: '', label: t('users.allRoles') },
    { value: Role.USER, label: t('users.roles.USER') },
    { value: Role.ADMIN, label: t('users.roles.ADMIN') },
    { value: Role.SUPER_ADMIN, label: t('users.roles.SUPER_ADMIN') },
  ];

  const statusOptions = [
    { value: '', label: t('users.allStatuses') },
    { value: UserStatus.ACTIVE, label: t('users.statuses.ACTIVE') },
    { value: UserStatus.SUSPENDED, label: t('users.statuses.SUSPENDED') },
    { value: UserStatus.DELETED, label: t('users.statuses.DELETED') },
  ];

  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters = Boolean(filters.search || filters.role || filters.status);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ search: searchInput || undefined });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // DECISIÓN: solo depende de searchInput — incluir onFiltersChange (prop nueva en cada render)
    // rompería el debounce al re-disparar el efecto en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function handleRoleChange(value: string) {
    onFiltersChange({ role: (value as Role) || undefined });
  }

  function handleStatusChange(value: string) {
    onFiltersChange({ status: (value as UserStatus) || undefined });
  }

  function handleClear() {
    setSearchInput('');
    onFiltersChange({ search: undefined, role: undefined, status: undefined });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <Input
          placeholder={t('users.searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          leftAddon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          }
        />
      </div>
      <div className="w-40">
        <Select
          placeholder={t('users.allRoles')}
          value={filters.role ?? ''}
          onChange={handleRoleChange}
          options={roleOptions}
        />
      </div>
      <div className="w-44">
        <Select
          placeholder={t('users.allStatuses')}
          value={filters.status ?? ''}
          onChange={handleStatusChange}
          options={statusOptions}
        />
      </div>
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          {t('users.clearFilters')}
        </Button>
      )}
    </div>
  );
}

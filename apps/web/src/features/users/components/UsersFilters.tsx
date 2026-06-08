import React, { useEffect, useRef, useState } from 'react';
import { Role, UserStatus } from '@bract/shared';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { UsersFilters as FiltersState } from '../hooks/useUsers';

interface UsersFiltersProps {
  filters: FiltersState;
  onFiltersChange: (updates: Partial<FiltersState>) => void;
}

const roleOptions = [
  { value: '', label: 'All roles' },
  { value: Role.USER, label: 'User' },
  { value: Role.ADMIN, label: 'Admin' },
  { value: Role.SUPER_ADMIN, label: 'Super Admin' },
];

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: UserStatus.ACTIVE, label: 'Active' },
  { value: UserStatus.SUSPENDED, label: 'Suspended' },
  { value: UserStatus.DELETED, label: 'Deleted' },
];

export function UsersFilters({ filters, onFiltersChange }: UsersFiltersProps) {
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
          placeholder="Search by name or email…"
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
          placeholder="All roles"
          value={filters.role ?? ''}
          onChange={handleRoleChange}
          options={roleOptions}
        />
      </div>
      <div className="w-44">
        <Select
          placeholder="All statuses"
          value={filters.status ?? ''}
          onChange={handleStatusChange}
          options={statusOptions}
        />
      </div>
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

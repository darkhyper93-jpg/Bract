import React from 'react';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { useUsers } from '../hooks/useUsers';
import { UsersFilters } from './UsersFilters';
import { UsersTable } from './UsersTable';

export default function UsersPage() {
  const { users, meta, isLoading, isError, filters, updateFilters, refetch } = useUsers();

  return (
    <PageWrapper
      title="Usuarios"
      description={meta ? `${meta.total} usuarios en el sistema` : 'Gestión de usuarios del sistema'}
    >
      <UsersFilters filters={filters} onFiltersChange={updateFilters} />

      <UsersTable
        users={users}
        isLoading={isLoading}
        isError={isError}
        meta={meta}
        onRetry={refetch}
        onPageChange={(page) => updateFilters({ page })}
      />
    </PageWrapper>
  );
}

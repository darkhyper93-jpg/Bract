import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { useUsers } from '../hooks/useUsers';
import { UsersFilters } from './UsersFilters';
import { UsersTable } from './UsersTable';

export default function UsersPage() {
  const { t } = useTranslation();
  const { users, meta, isLoading, isError, filters, updateFilters, refetch } = useUsers();

  return (
    <PageWrapper
      title={t('users.title')}
      description={meta ? t('users.descriptionCount', { count: meta.total }) : t('users.description')}
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

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Role, UserStatus } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { usersApi } from '../api/users.api';

export interface UsersFilters {
  page: number;
  perPage: number;
  search?: string | undefined;
  role?: Role | undefined;
  status?: UserStatus | undefined;
}

export function useUsers() {
  const [filters, setFilters] = useState<UsersFilters>({ page: 1, perPage: 20 });

  const query = useQuery({
    queryKey: queryKeys.users.list(filters as unknown as Record<string, unknown>),
    queryFn: () => usersApi.getUsers(filters),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  function updateFilters(updates: Partial<UsersFilters>) {
    setFilters((prev) => {
      const isNonPageUpdate = Object.keys(updates).some((k) => k !== 'page');
      return {
        ...prev,
        ...updates,
        page: isNonPageUpdate ? 1 : (updates.page ?? prev.page),
      };
    });
  }

  return {
    users: query.data?.data ?? [],
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    filters,
    updateFilters,
    refetch: query.refetch,
  };
}

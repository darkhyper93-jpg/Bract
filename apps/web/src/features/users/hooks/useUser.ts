import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { usersApi } from '../api/users.api';

export function useUser(id: string) {
  const query = useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => usersApi.getUserById(id),
    staleTime: 60_000,
    enabled: Boolean(id),
  });

  return {
    user: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

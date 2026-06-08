import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { authApi } from '../../auth/api/auth.api';

export function useProfile() {
  const query = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: authApi.me,
    staleTime: 60 * 1000,
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

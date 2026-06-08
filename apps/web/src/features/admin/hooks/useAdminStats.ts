import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin.api';
import { queryKeys } from '../../../lib/queryKeys';

export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn:  () => adminApi.getStats().then((r) => r.data),
    staleTime: 0,
    refetchInterval: 60_000,
  });
}

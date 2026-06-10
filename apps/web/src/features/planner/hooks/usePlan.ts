import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { plannerApi } from '../api/planner.api';

// Plan ACTIVE con sus bloques (puede ser null si el usuario nunca generó uno).
export function usePlan() {
  const query = useQuery({
    queryKey: queryKeys.planner.plan(),
    queryFn: () => plannerApi.getPlan(),
    staleTime: 30_000,
  });

  return {
    plan: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

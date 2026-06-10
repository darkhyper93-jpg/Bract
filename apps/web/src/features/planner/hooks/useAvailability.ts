import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { plannerApi } from '../api/planner.api';

// Disponibilidad por día de semana (minutos). Cambia rara vez → staleTime más alto.
export function useAvailability() {
  const query = useQuery({
    queryKey: queryKeys.planner.availability(),
    queryFn: () => plannerApi.getAvailability(),
    staleTime: 5 * 60_000,
  });

  return {
    availability: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

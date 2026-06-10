import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { plannerApi } from '../api/planner.api';

// Árbol materias→temas (fuente de verdad del progreso). staleTime corto: el estado de los
// temas cambia con frecuencia (completar dispara recálculo del plan).
export function useSubjects() {
  const query = useQuery({
    queryKey: queryKeys.planner.subjects(),
    queryFn: () => plannerApi.listSubjects(),
    staleTime: 30_000,
  });

  return {
    subjects: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

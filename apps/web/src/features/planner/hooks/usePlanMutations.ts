import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SetAvailabilityInput, StudyPlanItemStatus } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { plannerApi } from '../api/planner.api';

// Mutaciones del plan y la disponibilidad. Generar/marcar bloques invalida el plan;
// guardar disponibilidad invalida su propio query (la regeneración del plan es explícita).
export function usePlanMutations() {
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: () => plannerApi.generatePlan(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.plan() });
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StudyPlanItemStatus }) =>
      plannerApi.updatePlanItem(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.plan() });
    },
  });

  const saveAvailability = useMutation({
    mutationFn: (input: SetAvailabilityInput) => plannerApi.setAvailability(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.availability() });
    },
  });

  return { generate, updateItem, saveAvailability };
}

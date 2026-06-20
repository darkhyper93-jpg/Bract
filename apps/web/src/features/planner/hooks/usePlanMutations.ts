import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SetAvailabilityInput, StudyPlanItemStatus } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { invalidateAfterStudyAction } from '../../../lib/invalidateStudyContext';
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

  // Completar un bloque del plan cuenta para el juego (Agente J); refrescamos el summary para los
  // momentos animados (el backend solo otorga XP en la transición a COMPLETED).
  const updateItem = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StudyPlanItemStatus }) =>
      plannerApi.updatePlanItem(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.plan() });
      invalidateAfterStudyAction(queryClient);
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

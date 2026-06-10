import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTopicInput, UpdateTopicInput, TopicStatus } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { plannerApi } from '../api/planner.api';

// Mutaciones de temas. Cambiar el estado de un tema dispara recálculo del plan en el backend;
// por eso invalidamos materias + plan en todas (el recálculo reactivo del §8.6).
export function useTopicMutations() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.planner.subjects() });
    queryClient.invalidateQueries({ queryKey: queryKeys.planner.plan() });
  }

  const create = useMutation({
    mutationFn: ({ subjectId, input }: { subjectId: string; input: CreateTopicInput }) =>
      plannerApi.createTopic(subjectId, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTopicInput }) =>
      plannerApi.updateTopic(id, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => plannerApi.deleteTopic(id),
    onSuccess: invalidate,
  });

  // Completar/cambiar estado → recálculo reactivo del plan.
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TopicStatus }) =>
      plannerApi.updateTopicStatus(id, status),
    onSuccess: invalidate,
  });

  return { create, update, remove, setStatus };
}

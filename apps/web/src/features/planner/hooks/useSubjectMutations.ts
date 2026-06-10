import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateSubjectInput, UpdateSubjectInput } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { plannerApi } from '../api/planner.api';

// Mutaciones de materias. Invalidan el árbol de materias y el plan (borrar/editar materias
// cambia el universo de temas que el plan distribuye).
export function useSubjectMutations() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.planner.subjects() });
    queryClient.invalidateQueries({ queryKey: queryKeys.planner.plan() });
  }

  const create = useMutation({
    mutationFn: (input: CreateSubjectInput) => plannerApi.createSubject(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSubjectInput }) =>
      plannerApi.updateSubject(id, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => plannerApi.deleteSubject(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

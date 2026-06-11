import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateSubjectInput, UpdateSubjectInput } from '@bract/shared';
import { invalidateAfterTreeChange } from '../../../lib/invalidateStudyContext';
import { plannerApi } from '../api/planner.api';

// Mutaciones de materias. Invalidan el árbol + el plan, y la rama flashcards: borrar una materia
// cascadea a sus temas y a las flashcards de esos temas (Agente F — grafo central en
// `invalidateStudyContext`). Editar/crear refresca labels y el universo de temas del plan.
export function useSubjectMutations() {
  const queryClient = useQueryClient();

  function invalidate() {
    invalidateAfterTreeChange(queryClient);
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

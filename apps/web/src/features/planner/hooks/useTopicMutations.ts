import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTopicInput, UpdateTopicInput, TopicStatus } from '@bract/shared';
import {
  invalidateAfterStudyAction,
  invalidateAfterTopicStatusChange,
  invalidateAfterTreeChange,
} from '../../../lib/invalidateStudyContext';
import { plannerApi } from '../api/planner.api';

// Mutaciones de temas. Las invalidaciones cruzadas (planner + flashcards) viven en el helper
// central `invalidateStudyContext` (grafo de dependencias en un solo lugar — Agente F). Crear/
// editar/borrar afectan el árbol (delete cascadea a flashcards); cambiar el estado dispara
// recálculo del plan + rotación SRS de las cartas del tema (§8.6).
export function useTopicMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: ({ subjectId, input }: { subjectId: string; input: CreateTopicInput }) =>
      plannerApi.createTopic(subjectId, input),
    onSuccess: () => invalidateAfterTreeChange(queryClient),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTopicInput }) =>
      plannerApi.updateTopic(id, input),
    onSuccess: () => invalidateAfterTreeChange(queryClient),
  });

  const remove = useMutation({
    mutationFn: (id: string) => plannerApi.deleteTopic(id),
    onSuccess: () => invalidateAfterTreeChange(queryClient),
  });

  // Completar/cambiar estado → recálculo reactivo del plan + activar/pausar las flashcards del tema.
  // Completar un tema cuenta para el juego (Agente J) → refrescamos el summary (momentos animados).
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TopicStatus }) =>
      plannerApi.updateTopicStatus(id, status),
    onSuccess: (_data, { id }) => {
      invalidateAfterTopicStatusChange(queryClient, id);
      invalidateAfterStudyAction(queryClient);
    },
  });

  return { create, update, remove, setStatus };
}

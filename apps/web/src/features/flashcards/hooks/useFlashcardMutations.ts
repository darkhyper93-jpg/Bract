import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateFlashcardInput, UpdateFlashcardInput, ReviewQuality } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { flashcardsApi } from '../api/flashcards.api';

// Mutaciones de flashcards. CRUD/generación invalidan las cartas del tema afectado + la cola due
// (una carta nueva entra due enseguida). `review` invalida due + el tema (cambió su estado SRS).
export function useFlashcardMutations() {
  const queryClient = useQueryClient();

  function invalidateTopic(topicId: string) {
    queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.byTopic(topicId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.due() });
  }

  const create = useMutation({
    mutationFn: (input: CreateFlashcardInput) => flashcardsApi.create(input),
    onSuccess: (card) => invalidateTopic(card.topicId),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFlashcardInput }) =>
      flashcardsApi.update(id, input),
    onSuccess: (card) => invalidateTopic(card.topicId),
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string; topicId: string }) => flashcardsApi.remove(id),
    onSuccess: (_data, { topicId }) => invalidateTopic(topicId),
  });

  // Generación con IA por tema (vía Agente B). El error AI_UNAVAILABLE lo maneja la UI.
  const generate = useMutation({
    mutationFn: ({ topicId, count }: { topicId: string; count?: number }) =>
      flashcardsApi.generate(topicId, count),
    onSuccess: (_cards, { topicId }) => invalidateTopic(topicId),
  });

  // Generación multi-tema (éxito parcial). Invalida cada tema que efectivamente generó cartas + la cola due.
  const generateMulti = useMutation({
    mutationFn: ({ topicIds, count }: { topicIds: string[]; count?: number }) =>
      flashcardsApi.generateMulti(topicIds, count),
    onSuccess: ({ meta }) => {
      meta.topics.filter((tp) => tp.generated > 0).forEach((tp) => invalidateTopic(tp.topicId));
    },
  });

  // Calificar (SM-2). Invalida la cola due y las cartas del tema de la carta calificada.
  const review = useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: ReviewQuality }) =>
      flashcardsApi.review(id, quality),
    onSuccess: (card) => invalidateTopic(card.topicId),
  });

  return { create, update, remove, generate, generateMulti, review };
}

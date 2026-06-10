import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { flashcardsApi } from '../api/flashcards.api';

// Cartas de un tema (vista de gestión). Deshabilitado hasta que haya un tema seleccionado.
export function useFlashcards(topicId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.flashcards.byTopic(topicId ?? ''),
    queryFn: () => flashcardsApi.listByTopic(topicId as string),
    enabled: topicId !== null,
    staleTime: 30_000,
  });

  return {
    flashcards: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

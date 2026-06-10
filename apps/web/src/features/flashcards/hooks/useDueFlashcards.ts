import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { flashcardsApi } from '../api/flashcards.api';

// Cola de repaso "due" del usuario (SRS). staleTime 0: tras calificar, la lista cambia y
// queremos refrescarla al volver a la sesión. La StudySession trabaja sobre un snapshot local.
export function useDueFlashcards(limit = 50) {
  const query = useQuery({
    queryKey: queryKeys.flashcards.due(),
    queryFn: () => flashcardsApi.listDue(limit),
    staleTime: 0,
  });

  return {
    flashcards: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

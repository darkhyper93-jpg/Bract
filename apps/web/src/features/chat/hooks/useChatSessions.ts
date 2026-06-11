import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { chatApi } from '../api/chat.api';

// Lista de sesiones del usuario (recientes primero). staleTime corto: enviar un mensaje toca
// `updatedAt` y reordena la lista.
export function useChatSessions() {
  const query = useQuery({
    queryKey: queryKeys.chat.sessions(),
    queryFn: () => chatApi.listSessions(),
    staleTime: 30_000,
  });

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

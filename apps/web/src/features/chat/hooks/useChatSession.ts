import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { chatApi } from '../api/chat.api';

// Sesión + hilo de mensajes. Habilitado solo con un id activo. staleTime 0: tras el stream
// invalidamos para traer el mensaje del assistant ya persistido.
export function useChatSession(id: string | null) {
  const query = useQuery({
    queryKey: id ? queryKeys.chat.session(id) : ['chat', 'session', 'none'],
    queryFn: () => chatApi.getSession(id as string),
    enabled: id !== null,
    staleTime: 0,
  });

  return {
    session: query.data ?? null,
    messages: query.data?.messages ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

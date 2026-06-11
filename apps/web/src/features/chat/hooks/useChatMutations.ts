import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateSessionInput } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { chatApi } from '../api/chat.api';

// Mutaciones de sesiones: crear y borrar. Ambas invalidan la lista de sesiones.
export function useChatMutations() {
  const queryClient = useQueryClient();

  const createSession = useMutation({
    mutationFn: (input: CreateSessionInput = {}) => chatApi.createSession(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() });
    },
  });

  const deleteSession = useMutation({
    mutationFn: (id: string) => chatApi.deleteSession(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() });
      queryClient.removeQueries({ queryKey: queryKeys.chat.session(id) });
    },
  });

  return { createSession, deleteSession };
}

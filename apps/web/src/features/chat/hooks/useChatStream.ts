import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { chatApi, ChatStreamError } from '../api/chat.api';

// Un reintento automático ante AI_UNAVAILABLE (transitorios del free tier): cold-start de Render
// y blips de Gemini suelen resolverse en el 2do intento. Esperamos un poco antes de reintentar.
const AI_RETRY_DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Hook del streaming del chat. Maneja el envío de un mensaje y el render token a token:
// - `pendingUserContent`: el mensaje del usuario se muestra al instante (el hilo persistido se
//   refetchea al terminar).
// - `streamingText`: la respuesta del assistant se acumula delta a delta.
// - En éxito: invalida el hilo (trae el mensaje del assistant ya persistido) y la lista de sesiones.
// - En disconnect/cambio de sesión: aborta el `fetch` (el backend aborta al proveedor y persiste el
//   parcial). En error: mantiene visible el mensaje del usuario + el parcial, con opción de reintentar.
export function useChatStream(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [streamingText, setStreamingText] = useState('');
  const [pendingUserContent, setPendingUserContent] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<{ code: string } | null>(null);
  const acRef = useRef<AbortController | null>(null);
  const lastContentRef = useRef<string | null>(null);

  // Cambiar de sesión / desmontar: abortar el stream en curso (dispara el abort del proveedor en
  // el backend) y limpiar el estado local para no mezclar hilos.
  useEffect(() => {
    return () => {
      acRef.current?.abort();
    };
  }, [sessionId]);

  useEffect(() => {
    setStreamingText('');
    setPendingUserContent(null);
    setError(null);
    setIsStreaming(false);
  }, [sessionId]);

  const send = useCallback(
    async (raw: string): Promise<void> => {
      if (!sessionId || isStreaming) return;
      const content = raw.trim();
      if (content.length === 0) return;

      lastContentRef.current = content;
      const ac = new AbortController();
      acRef.current = ac;
      setError(null);
      setPendingUserContent(content);
      setStreamingText('');
      setIsStreaming(true);

      // Reintento único ante AI_UNAVAILABLE PRE-stream (nada streameado aún): cubre cold-start de
      // Render y blips de Gemini. Si ya llegaron tokens, no reintentamos (no duplicar respuesta).
      // `tokensReceived` es local (no el state `streamingText`, que en este closure async es stale).
      let tokensReceived = false;
      const runStream = (): Promise<void> =>
        chatApi.streamMessage(
          sessionId,
          content,
          {
            onToken: (tk) => {
              tokensReceived = true;
              setStreamingText((prev) => prev + tk);
            },
          },
          ac.signal,
        );

      try {
        try {
          await runStream();
        } catch (err) {
          if (ac.signal.aborted) return; // switch/unmount → el effect de reset maneja el estado
          const code = err instanceof ChatStreamError ? err.code : 'INTERNAL_ERROR';
          // Solo reintentamos si fue AI_UNAVAILABLE y no se streameó nada todavía.
          if (code !== 'AI_UNAVAILABLE' || tokensReceived) throw err;
          await sleep(AI_RETRY_DELAY_MS);
          if (ac.signal.aborted) return;
          setStreamingText('');
          await runStream();
        }
        // Éxito: refetch del hilo (incluye el assistant persistido) + lista (title/updatedAt cambian).
        await queryClient.invalidateQueries({ queryKey: queryKeys.chat.session(sessionId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() });
        setPendingUserContent(null);
        setStreamingText('');
        setIsStreaming(false);
      } catch (err) {
        if (ac.signal.aborted) return; // switch/unmount → el effect de reset maneja el estado
        const code = err instanceof ChatStreamError ? err.code : 'INTERNAL_ERROR';
        setError({ code });
        setIsStreaming(false);
        // pendingUserContent + streamingText se mantienen visibles junto al error + retry.
      }
    },
    [sessionId, isStreaming, queryClient],
  );

  const retry = useCallback((): void => {
    if (lastContentRef.current) void send(lastContentRef.current);
  }, [send]);

  return { send, retry, isStreaming, streamingText, pendingUserContent, error };
}

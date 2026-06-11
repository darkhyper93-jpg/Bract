import apiClient from '../../../lib/axios';
import { useAuthStore } from '../../../stores/authStore';
import type {
  ChatSession,
  ChatSessionWithMessages,
  CreateSessionInput,
} from '@bract/shared';

// Capa api/ del Chat de estudio (Agente E). Los 4 endpoints de gestión usan el envelope
// `{ success, data, meta? }` vía axios. El de mensajes consume STREAMING (SSE) con `fetch`,
// porque `EventSource` no soporta POST ni el header Authorization (token en memoria).

interface Envelope<T> {
  success: true;
  data: T;
}

// Mismo baseURL que el axios client (token Bearer en memoria, sin cookies para el stream).
const API_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:4000/api/v1';

// Error del stream que transporta el `code` del backend (p. ej. AI_UNAVAILABLE) para que la UI
// muestre el mensaje correcto.
export class ChatStreamError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ChatStreamError';
    this.code = code;
  }
}

export interface ChatStreamCallbacks {
  onMeta?: (meta: { sessionId: string; userMessageId: string; title: string | null }) => void;
  onToken?: (text: string) => void;
  onDone?: (data: { messageId: string }) => void;
}

// Parsea un frame SSE ("event: x\ndata: {...}") en { event, data }.
function parseFrame(frame: string): { event: string; data: string } {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  return { event, data: dataLines.join('\n') };
}

async function dispatchFrame(frame: string, cb: ChatStreamCallbacks): Promise<void> {
  const { event, data } = parseFrame(frame);
  if (data.length === 0) return;
  // DECISIÓN: el `data` de cada frame es JSON (lo emite el backend con JSON.stringify).
  const payload = JSON.parse(data) as Record<string, unknown>;
  if (event === 'meta') {
    cb.onMeta?.(payload as unknown as { sessionId: string; userMessageId: string; title: string | null });
  } else if (event === 'token') {
    cb.onToken?.(String(payload['text'] ?? ''));
  } else if (event === 'done') {
    cb.onDone?.(payload as unknown as { messageId: string });
  } else if (event === 'error') {
    throw new ChatStreamError(String(payload['code'] ?? 'INTERNAL_ERROR'), String(payload['message'] ?? ''));
  }
}

async function doFetch(sessionId: string, content: string, signal: AbortSignal): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  return fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ content }),
    signal,
  });
}

export const chatApi = {
  async listSessions(page = 1, perPage = 50): Promise<ChatSession[]> {
    const res = await apiClient.get<Envelope<{ sessions: ChatSession[] }>>('/chat/sessions', {
      params: { page, perPage },
    });
    return res.data.data.sessions;
  },

  async createSession(input: CreateSessionInput = {}): Promise<ChatSession> {
    const res = await apiClient.post<Envelope<{ session: ChatSession }>>('/chat/sessions', input);
    return res.data.data.session;
  },

  async getSession(id: string): Promise<ChatSessionWithMessages> {
    const res = await apiClient.get<Envelope<{ session: ChatSessionWithMessages }>>(
      `/chat/sessions/${id}`,
    );
    return res.data.data.session;
  },

  async deleteSession(id: string): Promise<void> {
    await apiClient.delete(`/chat/sessions/${id}`);
  },

  // Envía un mensaje y consume el stream SSE token a token. `fetch` NO pasa por los interceptors
  // de axios → adjuntamos el Bearer a mano y, ante 401, refrescamos una vez (reusando el endpoint
  // /auth/refresh vía axios) y reintentamos. Lanza ChatStreamError si el backend manda `event: error`
  // o un envelope de error (p. ej. AI_UNAVAILABLE 503). Aborta con `signal`.
  async streamMessage(
    sessionId: string,
    content: string,
    callbacks: ChatStreamCallbacks,
    signal: AbortSignal,
  ): Promise<void> {
    let res = await doFetch(sessionId, content, signal);

    if (res.status === 401) {
      // Un refresh y reintento (mismo flujo que el interceptor de axios, pero para fetch).
      try {
        const refresh = await apiClient.post<{ data: { access_token: string } }>('/auth/refresh');
        useAuthStore.getState().setToken(refresh.data.data.access_token);
      } catch {
        useAuthStore.getState().logout();
        throw new ChatStreamError('UNAUTHORIZED', 'Sesión expirada');
      }
      res = await doFetch(sessionId, content, signal);
    }

    // Error ANTES del stream: el backend respondió JSON (envelope de error), no SSE.
    if (!res.ok) {
      let code = 'INTERNAL_ERROR';
      let message = '';
      try {
        const body = (await res.json()) as { error?: { code?: string; message?: string } };
        code = body.error?.code ?? code;
        message = body.error?.message ?? '';
      } catch {
        /* respuesta no-JSON: dejamos los defaults */
      }
      throw new ChatStreamError(code, message);
    }

    if (!res.body) throw new ChatStreamError('INTERNAL_ERROR', 'Stream vacío');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        // Los frames SSE se separan por línea en blanco ("\n\n").
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (frame.trim().length > 0) await dispatchFrame(frame, callbacks);
        }
      }
    } finally {
      reader.cancel().catch(() => undefined);
    }
  },
};

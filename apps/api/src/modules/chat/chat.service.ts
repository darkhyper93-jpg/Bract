import type {
  ChatMessage as PrismaChatMessage,
  ChatSession as PrismaChatSession,
} from '@prisma/client';
import { ChatRole } from '@bract/shared';
import type {
  ChatSession,
  ChatMessage,
  ChatSessionWithMessages,
  CreateSessionInput,
  ChatSessionListQuery,
} from '@bract/shared';
import { assembleStudentContext, isAIConfigured, streamChatReply } from '../../lib/ai/index.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { plannerService } from '../planner/planner.service.js';
import { progressService } from '../progress/progress.service.js';
import { chatRepository } from './chat.repository.js';
import type { ChatSessionWithMessagesRow } from './chat.repository.js';

// ============================================================================
// Chat de estudio (Agente E) — lógica de negocio. Recibe DTOs (nunca req), mapea
// Prisma→shared (Date→ISO, enum ChatRole casteado), valida pertenencia vía el padre
// (ChatSession.userId — ChatMessage no tiene userId, §3.4) y orquesta el streaming.
// NO toca HTTP: el generador emite eventos de dominio; el controller los serializa a SSE.
// ============================================================================

// Cap del historial enviado al modelo (por tokens/costo). El contexto del estudiante
// (materias/temas/progreso) va aparte vía el assembler del Agente B.
const MAX_HISTORY_MESSAGES = 20;
const TITLE_MAX_LENGTH = 60;

// Evento de dominio del stream del chat. El controller lo serializa a frames SSE.
export type ChatStreamEvent =
  | { type: 'meta'; data: { sessionId: string; userMessageId: string; title: string | null } }
  | { type: 'token'; data: { text: string } }
  | { type: 'done'; data: { messageId: string } };

// ---- Mappers Prisma → contrato @bract/shared ------------------------------
// DECISIÓN: cast del enum Prisma → enum compartido (mismatch nominal de TS); mismo
// patrón que role/status en auth.service y type en notification.service.

function toSession(s: PrismaChatSession): ChatSession {
  return {
    id: s.id,
    userId: s.userId,
    title: s.title,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function toMessage(m: PrismaChatMessage): ChatMessage {
  return {
    id: m.id,
    sessionId: m.sessionId,
    role: m.role as ChatRole,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

function toSessionWithMessages(row: ChatSessionWithMessagesRow): ChatSessionWithMessages {
  return { ...toSession(row), messages: row.messages.map(toMessage) };
}

// ---- Helpers ---------------------------------------------------------------

// Título derivado del 1er mensaje: colapsa espacios y trunca con elipsis.
function deriveTitle(content: string): string {
  const t = content.trim().replace(/\s+/g, ' ');
  return t.length <= TITLE_MAX_LENGTH ? t : `${t.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

// Historial reciente (newest-first, incluye el mensaje recién guardado) → turnos
// user/assistant en orden cronológico, excluyendo el mensaje actual y los SYSTEM.
function buildHistory(
  recent: PrismaChatMessage[],
  excludeId: string,
): { role: 'user' | 'assistant'; content: string }[] {
  return recent
    .filter((m) => m.id !== excludeId && (m.role === 'USER' || m.role === 'ASSISTANT'))
    .slice(0, MAX_HISTORY_MESSAGES)
    .reverse()
    .map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('assistant' as const), content: m.content }));
}

export const chatService = {
  // ---- Sesiones ----
  async listSessions(
    userId: string,
    query: ChatSessionListQuery,
  ): Promise<{ sessions: ChatSession[]; meta: { total: number; page: number; perPage: number; totalPages: number } }> {
    const [rows, total] = await Promise.all([
      chatRepository.findManyByUserPaged(userId, query.page, query.perPage),
      chatRepository.countByUser(userId),
    ]);
    return {
      sessions: rows.map(toSession),
      meta: {
        total,
        page: query.page,
        perPage: query.perPage,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  },

  async createSession(userId: string, input: CreateSessionInput): Promise<ChatSession> {
    const title = input.title?.trim() ? input.title.trim() : null;
    const created = await chatRepository.create(userId, title);
    return toSession(created);
  },

  async getSession(id: string, userId: string): Promise<ChatSessionWithMessages> {
    const row = await chatRepository.findByIdAndUserWithMessages(id, userId);
    if (!row) throw new AppError('NOT_FOUND', 'Sesión no encontrada');
    return toSessionWithMessages(row);
  },

  async deleteSession(id: string, userId: string): Promise<void> {
    const owner = await chatRepository.findOwner(id);
    if (!owner || owner.userId !== userId) {
      throw new AppError('NOT_FOUND', 'Sesión no encontrada');
    }
    await chatRepository.deleteById(id);
  },

  // ---- Streaming del mensaje ----
  // Generador de eventos de dominio. Lanza ANTES del primer `yield` si: la sesión no es del
  // usuario (NOT_FOUND) o falta la key (AI_UNAVAILABLE 503) → el controller responde JSON sin
  // abrir el stream. Tras el `meta`, todo fallo del proveedor sale como `event: error` (SSE).
  // Disconnect: el controller corta el `for await` (propaga `return()` y aborta al proveedor);
  // el `finally` persiste lo streameado hasta ese punto (registrado, no a medias-perdido).
  async *streamMessage(
    sessionId: string,
    userId: string,
    content: string,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const owner = await chatRepository.findOwner(sessionId);
    if (!owner || owner.userId !== userId) {
      throw new AppError('NOT_FOUND', 'Sesión no encontrada');
    }
    // Chequeo de IA ANTES de persistir y del primer `yield`: así un fallo por falta de key sale
    // como JSON 503 (headers no enviados todavía) y no deja un mensaje de usuario huérfano sin
    // respuesta. `streamChatReply` también valida adentro, pero recién al iterar (tras el `meta`).
    if (!isAIConfigured()) {
      throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
    }

    const userMessage = await chatRepository.createMessage(
      sessionId,
      ChatRole.USER as PrismaChatMessage['role'],
      content,
    );

    let title = owner.title;
    if (title === null) {
      title = deriveTitle(content);
      await chatRepository.updateTitle(sessionId, title);
    }

    yield { type: 'meta', data: { sessionId, userMessageId: userMessage.id, title } };

    const subjects = await plannerService.listSubjects(userId);
    // I-2 (capa 3): top puntos débiles para ajustar las explicaciones del tutor. Si falla, contexto = hoy.
    let weakTopics: { name: string; weakness: number }[] | undefined;
    try {
      const weak = await progressService.getWeakTopics(userId, 5);
      if (weak.length > 0) weakTopics = weak.map((w) => ({ name: w.name, weakness: w.weakness }));
    } catch (err) {
      logger.error('chat: weak-topics enrichment failed; contexto sin debilidad', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const context = assembleStudentContext(subjects, new Date(), weakTopics);
    const recent = await chatRepository.findRecentMessages(sessionId, MAX_HISTORY_MESSAGES + 1);
    const history = buildHistory(recent, userMessage.id);

    let acc = '';
    let streamEnded = false;
    let assistant: PrismaChatMessage | null = null;
    try {
      // `signal` atado al disconnect del cliente (E↔B): aborta el request al proveedor de inmediato.
      for await (const delta of streamChatReply({ context, history, message: content }, signal)) {
        acc += delta;
        yield { type: 'token', data: { text: delta } };
      }
      streamEnded = true;
    } catch (err) {
      // Disconnect: el abort del proveedor es un corte ESPERADO, no un error. El `finally` persiste
      // el parcial; no relanzamos (el controller no debe emitir `event: error`). Cualquier OTRO
      // fallo del proveedor sí se propaga para que el controller lo serialice como `event: error`.
      if (!signal?.aborted) throw err;
    } finally {
      // Persiste el reply completo (stream OK) o el parcial (disconnect a mitad). Solo si hay texto.
      if (acc.length > 0 && assistant === null) {
        try {
          assistant = await chatRepository.createMessage(
            sessionId,
            ChatRole.ASSISTANT as PrismaChatMessage['role'],
            acc,
          );
          await chatRepository.touch(sessionId);
        } catch (err) {
          logger.error('chat.persist_assistant_failed', {
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // `done` solo en finalización natural (en disconnect el consumidor ya cortó el generador).
    if (streamEnded && assistant !== null) {
      yield { type: 'done', data: { messageId: assistant.id } };
    }
  },
};

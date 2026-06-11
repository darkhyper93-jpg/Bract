import type { Request, Response, NextFunction } from 'express';
import {
  chatSessionListQuerySchema,
  createSessionSchema,
  sendMessageSchema,
  sessionIdParamSchema,
} from '@bract/shared';
import { AppError } from '../../lib/errors.js';
import { ERROR_CODES } from '../../config/constants.js';
import type { ChatStreamEvent } from './chat.service.js';
import { chatService } from './chat.service.js';

// Controller del Chat de estudio (Agente E) — SOLO HTTP. Los 4 endpoints de gestión usan el
// envelope `{ success, data, meta? }`. El de mensajes responde STREAMING (SSE): excepción
// documentada al envelope (ver error.md). Esta es la única capa que toca `res`.

// Cabeceras SSE. `X-Accel-Buffering: no` desactiva el buffering de proxies (Nginx/Render) para
// que los tokens lleguen en tiempo real; `no-transform` evita que se recomprima/reescriba.
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

function writeSSE(res: Response, event: ChatStreamEvent['type'] | 'error', data: unknown): void {
  // `data` JSON-encodeado: newlines/Unicode quedan seguros dentro de una sola línea SSE.
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function toErrorData(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  return { code: ERROR_CODES.INTERNAL_ERROR, message: 'Error interno' };
}

export const chatController = {
  // ---- Sesiones (JSON) ----
  async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = chatSessionListQuerySchema.parse(req.query);
      const result = await chatService.listSessions(req.user!.id, query);
      res.json({ success: true, data: { sessions: result.sessions }, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },

  async createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createSessionSchema.parse(req.body);
      const session = await chatService.createSession(req.user!.id, input);
      res.status(201).json({ success: true, data: { session } });
    } catch (err) {
      next(err);
    }
  },

  async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = sessionIdParamSchema.parse(req.params);
      const session = await chatService.getSession(id, req.user!.id);
      res.json({ success: true, data: { session } });
    } catch (err) {
      next(err);
    }
  },

  async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = sessionIdParamSchema.parse(req.params);
      await chatService.deleteSession(id, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // ---- Enviar mensaje (SSE streaming) ----
  // El service emite eventos de dominio; acá se serializan a frames SSE. Errores ANTES del
  // primer frame (NOT_FOUND / AI_UNAVAILABLE / validación) → JSON via errorHandler. Errores ya
  // streameando → `event: error`. Disconnect del cliente → `gen.return()` aborta al proveedor y
  // dispara el `finally` del service (persiste el parcial).
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    let id: string;
    let content: string;
    try {
      ({ id } = sessionIdParamSchema.parse(req.params));
      ({ content } = sendMessageSchema.parse(req.body));
    } catch (err) {
      next(err); // validación → JSON 400
      return;
    }

    // AbortController atado al cierre de la conexión: aborta el request al proveedor de IA de
    // INMEDIATO (no espera al próximo token). El service persiste el parcial en su `finally`.
    const aiAbort = new AbortController();
    const gen = chatService.streamMessage(id, req.user!.id, content, aiAbort.signal);
    let started = false;
    let clientGone = false;

    res.on('close', () => {
      if (!res.writableEnded) {
        clientGone = true;
        aiAbort.abort(); // dispara el abort del fetch al proveedor; el for-await se desarma solo
      }
    });

    try {
      for await (const ev of gen) {
        if (clientGone) break;
        if (!started) {
          res.writeHead(200, SSE_HEADERS);
          started = true;
        }
        writeSSE(res, ev.type, ev.data);
        if (ev.type === 'done') break;
      }
    } catch (err) {
      if (!started) {
        next(err); // todavía no abrimos el stream → JSON (503/404/500)
        return;
      }
      if (!clientGone && !res.writableEnded) {
        writeSSE(res, 'error', toErrorData(err));
      }
    } finally {
      if (started && !res.writableEnded) res.end();
    }
  },
};

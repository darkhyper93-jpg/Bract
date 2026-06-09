import { z } from 'zod';

// GET /chat/sessions — lista de sesiones del usuario (paginado; crece con el uso).
export const chatSessionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const sessionIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type ChatSessionListQuery = z.infer<typeof chatSessionListQuerySchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

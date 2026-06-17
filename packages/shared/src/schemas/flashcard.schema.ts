import { z } from 'zod';

export const createFlashcardSchema = z.object({
  topicId: z.string().cuid(),
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().min(1).max(2000),
});

export const updateFlashcardSchema = z
  .object({
    question: z.string().trim().min(1).max(1000),
    answer: z.string().trim().min(1).max(2000),
  })
  .partial();

// GET /flashcards?topicId=... — cartas de un tema (paginado; un tema puede acumular muchas cartas).
export const flashcardListQuerySchema = z.object({
  topicId: z.string().cuid(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /flashcards/due — cartas due del usuario (SRS). `limit` acota el tamaño de la sesión de estudio.
export const flashcardDueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// POST /topics/:topicId/flashcards/generate — genera con IA (vía Agente B). Tope 10 (Apéndice C).
export const generateFlashcardsParamSchema = z.object({
  topicId: z.string().cuid(),
});

export const generateFlashcardsBodySchema = z.object({
  count: z.number().int().min(1).max(10).optional(),
});

// POST /flashcards/generate — genera en lote sobre un set de temas (1=individual, N=multi, todos=materia).
// Cap BAJO: son N llamadas SECUENCIALES a la IA (una por tema) → el free tier se satura con muchas (503).
// El server genera tema por tema con ÉXITO PARCIAL (conserva lo generado, reporta los temas fallidos).
export const MAX_FLASHCARD_TOPICS = 5;

export const generateFlashcardsMultiSchema = z.object({
  topicIds: z.array(z.string().cuid()).min(1).max(MAX_FLASHCARD_TOPICS),
  count: z.number().int().min(1).max(10).optional(), // por-tema (mismo tope de hoy)
});

// POST /flashcards/:id/review — calificación SM-2 (Apéndice B): Again=0, Hard=3, Good=4, Easy=5.
export const reviewFlashcardSchema = z.object({
  quality: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(5)]),
});

export const flashcardIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CreateFlashcardInput = z.infer<typeof createFlashcardSchema>;
export type UpdateFlashcardInput = z.infer<typeof updateFlashcardSchema>;
export type FlashcardListQuery = z.infer<typeof flashcardListQuerySchema>;
export type FlashcardDueQuery = z.infer<typeof flashcardDueQuerySchema>;
export type GenerateFlashcardsBody = z.infer<typeof generateFlashcardsBodySchema>;
export type GenerateFlashcardsMultiInput = z.infer<typeof generateFlashcardsMultiSchema>;
export type ReviewFlashcardInput = z.infer<typeof reviewFlashcardSchema>;
export type ReviewQuality = ReviewFlashcardInput['quality'];

import { z } from 'zod';

// Salidas JSON de la IA — validadas SIEMPRE con Zod (la IA puede devolver basura).
// Viven en apps/api (no en @bract/shared): la validación NO es compartida — solo el backend
// ve el JSON crudo del proveedor; el frontend consume las entidades ya persistidas (C/D/E).
// Structured outputs requieren objeto top-level, por eso los arrays van envueltos.

// PLAN — forma del Apéndice C: [{ date, items: [{ topicId, estimatedMinutes }] }]
const planItemSchema = z.object({
  topicId: z.string(),
  estimatedMinutes: z.number().int().positive(),
});

const planDaySchema = z.object({
  date: z.string(), // ISO yyyy-mm-dd
  items: z.array(planItemSchema),
});

export const planOutputSchema = z.object({
  days: z.array(planDaySchema),
});

export type PlanOutput = z.infer<typeof planOutputSchema>;

// FLASHCARDS — forma del Apéndice C: [{ question, answer }]
const flashcardSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const flashcardsOutputSchema = z.object({
  cards: z.array(flashcardSchema),
});

export type FlashcardsOutput = z.infer<typeof flashcardsOutputSchema>;

// JSON Schemas equivalentes para `output_config.format` (structured outputs del proveedor).
// DECISIÓN: se escriben a mano en vez de usar el helper `zodOutputFormat` del SDK, que está
// tipado contra zod v4 y el repo usa zod v3 (mismatch de tipos). El JSON que devuelve la IA
// se valida igual con los Zod de arriba (no confiamos en el structured output a ciegas).
// Sin min/max/minItems: structured outputs no soporta esas constraints; los topes van en código.
export const planJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topicId: { type: 'string' },
                estimatedMinutes: { type: 'integer' },
              },
              required: ['topicId', 'estimatedMinutes'],
              additionalProperties: false,
            },
          },
        },
        required: ['date', 'items'],
        additionalProperties: false,
      },
    },
  },
  required: ['days'],
  additionalProperties: false,
};

export const flashcardsJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
  },
  required: ['cards'],
  additionalProperties: false,
};

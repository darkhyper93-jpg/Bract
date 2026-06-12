import { Type, type Schema } from '@google/genai';
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

// `Schema` de Gemini (responseSchema + responseMimeType:'application/json') para forzar JSON.
// DECISIÓN (swap a Gemini, ver error.md): es un subset de OpenAPI 3.0 — NO admite
// `additionalProperties` (que sí usaba el JSON Schema de Anthropic); se quita. Usa el enum
// `Type` (OBJECT/ARRAY/STRING/INTEGER). El JSON crudo se valida IGUAL con los Zod de arriba
// (no confiamos en el structured output a ciegas). Sin min/max/minItems: los topes van en código.
export const planResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topicId: { type: Type.STRING },
                estimatedMinutes: { type: Type.INTEGER },
              },
              required: ['topicId', 'estimatedMinutes'],
            },
          },
        },
        required: ['date', 'items'],
      },
    },
  },
  required: ['days'],
};

export const flashcardsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
        },
        required: ['question', 'answer'],
      },
    },
  },
  required: ['cards'],
};

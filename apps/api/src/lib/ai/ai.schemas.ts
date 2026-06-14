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

// IMPORT — extracción de temas (Agente K): [{ name, difficulty }]. `difficulty` se valida como
// string laxo y se normaliza a EASY/MEDIUM/HARD en código (la IA podría devolver "media"/"medium"/
// minúsculas → no queremos que falle todo el parse). Los topes (≤50 temas, dedup) van en código.
const extractedTopicSchema = z.object({
  name: z.string().min(1),
  difficulty: z.string().min(1),
});

export const topicsOutputSchema = z.object({
  topics: z.array(extractedTopicSchema),
});

export type TopicsOutput = z.infer<typeof topicsOutputSchema>;

export const topicsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          difficulty: { type: Type.STRING },
        },
        required: ['name', 'difficulty'],
      },
    },
  },
  required: ['topics'],
};

// QUIZ — evaluación (Agente I): preguntas de opción múltiple con explicación POR OPCIÓN generada en la
// MISMA llamada (por qué la correcta lo es / por qué la distractora no) → corrección local, sin 2da
// llamada a la IA. La salida cruda se valida con el Zod de abajo + invariantes en código (correctIndex
// en rango, topicId ∈ entrada, dedup, cap). El `responseSchema` de Gemini va sin `additionalProperties`.
const quizOptionSchema = z.object({
  text: z.string().min(1),
  explanation: z.string().min(1),
});

const quizQuestionSchema = z.object({
  topicId: z.string().min(1),
  question: z.string().min(1),
  options: z.array(quizOptionSchema),
  correctIndex: z.number().int(),
});

export const quizOutputSchema = z.object({
  questions: z.array(quizQuestionSchema),
});

export type QuizOutput = z.infer<typeof quizOutputSchema>;

export const quizResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topicId: { type: Type.STRING },
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ['text', 'explanation'],
            },
          },
          correctIndex: { type: Type.INTEGER },
        },
        required: ['topicId', 'question', 'options', 'correctIndex'],
      },
    },
  },
  required: ['questions'],
};

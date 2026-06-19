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
  // Grounding: resumen fiel del material sobre ESTE tema (opcional; la IA puede omitirlo si el texto
  // casi no lo cubre). Se trimea/capa en código (dedupeAndCapTopics). NO confiamos en su largo a ciegas.
  sourceText: z.string().optional(),
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
          // Grounding (opcional, NO en `required`): excerpt fiel del material por tema. La IA puede
          // omitirlo cuando el texto casi no cubre ese tema → el tema queda sin material (genera como hoy).
          sourceText: { type: Type.STRING },
        },
        required: ['name', 'difficulty'],
      },
    },
  },
  required: ['topics'],
};

// QUIZ — evaluación (Agente I): preguntas MCQ (opción múltiple) y OPEN (respuesta corta) en la MISMA
// llamada. MCQ trae explicación POR OPCIÓN → corrección local. OPEN trae `expectedAnswer` (criterio/
// respuesta esperada, generado desde el material) → la corrección es una 2da llamada a la IA (gradeOpen)
// recién al responder. La salida cruda se valida con el Zod de abajo + invariantes en código que RAMIFICAN
// por `type` (ver validateAndCapQuiz). `type`/`options`/`correctIndex`/`expectedAnswer` son opcionales en el
// schema crudo (no todos aplican a ambos tipos); el código exige lo que corresponde a cada tipo.
const quizOptionSchema = z.object({
  text: z.string().min(1),
  explanation: z.string().min(1),
});

const quizQuestionSchema = z.object({
  type: z.string().optional(), // 'MCQ' | 'OPEN' (laxo; ausente/desconocido ⇒ MCQ, ver normalizeQuestionType)
  topicId: z.string().min(1),
  question: z.string().min(1),
  options: z.array(quizOptionSchema).optional(), // solo MCQ
  correctIndex: z.number().int().optional(), // solo MCQ
  expectedAnswer: z.string().optional(), // solo OPEN
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
          type: { type: Type.STRING }, // 'MCQ' | 'OPEN'
          topicId: { type: Type.STRING },
          question: { type: Type.STRING },
          // MCQ: opciones con explicación. OPEN no las usa (la IA las omite).
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
          correctIndex: { type: Type.INTEGER }, // MCQ
          expectedAnswer: { type: Type.STRING }, // OPEN: criterio/respuesta esperada (desde el material)
        },
        required: ['type', 'topicId', 'question'],
      },
    },
  },
  required: ['questions'],
};

// GRADE OPEN — corrección de una respuesta abierta (2da llamada a la IA, al responder). La IA evalúa el
// texto del alumno contra el material (sourceText) + la respuesta esperada, y devuelve una nota de 3
// estados + feedback. La nota cruda se valida laxa y se normaliza en código (normalizeOpenGrade): la IA
// podría devolver "correcto"/minúsculas → no queremos que falle todo el parse.
export const gradeOpenOutputSchema = z.object({
  grade: z.string().min(1),
  feedback: z.string().min(1),
});

export type GradeOpenOutput = z.infer<typeof gradeOpenOutputSchema>;

export const gradeOpenResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    grade: { type: Type.STRING }, // CORRECT | PARTIAL | INCORRECT (se normaliza en código)
    feedback: { type: Type.STRING },
  },
  required: ['grade', 'feedback'],
};

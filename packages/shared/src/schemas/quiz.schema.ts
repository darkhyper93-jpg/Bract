import { z } from 'zod';
import { QuizScope } from '../types/quiz.types';

// Evaluación / Quiz (Agente I). Schemas compartidos API↔web (fuente única de validación).
// Generar crea el intento IN_PROGRESS (POST /quiz/attempts); responder corrige de a una pregunta en el
// server (POST /quiz/attempts/:id/answers). El cliente NUNCA manda isCorrect/correctIndex/score: el
// server es la fuente de verdad (anti-trampa).

// Cantidad de preguntas por quiz. Tope duro por costo de tokens (también lo aplica la capa de IA).
export const DEFAULT_QUIZ_QUESTIONS = 5;
export const MIN_QUIZ_QUESTIONS = 1;
export const MAX_QUIZ_QUESTIONS = 10;

// ---- GENERAR (POST /quiz/attempts): scope + materia/tema destino + cantidad ----
// TOPIC requiere topicId; SUBJECT requiere subjectId.
export const generateQuizSchema = z
  .object({
    scope: z.nativeEnum(QuizScope),
    topicId: z.string().cuid().optional(),
    subjectId: z.string().cuid().optional(),
    count: z.number().int().min(MIN_QUIZ_QUESTIONS).max(MAX_QUIZ_QUESTIONS).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.scope === QuizScope.TOPIC && d.topicId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scope TOPIC requiere topicId',
        path: ['topicId'],
      });
    }
    if (d.scope === QuizScope.SUBJECT && d.subjectId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scope SUBJECT requiere subjectId',
        path: ['subjectId'],
      });
    }
  });

// ---- RESPONDER 1 pregunta (POST /quiz/attempts/:id/answers) ----
// Solo el order de la pregunta + la opción elegida. El server corrige contra el correctIndex guardado.
export const answerQuestionSchema = z.object({
  order: z.number().int().min(0),
  selectedIndex: z.number().int().min(0),
});

// ---- Listado e id de intento ----
export const quizAttemptListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const quizAttemptIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;
export type QuizAttemptListQuery = z.infer<typeof quizAttemptListQuerySchema>;

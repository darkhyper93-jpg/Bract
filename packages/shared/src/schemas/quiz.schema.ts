import { z } from 'zod';
import { ConfidenceLevel } from '../types/quiz.types';

// Evaluación / Quiz (Agente I). Schemas compartidos API↔web (fuente única de validación).
// Generar crea el intento IN_PROGRESS (POST /quiz/attempts); responder corrige de a una pregunta en el
// server (POST /quiz/attempts/:id/answers). El cliente NUNCA manda isCorrect/correctIndex/score: el
// server es la fuente de verdad (anti-trampa).

// Cantidad de preguntas por quiz. Tope duro por costo de tokens (también lo aplica la capa de IA).
export const DEFAULT_QUIZ_QUESTIONS = 5;
export const MIN_QUIZ_QUESTIONS = 1;
export const MAX_QUIZ_QUESTIONS = 10;

// Cantidad de temas elegibles en una generación. El quiz manda TODOS los temas en UNA sola llamada de IA,
// así que el tope sólo acota el tamaño del payload (no satura el free tier como sí lo haría flashcards).
export const MIN_QUIZ_TOPICS = 1;
// Tope generoso para cubrir materias reales con muchos temas (p. ej. "seleccionar todos"). El costo de IA
// lo acotan `count` y el tope total de grounding, NO la cantidad de temas elegibles; este max solo evita
// payloads absurdos. Antes era 20, lo que rompía "seleccionar todos" en materias con +20 temas.
export const MAX_QUIZ_TOPICS = 100;

// Preguntas ABIERTAS (Calidad de aprendizaje). Cada abierta respondida = 1 llamada de corrección a la IA,
// así que el tope duro de abiertas es la PALANCA DE COSTO (máx. 3 correcciones por quiz). Default 0 ⇒
// quiz idéntico a hoy (solo MCQ).
export const MAX_OPEN_QUESTIONS = 3;
// Tope del texto libre del alumno al responder una abierta (acota tokens del prompt de corrección).
export const MAX_OPEN_ANSWER_LENGTH = 2000;

// ---- GENERAR (POST /quiz/attempts): set de temas dentro de una materia + cantidad ----
// Contrato unificado: el cliente manda { subjectId, topicIds[] } y el server DERIVA el scope persistido
// (1 tema=TOPIC, todos los temas de la materia=SUBJECT, subconjunto=MULTI_TOPIC) + scopeName + topicCount.
// `openCount` = cuántas de las `count` preguntas son abiertas (default 0; tope duro MAX_OPEN_QUESTIONS).
export const generateQuizSchema = z
  .object({
    subjectId: z.string().cuid(),
    topicIds: z.array(z.string().cuid()).min(MIN_QUIZ_TOPICS).max(MAX_QUIZ_TOPICS),
    count: z.number().int().min(MIN_QUIZ_QUESTIONS).max(MAX_QUIZ_QUESTIONS).optional(),
    openCount: z.number().int().min(0).max(MAX_OPEN_QUESTIONS).optional(),
  })
  .superRefine((val, ctx) => {
    // No pidas más abiertas que el total de preguntas (si count viene; si no, el default de count lo cubre).
    if (val.count !== undefined && val.openCount !== undefined && val.openCount > val.count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['openCount'],
        message: 'openCount no puede superar count',
      });
    }
  });

// ---- RESPONDER 1 pregunta (POST /quiz/attempts/:id/answers) ----
// Una pregunta a la vez. MCQ → `selectedIndex` (el server corrige contra el correctIndex guardado);
// OPEN → `answerText` (texto libre; el server lo corrige con la IA contra el material + expectedAnswer).
// Exactamente UNO de los dos (superRefine). El server cruza el tipo con el item guardado.
// `confidence` es OPCIONAL (calibración): qué tan seguro está el alumno ANTES del reveal.
export const answerQuestionSchema = z
  .object({
    order: z.number().int().min(0),
    selectedIndex: z.number().int().min(0).optional(),
    answerText: z.string().trim().min(1).max(MAX_OPEN_ANSWER_LENGTH).optional(),
    confidence: z.nativeEnum(ConfidenceLevel).optional(),
  })
  .superRefine((val, ctx) => {
    const hasMcq = val.selectedIndex !== undefined;
    const hasOpen = val.answerText !== undefined;
    if (hasMcq === hasOpen) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mandá selectedIndex (opción múltiple) o answerText (abierta), exactamente uno',
      });
    }
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

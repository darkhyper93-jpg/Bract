import { z } from 'zod';

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
export const MAX_QUIZ_TOPICS = 20;

// ---- GENERAR (POST /quiz/attempts): set de temas dentro de una materia + cantidad ----
// Contrato unificado: el cliente manda { subjectId, topicIds[] } y el server DERIVA el scope persistido
// (1 tema=TOPIC, todos los temas de la materia=SUBJECT, subconjunto=MULTI_TOPIC) + scopeName + topicCount.
export const generateQuizSchema = z.object({
  subjectId: z.string().cuid(),
  topicIds: z.array(z.string().cuid()).min(MIN_QUIZ_TOPICS).max(MAX_QUIZ_TOPICS),
  count: z.number().int().min(MIN_QUIZ_QUESTIONS).max(MAX_QUIZ_QUESTIONS).optional(),
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

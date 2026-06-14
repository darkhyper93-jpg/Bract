import { z } from 'zod';
import { MAX_QUIZ_QUESTIONS, MIN_QUIZ_QUESTIONS } from '@bract/shared';

// Schema del formulario de setup (RHF + zodResolver). `topicId` vacío = "toda la materia" (scope
// SUBJECT); con valor = un tema (scope TOPIC). La conversión al DTO de la API vive en el componente.
export const quizSetupSchema = z.object({
  subjectId: z.string().min(1, 'subjectRequired'),
  topicId: z.string(), // '' = toda la materia
  count: z.coerce.number().int().min(MIN_QUIZ_QUESTIONS).max(MAX_QUIZ_QUESTIONS),
});

export type QuizSetupValues = z.infer<typeof quizSetupSchema>;

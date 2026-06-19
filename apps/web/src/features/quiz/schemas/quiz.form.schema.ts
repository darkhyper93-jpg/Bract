import { z } from 'zod';
import { MAX_QUIZ_QUESTIONS, MIN_QUIZ_QUESTIONS, MAX_OPEN_QUESTIONS } from '@bract/shared';

// Schema del formulario de setup (RHF + zodResolver). El alcance es un SET de temas dentro de la materia:
// 1 tema = individual, todos = toda la materia, subconjunto = multi. El server deriva el scope persistido.
// `openCount` = cuántas preguntas abiertas (0..MAX_OPEN_QUESTIONS); refine: no más abiertas que el total.
export const quizSetupSchema = z
  .object({
    subjectId: z.string().min(1, 'subjectRequired'),
    topicIds: z.array(z.string()).min(1, 'topicsRequired'),
    count: z.coerce.number().int().min(MIN_QUIZ_QUESTIONS).max(MAX_QUIZ_QUESTIONS),
    openCount: z.coerce.number().int().min(0).max(MAX_OPEN_QUESTIONS),
  })
  .refine((v) => v.openCount <= v.count, { path: ['openCount'], message: 'openCountTooHigh' });

export type QuizSetupValues = z.infer<typeof quizSetupSchema>;

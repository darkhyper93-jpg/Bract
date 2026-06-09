import { z } from 'zod';
import { TopicStatus, TopicDifficulty } from '../types/subject.types';

// Paleta cerrada de colores de materia (README §3.3: "validado por Zod contra paleta permitida").
// DECISIÓN: 8 hex curados que armonizan con los tokens del design system (§9.2, dark-first):
// brand indigo + estados (info/success/warning/error) + 3 acentos complementarios. Exportada
// para que el frontend reuse exactamente la misma paleta (swatches del selector de color).
export const SUBJECT_COLORS = [
  '#6366f1', // indigo (brand-primary §9.2)
  '#3b82f6', // blue   (info §9.2)
  '#22c55e', // green  (success §9.2)
  '#f59e0b', // amber  (warning §9.2)
  '#ef4444', // red    (error §9.2)
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];

// `examDate` admite null para "limpiar" la fecha en un update; el service la mapea a Date|null.
const subjectColor = z.enum(SUBJECT_COLORS);

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  examDate: z.string().datetime({ offset: true }).nullable().optional(),
  color: subjectColor.nullable().optional(),
});

export const updateSubjectSchema = createSubjectSchema.partial();

export const subjectIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const createTopicSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  difficulty: z.nativeEnum(TopicDifficulty).optional(),
});

export const updateTopicSchema = createTopicSchema.partial();

export const updateTopicStatusSchema = z.object({
  status: z.nativeEnum(TopicStatus),
});

// Param de la ruta anidada POST/GET /subjects/:subjectId/topics
export const subjectIdParamForTopicsSchema = z.object({
  subjectId: z.string().cuid(),
});

export const topicIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type UpdateTopicStatusInput = z.infer<typeof updateTopicStatusSchema>;

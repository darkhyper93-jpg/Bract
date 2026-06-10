import { z } from 'zod';
import { SUBJECT_COLORS, TopicDifficulty } from '@bract/shared';

// Schemas de formulario del Planificador (RHF + zodResolver). Distintos de los schemas de API
// de @bract/shared: aquí `examDate` es el `yyyy-mm-dd` del <input type="date"> (o '' = sin fecha);
// la conversión a ISO/null vive en los hooks de mutación antes de pegarle al backend.

export const subjectFormSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  examDate: z.string().optional(), // yyyy-mm-dd | ''
  color: z.enum(SUBJECT_COLORS).optional(),
});

export const topicFormSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  description: z.string().trim().max(2000, 'tooLong').optional(),
  difficulty: z.nativeEnum(TopicDifficulty),
});

// Disponibilidad: 7 entradas (Domingo..Sábado) en HORAS para la UI; los hooks convierten a minutos.
export const availabilityFormSchema = z.object({
  hours: z.array(z.number().min(0, 'min').max(24, 'max')).length(7),
});

export type SubjectFormValues = z.infer<typeof subjectFormSchema>;
export type TopicFormValues = z.infer<typeof topicFormSchema>;
export type AvailabilityFormValues = z.infer<typeof availabilityFormSchema>;

import { z } from 'zod';
import { StudyPlanItemStatus } from '../types/study.types';

// Disponibilidad: minutos por día de semana. La UI muestra horas; se guarda en minutos (§3.4).
const availabilityDaySchema = z.object({
  weekday: z.number().int().min(0).max(6), // 0=Domingo ... 6=Sábado
  minutes: z.number().int().min(0).max(1440), // 0..24h
});

// PUT bulk: set de la semana completa. Weekdays únicos (una config por día — @@unique([userId, weekday])).
export const setAvailabilitySchema = z.object({
  days: z
    .array(availabilityDaySchema)
    .max(7)
    .superRefine((days, ctx) => {
      const seen = new Set<number>();
      for (const { weekday } of days) {
        if (seen.has(weekday)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `weekday duplicado: ${weekday}`,
            path: ['days'],
          });
        }
        seen.add(weekday);
      }
    }),
});

// POST /study/plan/generate — sin body por ahora (la distribución la calcula C + IA del Agente B).
export const generatePlanSchema = z.object({}).strict();

export const updatePlanItemSchema = z.object({
  status: z.nativeEnum(StudyPlanItemStatus),
});

export const planItemIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type AvailabilityDayInput = z.infer<typeof availabilityDaySchema>;
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type UpdatePlanItemInput = z.infer<typeof updatePlanItemSchema>;

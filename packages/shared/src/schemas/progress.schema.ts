import { z } from 'zod';
import { RemediationIntensity } from '../types/progress.types';

// Progreso & Personalización (Agente I-2). Schemas compartidos API↔web (fuente única de validación).
// El progreso es solo-lectura (sin schema de escritura). El único input externo es PUT /preferences.

// Defaults de la fórmula de debilidad (README §3.6). El web los usa para mostrar el estado por defecto.
export const DEFAULT_WEIGHT_QUIZ = 0.6;
export const DEFAULT_WEIGHT_SRS = 0.4;
export const DEFAULT_REMEDIATION_INTENSITY = RemediationIntensity.LOW;

// PUT /preferences — todos los campos opcionales (upsert parcial). `null` resetea al default del motor.
export const updatePreferencesSchema = z.object({
  remediationIntensity: z.nativeEnum(RemediationIntensity).optional(),
  prioritySubjectIds: z.array(z.string().cuid()).max(50).optional(),
  weightQuiz: z.number().min(0).max(1).nullable().optional(),
  weightSrs: z.number().min(0).max(1).nullable().optional(),
  dailyGoalMinutes: z.number().int().min(0).max(1440).nullable().optional(),
});

// GET /progress/weak-topics?limit=
export const weakTopicsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type WeakTopicsQuery = z.infer<typeof weakTopicsQuerySchema>;

import { z } from 'zod';
import { RemediationIntensity } from '@bract/shared';

// Form de preferencias (v1). Incluye el multiselect de materias prioritarias (prioritySubjectIds).
export const preferencesFormSchema = z.object({
  remediationIntensity: z.nativeEnum(RemediationIntensity),
  dailyGoalMinutes: z.coerce.number().int().min(0).max(1440).nullable(),
  prioritySubjectIds: z.array(z.string().cuid()).max(50),
});

export type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

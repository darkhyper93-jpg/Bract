import { z } from 'zod';
import { MAX_IMPORT_TEXT_LENGTH } from '@bract/shared';

// Schema del formulario del paso 1 (pegar texto + elegir materia destino). RHF + zodResolver.
// `targetKind` decide cuál de los dos campos de materia es obligatorio. La conversión al DTO de la
// API (subjectId | subjectName de contexto) vive en el componente antes de extraer.
export const importInputSchema = z
  .object({
    text: z.string().trim().min(1, 'required').max(MAX_IMPORT_TEXT_LENGTH, 'tooLong'),
    targetKind: z.enum(['existing', 'new']),
    subjectId: z.string().optional(),
    newName: z.string().trim().max(120, 'tooLong').optional(),
  })
  .refine((d) => (d.targetKind === 'existing' ? Boolean(d.subjectId) : true), {
    path: ['subjectId'],
    message: 'required',
  })
  .refine((d) => (d.targetKind === 'new' ? Boolean(d.newName && d.newName.length > 0) : true), {
    path: ['newName'],
    message: 'required',
  });

export type ImportInputValues = z.infer<typeof importInputSchema>;

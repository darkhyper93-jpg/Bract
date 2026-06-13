import { z } from 'zod';
import { MAX_IMPORT_TEXT_LENGTH } from '@bract/shared';

// Schema del formulario del paso 1: elegir FUENTE (texto pegado o archivo) + materia destino. RHF +
// zodResolver. `sourceKind` decide si `text` es obligatorio (en modo archivo el File se valida aparte,
// en el componente, porque los inputs de archivo no entran en el form state de RHF). `targetKind`
// decide cuál de los dos campos de materia es obligatorio. La conversión al DTO de la API vive en el
// componente antes de extraer.
export const importInputSchema = z
  .object({
    sourceKind: z.enum(['text', 'file']),
    text: z.string().trim().max(MAX_IMPORT_TEXT_LENGTH, 'tooLong').optional(),
    targetKind: z.enum(['existing', 'new']),
    subjectId: z.string().optional(),
    newName: z.string().trim().max(120, 'tooLong').optional(),
  })
  .refine((d) => d.sourceKind !== 'text' || Boolean(d.text && d.text.length > 0), {
    path: ['text'],
    message: 'required',
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

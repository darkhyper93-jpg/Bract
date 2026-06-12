import { z } from 'zod';
import { TopicDifficulty } from '../types/subject.types';
import { ImportMode } from '../types/import.types';

// Importación masiva de temas POR TEXTO (Agente K). Schemas compartidos API↔web (fuente única de
// validación). Topes por costo de tokens / abuso: texto y cantidad de temas acotados.

// Tope de caracteres del texto pegado (presupuesto de tokens del proveedor de IA).
export const MAX_IMPORT_TEXT_LENGTH = 20000;
// Tope duro de temas por importación (también lo aplica la capa de IA al extraer).
export const MAX_IMPORT_TOPICS = 50;
// Largo máximo del nombre de un tema/materia (consistente con subject.schema: 120).
const MAX_NAME_LENGTH = 120;

// ---- EXTRACT (paso 1): texto + nombre de materia opcional (da contexto a la IA) ----
export const extractTopicsSchema = z.object({
  text: z.string().trim().min(1).max(MAX_IMPORT_TEXT_LENGTH),
  subjectName: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
});

// Tema confirmado del preview (editable por el usuario antes de commitear).
export const extractedTopicSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  difficulty: z.nativeEnum(TopicDifficulty),
});

// ---- COMMIT (paso 2): temas confirmados + materia destino + modo ----
// Materia destino = EXACTAMENTE una de: `subjectId` (existente) | `subjectName` (nueva). El modo
// decide el borrado (REPLACE), nunca la IA.
export const commitImportSchema = z
  .object({
    topics: z.array(extractedTopicSchema).min(1).max(MAX_IMPORT_TOPICS),
    mode: z.nativeEnum(ImportMode),
    subjectId: z.string().cuid().optional(),
    subjectName: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  })
  .refine((d) => (d.subjectId === undefined) !== (d.subjectName === undefined), {
    message: 'Indicá exactamente una materia destino: subjectId (existente) o subjectName (nueva)',
    path: ['subjectId'],
  });

export type ExtractTopicsInput = z.infer<typeof extractTopicsSchema>;
export type ExtractedTopicInput = z.infer<typeof extractedTopicSchema>;
export type CommitImportInput = z.infer<typeof commitImportSchema>;

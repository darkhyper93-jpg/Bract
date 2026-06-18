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
// Tope de chars del excerpt de grounding por tema (resumen fiel del material importado que la IA
// usa para anclar quiz/flashcards). Acotado por costo de tokens y crecimiento de DB. Opcional:
// un tema sin excerpt genera como hoy (name + description).
export const MAX_TOPIC_SOURCE_TEXT_LENGTH = 1500;

// ---- Importación desde ARCHIVOS (follow-up Agente K) ----
// Tope de tamaño del archivo subido (PDF/.pptx/.txt/.md). 8 MB: cubre programas/apuntes razonables
// sin volverse un vector de abuso. Lo aplica multer (memoryStorage) en el backend.
export const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;
// Tope de TEXTO extraído del archivo antes de mandarlo a la IA (cost/safety). Mayor que el del texto
// pegado porque un PDF/pptx rinde mucho más. Si se supera → se trunca y se avisa (`truncated`).
// DECISIÓN: overrideable por esta constante. El chunking para cobertura total de docs largos queda
// como mejora futura (ver error.md).
export const MAX_IMPORT_FILE_TEXT_LENGTH = 50000;

// Extensiones aceptadas (allowlist backend + atributo `accept` del input en el frontend).
export const ACCEPTED_IMPORT_FILE_EXTENSIONS = ['.pdf', '.txt', '.md', '.pptx'] as const;
export type ImportFileExtension = (typeof ACCEPTED_IMPORT_FILE_EXTENSIONS)[number];

// ---- EXTRACT (paso 1): texto + nombre de materia opcional (da contexto a la IA) ----
export const extractTopicsSchema = z.object({
  text: z.string().trim().min(1).max(MAX_IMPORT_TEXT_LENGTH),
  subjectName: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
});

// ---- EXTRACT desde ARCHIVO (paso 1, variante): campos de texto del multipart (el archivo va aparte,
// validado por multer). `subjectName` vacío del form-data se normaliza a undefined. ----
export const extractFileFieldsSchema = z.object({
  subjectName: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  ),
});

// Tema confirmado del preview (editable por el usuario antes de commitear).
// `sourceText`: excerpt de grounding fiel al material importado (lo produce la IA en el extract y
// viaja silencioso hasta el commit). Opcional y capado — ausente ⇒ el tema genera como hoy.
export const extractedTopicSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  difficulty: z.nativeEnum(TopicDifficulty),
  sourceText: z.string().trim().max(MAX_TOPIC_SOURCE_TEXT_LENGTH).optional(),
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
export type ExtractFileFieldsInput = z.infer<typeof extractFileFieldsSchema>;
export type ExtractedTopicInput = z.infer<typeof extractedTopicSchema>;
export type CommitImportInput = z.infer<typeof commitImportSchema>;

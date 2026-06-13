import apiClient from '../../../lib/axios';
import type {
  ExtractTopicsInput,
  CommitImportInput,
  ImportPreview,
  ImportCommitResult,
} from '@bract/shared';

// Capa api/ de Importación de temas (Agente K). Funciones tipadas que consumen las rutas
// /import/topics/*. Devuelven el `data` desempaquetado del envelope `{ success, data }`.

interface Envelope<T> {
  success: true;
  data: T;
}

export interface ExtractFileInput {
  file: File;
  subjectName?: string;
}

export const importApi = {
  // Paso 1 — EXTRACT: preview de temas (no escribe en DB).
  async extract(input: ExtractTopicsInput): Promise<ImportPreview> {
    const res = await apiClient.post<Envelope<ImportPreview>>('/import/topics/extract', input);
    return res.data.data;
  },

  // Paso 1 (variante ARCHIVO) — sube el archivo (multipart) y devuelve el MISMO preview.
  // DECISIÓN: el apiClient tiene un default global Content-Type: application/json, que pisaría
  // la autodetección de FormData de axios y rompería el multipart (multer no parsea → req.file
  // undefined → 400). Anulamos el header SOLO en esta request para que el browser ponga
  // `multipart/form-data` con su boundary. Usamos `null` (no `undefined`) porque axios lo trata
  // igual —`toJSON` descarta los headers con valor null/undefined antes de enviarlos— y `null`
  // sí es un valor válido del tipo de header (compatible con `exactOptionalPropertyTypes`).
  // El resto de requests JSON no se ven afectadas.
  async extractFile(input: ExtractFileInput): Promise<ImportPreview> {
    const form = new FormData();
    form.append('file', input.file);
    if (input.subjectName) form.append('subjectName', input.subjectName);
    const res = await apiClient.post<Envelope<ImportPreview>>('/import/topics/extract-file', form, {
      headers: { 'Content-Type': null },
    });
    return res.data.data;
  },

  // Paso 2 — COMMIT: persiste los temas confirmados (add/replace) y devuelve la materia + conteos.
  async commit(input: CommitImportInput): Promise<ImportCommitResult> {
    const res = await apiClient.post<Envelope<ImportCommitResult>>('/import/topics/commit', input);
    return res.data.data;
  },
};

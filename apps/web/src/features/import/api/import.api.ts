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

  // Paso 1 (variante ARCHIVO) — sube el archivo (multipart) y devuelve el MISMO preview. axios pone
  // el Content-Type con boundary solo al recibir un FormData.
  async extractFile(input: ExtractFileInput): Promise<ImportPreview> {
    const form = new FormData();
    form.append('file', input.file);
    if (input.subjectName) form.append('subjectName', input.subjectName);
    const res = await apiClient.post<Envelope<ImportPreview>>('/import/topics/extract-file', form);
    return res.data.data;
  },

  // Paso 2 — COMMIT: persiste los temas confirmados (add/replace) y devuelve la materia + conteos.
  async commit(input: CommitImportInput): Promise<ImportCommitResult> {
    const res = await apiClient.post<Envelope<ImportCommitResult>>('/import/topics/commit', input);
    return res.data.data;
  },
};

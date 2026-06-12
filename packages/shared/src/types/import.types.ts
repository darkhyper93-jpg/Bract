// Producto — Importación masiva de temas POR TEXTO (Agente K) — IDEAS_POST_MVP §"Agente K".
// Flujo en 2 pasos con PREVIEW: (1) EXTRACT (la IA extrae temas + dificultad, NO escribe en DB) →
// (2) COMMIT (los temas confirmados + materia destino + modo se persisten). El borrado lo decide
// el MODE (toggle de UI), NUNCA la IA interpretando intención. Reusa Subject/Topic (§3.3) — sin
// modelos nuevos.

import type { Subject, TopicDifficulty } from './subject.types';

// Modo de commit: cómo se aplica el lote sobre la materia destino. NO es un enum de Prisma —
// es un concepto de request (toggle de UI). El borrado SOLO ocurre en REPLACE.
export enum ImportMode {
  ADD = 'ADD', // agrega sin borrar, deduplicando contra los temas existentes
  REPLACE = 'REPLACE', // borra los temas existentes y reemplaza por el lote
}

// Tema extraído por la IA: nombre + dificultad clasificada (EASY/MEDIUM/HARD). Editable en el
// preview antes de confirmar.
export interface ExtractedTopic {
  name: string;
  difficulty: TopicDifficulty;
}

// Respuesta del EXTRACT: el preview de temas (no se escribió nada en DB).
export interface ImportPreview {
  topics: ExtractedTopic[];
}

// Respuesta del COMMIT: la materia destino + cuántos temas se crearon / se omitieron por dedup.
export interface ImportCommitResult {
  subject: Subject;
  createdCount: number;
  skippedCount: number;
  mode: ImportMode;
}

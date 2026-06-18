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
// `sourceText`: excerpt de grounding (resumen fiel del material importado, ≤MAX_TOPIC_SOURCE_TEXT_LENGTH)
// que la IA produce en la MISMA extracción. Viaja preview→commit y se persiste en Topic. Opcional:
// si falta (texto sin material para ese tema, o tema creado a mano), la generación cae al comportamiento
// de hoy (name + description).
export interface ExtractedTopic {
  name: string;
  difficulty: TopicDifficulty;
  sourceText?: string;
}

// Respuesta del EXTRACT: el preview de temas (no se escribió nada en DB).
// `truncated` (importación desde archivo): true si el texto extraído superó el tope y se recortó
// antes de mandarlo a la IA → el frontend lo muestra como aviso. La importación por texto lo omite.
export interface ImportPreview {
  topics: ExtractedTopic[];
  truncated?: boolean;
}

// Respuesta del COMMIT: la materia destino + cuántos temas se crearon / se omitieron por dedup.
export interface ImportCommitResult {
  subject: Subject;
  createdCount: number;
  skippedCount: number;
  mode: ImportMode;
}

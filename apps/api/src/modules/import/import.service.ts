import type { Prisma, Subject as PrismaSubject, Topic as PrismaTopic } from '@prisma/client';
import { ImportMode } from '@bract/shared';
import type {
  CommitImportInput,
  ExtractTopicsInput,
  ImportCommitResult,
  ImportPreview,
  Subject,
} from '@bract/shared';
import { extractTopics } from '../../lib/ai/index.js';
import { AppError } from '../../lib/errors.js';
import { importRepository } from './import.repository.js';

// ============================================================================
// Importación masiva de temas POR TEXTO (Agente K) — lógica de negocio. Recibe DTOs (nunca req),
// orquesta la IA (extracción) y la persistencia (merge). El borrado lo decide el MODE, NUNCA la IA.
// ============================================================================

// Mapper Prisma → contrato @bract/shared (Date→ISO). Mismo patrón que planner/notification.
function toSubject(s: PrismaSubject): Subject {
  return {
    id: s.id,
    userId: s.userId,
    name: s.name,
    examDate: s.examDate ? s.examDate.toISOString() : null,
    color: s.color,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// Clave de dedup: minúsculas + espacios colapsados. Estable para comparar nombres de temas.
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export const importService = {
  // Paso 1 — EXTRACT: la IA extrae temas + dificultad. NO escribe en DB (es un preview).
  // Inherente a IA: `extractTopics` lanza AI_UNAVAILABLE (503) si falta AI_API_KEY.
  async extractPreview(input: ExtractTopicsInput): Promise<ImportPreview> {
    const topics = await extractTopics({
      text: input.text,
      ...(input.subjectName !== undefined ? { subjectName: input.subjectName } : {}),
    });
    return { topics };
  },

  // Paso 2 — COMMIT: persiste los temas confirmados sobre la materia destino.
  // - subjectName → crea materia nueva. subjectId → materia existente del usuario (ownership).
  // - mode ADD → agrega deduplicando contra los temas existentes (no borra).
  // - mode REPLACE → borra los temas existentes y reemplaza por el lote.
  async commitImport(userId: string, input: CommitImportInput): Promise<ImportCommitResult> {
    let subject: PrismaSubject;
    let existingNames: string[];

    if (input.subjectId !== undefined) {
      const row = await importRepository.findSubjectWithTopicNames(input.subjectId, userId);
      if (!row) throw new AppError('NOT_FOUND', 'Materia no encontrada');
      subject = row;
      existingNames = row.topics.map((t) => t.name);
    } else if (input.subjectName !== undefined) {
      subject = await importRepository.createSubject(userId, input.subjectName);
      existingNames = [];
    } else {
      // Inalcanzable: el schema garantiza exactamente una materia destino. Guard por type-safety.
      throw new AppError('VALIDATION_ERROR', 'Falta la materia destino');
    }

    const replace = input.mode === ImportMode.REPLACE;
    // En REPLACE borramos los previos → el set de dedup arranca vacío. En ADD dedup contra existentes.
    const seen = new Set<string>(replace ? [] : existingNames.map(normalizeName));

    const rows: Prisma.TopicCreateManyInput[] = [];
    let skippedCount = 0;
    for (const topic of input.topics) {
      const name = topic.name.trim();
      const key = normalizeName(name);
      if (key.length === 0 || seen.has(key)) {
        skippedCount += 1;
        continue;
      }
      seen.add(key);
      rows.push({
        subjectId: subject.id,
        userId, // denormalizado al crear; nunca se transfiere (§3.4)
        name,
        difficulty: topic.difficulty as PrismaTopic['difficulty'],
      });
    }

    const createdCount = await importRepository.applyImport(subject.id, replace, rows);
    return { subject: toSubject(subject), createdCount, skippedCount, mode: input.mode };
  },
};

import { prisma } from '../../prisma/client.js';
import type { Prisma, Subject as PrismaSubject } from '@prisma/client';

// Importación masiva de temas POR TEXTO (Agente K) — capa de Prisma. Self-contained: el commit
// crea materias/temas con su `userId` denormalizado (§3.4) y, en REPLACE, borra los temas previos
// de la materia (su cascade limpia las flashcards de esos temas). No toca el módulo planner.

// Materia + solo los NOMBRES de sus temas (para deduplicar en modo ADD, sin traer toda la fila).
export type SubjectWithTopicNamesRow = PrismaSubject & { topics: { name: string }[] };

export const importRepository = {
  // Ownership + temas existentes (nombres) para dedup. null si la materia no es del usuario.
  findSubjectWithTopicNames(
    subjectId: string,
    userId: string,
  ): Promise<SubjectWithTopicNamesRow | null> {
    return prisma.subject.findFirst({
      where: { id: subjectId, userId },
      include: { topics: { select: { name: true } } },
    });
  },

  createSubject(userId: string, name: string): Promise<PrismaSubject> {
    return prisma.subject.create({ data: { userId, name } });
  },

  // Aplica el lote sobre la materia. `replace` borra los temas existentes ANTES de crear (el modo,
  // no la IA, decide el borrado). Devuelve cuántos temas se crearon. Atómico (transacción).
  async applyImport(
    subjectId: string,
    replace: boolean,
    rows: Prisma.TopicCreateManyInput[],
  ): Promise<number> {
    return prisma.$transaction(async (tx) => {
      if (replace) {
        await tx.topic.deleteMany({ where: { subjectId } });
      }
      if (rows.length === 0) return 0;
      const created = await tx.topic.createMany({ data: rows });
      return created.count;
    });
  },
};

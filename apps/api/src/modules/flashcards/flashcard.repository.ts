import { prisma } from '../../prisma/client.js';
import type { Prisma, Flashcard, TopicDifficulty } from '@prisma/client';
import { SRS_PAUSED_DUE_DATE, SRS_PAUSED_THRESHOLD } from './srs.js';

// Carta due + contexto de su tema/materia en UNA query (include topic→subject select name).
// Hot-path del SRS: índice @@index([userId, dueDate]). Sin N+1.
export type FlashcardWithTopicRow = Flashcard & {
  topic: { id: string; name: string; subject: { name: string } };
};

// Contexto del tema para validar ownership y alimentar la generación con IA (Agente B).
export type TopicContextRow = {
  id: string;
  name: string;
  description: string | null;
  sourceText: string | null; // grounding: excerpt fiel del material importado (NULL ⇒ genera como hoy)
  difficulty: TopicDifficulty;
  userId: string;
  subject: { name: string };
};

export const flashcardRepository = {
  // ---- Lectura ----
  // Cartas de un tema (paginado). Ownership por userId denormalizado (§3.4), sin join.
  findManyByTopicPaged(
    userId: string,
    topicId: string,
    page: number,
    perPage: number,
  ): Promise<Flashcard[]> {
    return prisma.flashcard.findMany({
      where: { userId, topicId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
  },

  countByTopic(userId: string, topicId: string): Promise<number> {
    return prisma.flashcard.count({ where: { userId, topicId } });
  },

  // Cartas due del usuario (dueDate ≤ now), las más vencidas primero. Incluye tema+materia.
  findDueWithTopic(userId: string, now: Date, limit: number): Promise<FlashcardWithTopicRow[]> {
    return prisma.flashcard.findMany({
      where: { userId, dueDate: { lte: now } },
      orderBy: { dueDate: 'asc' },
      take: limit,
      include: { topic: { select: { id: true, name: true, subject: { select: { name: true } } } } },
    });
  },

  // Ownership directo por userId denormalizado (§3.4).
  findByIdAndUser(id: string, userId: string): Promise<Flashcard | null> {
    return prisma.flashcard.findFirst({ where: { id, userId } });
  },

  // Tema + materia + owner: valida pertenencia del tema antes de crear/generar cartas.
  findTopicContext(topicId: string, userId: string): Promise<TopicContextRow | null> {
    return prisma.topic.findFirst({
      where: { id: topicId, userId },
      select: {
        id: true,
        name: true,
        description: true,
        sourceText: true,
        difficulty: true,
        userId: true,
        subject: { select: { name: true } },
      },
    });
  },

  // ---- Escritura ----
  create(data: Prisma.FlashcardUncheckedCreateInput): Promise<Flashcard> {
    return prisma.flashcard.create({ data });
  },

  // Inserta el lote generado por IA y DEVUELVE las cartas creadas. `createMany` de Prisma no
  // retorna registros, así que se usa una transacción de creates (lote acotado ≤10, Apéndice C).
  createManyReturning(rows: Prisma.FlashcardUncheckedCreateInput[]): Promise<Flashcard[]> {
    return prisma.$transaction(rows.map((data) => prisma.flashcard.create({ data })));
  },

  update(id: string, data: Prisma.FlashcardUpdateInput): Promise<Flashcard> {
    return prisma.flashcard.update({ where: { id }, data });
  },

  // ---- Rotación SRS por tema (Agente F — efecto de Topic.status) ----
  // Pausa: saca de la rotación las cartas ACTIVAS del tema (dueDate → centinela). Idempotente:
  // solo toca las que aún no están pausadas (`dueDate < umbral`). NO modifica ease/intervalDays/reps.
  // Ownership por userId denormalizado (§3.4). Devuelve cuántas cartas movió.
  async pauseSrsByTopic(userId: string, topicId: string): Promise<number> {
    const res = await prisma.flashcard.updateMany({
      where: { userId, topicId, dueDate: { lt: SRS_PAUSED_THRESHOLD } },
      data: { dueDate: SRS_PAUSED_DUE_DATE },
    });
    return res.count;
  },

  // Activa: reincorpora a la rotación SOLO las cartas PAUSADAS del tema (centinela → `now`),
  // dejando intacto el schedule de las que ya estaban activas (no pisa repasos reales).
  async activateSrsByTopic(userId: string, topicId: string, now: Date): Promise<number> {
    const res = await prisma.flashcard.updateMany({
      where: { userId, topicId, dueDate: { gte: SRS_PAUSED_THRESHOLD } },
      data: { dueDate: now },
    });
    return res.count;
  },

  async deleteById(id: string): Promise<void> {
    await prisma.flashcard.delete({ where: { id } });
  },
};

import { prisma } from '../../prisma/client.js';

// Repositorio de progreso (I-2). SOLO Prisma, sin lógica de negocio. Agrega con groupBy sobre los índices
// existentes (§3.5: [userId, topicId, isCorrect]; flashcards: [userId, dueDate]) — NO trae todo a memoria.
// 4 queries de costo constante (sin N+1): árbol materias/temas, quiz por tema, SRS por tema, vencidas por tema.

export interface QuizStatRow {
  topicId: string;
  answered: number;
  correct: number;
}

export interface SrsStatRow {
  topicId: string;
  totalCards: number;
  dueCards: number;
  avgEase: number | null;
}

export interface SubjectTreeRow {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
}

export const progressRepository = {
  // Árbol materias→temas del usuario (nombres para el overview/weak-topics). select explícito (sin over-fetch).
  async getSubjectTree(userId: string): Promise<SubjectTreeRow[]> {
    return prisma.subject.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        topics: { select: { id: true, name: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  // % de acierto por tema: agrupado por [topicId, isCorrect], solo ítems contestados (selectedIndex != null)
  // y con topicId. Se colapsa a {answered, correct} por tema en una sola pasada.
  async getQuizStatsByTopic(userId: string): Promise<QuizStatRow[]> {
    const rows = await prisma.quizAttemptItem.groupBy({
      by: ['topicId', 'isCorrect'],
      where: { userId, selectedIndex: { not: null }, topicId: { not: null } },
      _count: true,
      orderBy: { topicId: 'asc' },
    });

    const map = new Map<string, { answered: number; correct: number }>();
    for (const r of rows) {
      const topicId = r.topicId as string; // topicId != null por el where
      const count = r._count as number; // Prisma 5.22 tipa _count como unión; en runtime es number
      const acc = map.get(topicId) ?? { answered: 0, correct: 0 };
      acc.answered += count;
      if (r.isCorrect) acc.correct += count;
      map.set(topicId, acc);
    }
    return [...map.entries()].map(([topicId, v]) => ({ topicId, ...v }));
  },

  // Estado SRS por tema: total + ease promedio (un groupBy) y vencidas (otro groupBy con where dueDate<=now).
  async getSrsStatsByTopic(userId: string, now: Date): Promise<SrsStatRow[]> {
    const [totals, due] = await Promise.all([
      prisma.flashcard.groupBy({
        by: ['topicId'],
        where: { userId },
        _count: true,
        _avg: { ease: true },
        orderBy: { topicId: 'asc' },
      }),
      prisma.flashcard.groupBy({
        by: ['topicId'],
        where: { userId, dueDate: { lte: now } },
        _count: true,
        orderBy: { topicId: 'asc' },
      }),
    ]);

    const dueMap = new Map(due.map((d) => [d.topicId, d._count as number]));
    return totals.map((t) => ({
      topicId: t.topicId,
      totalCards: t._count as number,
      dueCards: dueMap.get(t.topicId) ?? 0,
      avgEase: t._avg.ease,
    }));
  },
};

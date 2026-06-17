import { prisma } from '../../prisma/client.js';
import { QuizAttemptStatus } from '@prisma/client';
import type { Prisma, QuizAttempt, QuizAttemptItem } from '@prisma/client';

// Evaluación / Quiz (Agente I) — solo queries Prisma (sin lógica de negocio ni HTTP). Self-contained:
// no importa los repos del planner; hace sus propias queries scopeadas por userId (§3.4).

// Contexto de una materia + TODOS sus temas. Único query de contexto de generación: el contrato unifica
// el alcance en un set de temas dentro de una materia, y traer todos los temas permite validar ownership +
// pertenencia y DERIVAR el scope (1=TOPIC, todos=SUBJECT, subconjunto=MULTI_TOPIC) en el service.
export type QuizSubjectContextRow = {
  id: string;
  name: string;
  topics: { id: string; name: string; description: string | null }[];
};

export type QuizAttemptWithItemsRow = QuizAttempt & { items: QuizAttemptItem[] };

export const quizRepository = {
  // ---- Contexto / ownership (para GENERAR) ----
  // Materia + sus temas (un solo include, sin N+1). Ownership por userId denormalizado (§3.4).
  findSubjectContext(subjectId: string, userId: string): Promise<QuizSubjectContextRow | null> {
    return prisma.subject.findFirst({
      where: { id: subjectId, userId },
      select: {
        id: true,
        name: true,
        topics: {
          select: { id: true, name: true, description: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  // ---- Generación: crear el intento IN_PROGRESS + sus items (nested create transaccional) ----
  createAttemptWithItems(
    attempt: Prisma.QuizAttemptUncheckedCreateInput,
    items: Prisma.QuizAttemptItemUncheckedCreateWithoutAttemptInput[],
  ): Promise<QuizAttemptWithItemsRow> {
    return prisma.quizAttempt.create({
      data: { ...attempt, items: { create: items } },
      include: { items: { orderBy: { order: 'asc' } } },
    });
  },

  // ---- Responder 1 pregunta ----
  // Ownership del intento (por userId). Solo el id (el grading no necesita el resto).
  findAttemptOwned(id: string, userId: string): Promise<{ id: string } | null> {
    return prisma.quizAttempt.findFirst({ where: { id, userId }, select: { id: true } });
  },

  // La pregunta a responder (por order dentro del intento). Índice [attemptId, order].
  findItemByOrder(attemptId: string, order: number): Promise<QuizAttemptItem | null> {
    return prisma.quizAttemptItem.findFirst({ where: { attemptId, order } });
  },

  // Persiste la respuesta de un item y mantiene los agregados del intento de forma atómica.
  // LOCK ATÓMICO anti-trampa: el update es CONDICIONAL (`where selectedIndex: null`) → si otra request
  // ya respondió esa pregunta (carrera de doble-respuesta), `updateMany` afecta 0 filas, devolvemos
  // `false` y NO recalculamos nada (no infla el puntaje ni en 1). Solo si afectó 1 fila se recalcula
  // correctCount (por COUNT, no por increment) y, si no quedan preguntas sin responder, se marca
  // COMPLETED. La verdad del grading (isCorrect) la decide el service y la pasa acá.
  async recordAnswer(
    attemptId: string,
    itemId: string,
    selectedIndex: number,
    isCorrect: boolean,
    now: Date,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const res = await tx.quizAttemptItem.updateMany({
        where: { id: itemId, selectedIndex: null },
        data: { selectedIndex, isCorrect },
      });
      if (res.count === 0) return false; // ya respondida (carrera) → no aplica, no recalcula
      const correctCount = await tx.quizAttemptItem.count({
        where: { attemptId, isCorrect: true },
      });
      const unanswered = await tx.quizAttemptItem.count({
        where: { attemptId, selectedIndex: null },
      });
      await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          correctCount,
          ...(unanswered === 0
            ? { status: QuizAttemptStatus.COMPLETED, completedAt: now }
            : {}),
        },
      });
      return true;
    });
  },

  // ---- Lectura (historial) ----
  // Historial = intentos COMPLETED del usuario (los IN_PROGRESS no se listan).
  findManyCompletedByUserPaged(
    userId: string,
    page: number,
    perPage: number,
  ): Promise<QuizAttempt[]> {
    return prisma.quizAttempt.findMany({
      where: { userId, status: QuizAttemptStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
  },

  countCompletedByUser(userId: string): Promise<number> {
    return prisma.quizAttempt.count({
      where: { userId, status: QuizAttemptStatus.COMPLETED },
    });
  },

  // Intento + items (sin N+1: un include). Ownership por userId.
  findByIdAndUserWithItems(id: string, userId: string): Promise<QuizAttemptWithItemsRow | null> {
    return prisma.quizAttempt.findFirst({
      where: { id, userId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
  },
};

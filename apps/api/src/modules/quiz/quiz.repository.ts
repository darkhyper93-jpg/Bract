import { prisma } from '../../prisma/client.js';
import { QuizAttemptStatus, OpenGrade } from '@prisma/client';
import type {
  ConfidenceLevel,
  Prisma,
  QuizAttempt,
  QuizAttemptItem,
} from '@prisma/client';

// Evaluación / Quiz (Agente I) — solo queries Prisma (sin lógica de negocio ni HTTP). Self-contained:
// no importa los repos del planner; hace sus propias queries scopeadas por userId (§3.4).

// Contexto de una materia + TODOS sus temas. Único query de contexto de generación: el contrato unifica
// el alcance en un set de temas dentro de una materia, y traer todos los temas permite validar ownership +
// pertenencia y DERIVAR el scope (1=TOPIC, todos=SUBJECT, subconjunto=MULTI_TOPIC) en el service.
export type QuizSubjectContextRow = {
  id: string;
  name: string;
  // sourceText: grounding por tema (NULL ⇒ ese tema genera como hoy). Ver lib/ai/buildQuizUserPrompt.
  topics: { id: string; name: string; description: string | null; sourceText: string | null }[];
};

export type QuizAttemptWithItemsRow = QuizAttempt & { items: QuizAttemptItem[] };

// Item + el sourceText de su tema (para anclar la corrección de una abierta al material). El tema puede
// ser null (FK SetNull si se borró) → grading solo contra expectedAnswer (degradación suave).
export type QuizAttemptItemWithTopicRow = QuizAttemptItem & {
  topic: { sourceText: string | null } | null;
};

// Recalcula los agregados del intento DENTRO de una transacción tras aplicar una respuesta (MCQ u OPEN):
// correctCount por COUNT (no increment) y, si no quedan preguntas SIN responder, marca COMPLETED.
// "Sin responder" = sin selectedIndex (MCQ) Y sin studentAnswer (OPEN) — una abierta respondida tiene
// selectedIndex null pero studentAnswer no-null, así que mirar solo selectedIndex la dejaría afuera.
async function recomputeAttemptAggregates(
  tx: Prisma.TransactionClient,
  attemptId: string,
  now: Date,
): Promise<void> {
  const correctCount = await tx.quizAttemptItem.count({
    where: { attemptId, isCorrect: true },
  });
  const unanswered = await tx.quizAttemptItem.count({
    where: { attemptId, selectedIndex: null, studentAnswer: null },
  });
  await tx.quizAttempt.update({
    where: { id: attemptId },
    data: {
      correctCount,
      ...(unanswered === 0 ? { status: QuizAttemptStatus.COMPLETED, completedAt: now } : {}),
    },
  });
}

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
          select: { id: true, name: true, description: true, sourceText: true },
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

  // La pregunta a responder (por order dentro del intento). Índice [attemptId, order]. Trae el sourceText
  // del tema (include) para que el service pueda anclar la corrección de una abierta al material.
  findItemByOrder(attemptId: string, order: number): Promise<QuizAttemptItemWithTopicRow | null> {
    return prisma.quizAttemptItem.findFirst({
      where: { attemptId, order },
      include: { topic: { select: { sourceText: true } } },
    });
  },

  // Persiste la respuesta MCQ de un item y mantiene los agregados del intento de forma atómica.
  // LOCK ATÓMICO anti-trampa: el update es CONDICIONAL (`where selectedIndex: null`) → si otra request
  // ya respondió esa pregunta (carrera de doble-respuesta), `updateMany` afecta 0 filas, devolvemos
  // `false` y NO recalculamos nada (no infla el puntaje ni en 1). Solo si afectó 1 fila se recalculan
  // los agregados. La verdad del grading (isCorrect) la decide el service y la pasa acá.
  async recordAnswer(
    attemptId: string,
    itemId: string,
    selectedIndex: number,
    isCorrect: boolean,
    now: Date,
    confidence?: ConfidenceLevel,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const res = await tx.quizAttemptItem.updateMany({
        where: { id: itemId, selectedIndex: null },
        // confidence solo se persiste si el alumno la declaró (calibración opcional).
        data: { selectedIndex, isCorrect, ...(confidence !== undefined ? { confidence } : {}) },
      });
      if (res.count === 0) return false; // ya respondida (carrera) → no aplica, no recalcula
      await recomputeAttemptAggregates(tx, attemptId, now);
      return true;
    });
  },

  // GUARDA la respuesta ABIERTA al instante, SIN nota (grade=null=pendiente) — desacople registrar↔corregir.
  // LOCK ATÓMICO anti-trampa (espeja recordAnswer): el update es CONDICIONAL (`where studentAnswer: null`)
  // → si dos respuestas simultáneas corren, solo UNA afecta una fila; la otra ve 0 filas y devolvemos
  // `false` (CONFLICT, no infla nada). NO toca grade/feedback/isCorrect: quedan en su default (null/null/
  // false) hasta que la corrección (gradeOpenAnswer, aparte) los complete. Igual recalcula los agregados:
  // una abierta pendiente YA cuenta como respondida (si era la última, el intento pasa a COMPLETED).
  async recordOpenAnswerPending(
    attemptId: string,
    itemId: string,
    studentAnswer: string,
    now: Date,
    confidence?: ConfidenceLevel,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const res = await tx.quizAttemptItem.updateMany({
        where: { id: itemId, studentAnswer: null },
        // confidence solo se persiste si el alumno la declaró (calibración opcional).
        data: { studentAnswer, ...(confidence !== undefined ? { confidence } : {}) },
      });
      if (res.count === 0) return false; // ya respondida (carrera) → no aplica, no recalcula
      await recomputeAttemptAggregates(tx, attemptId, now);
      return true;
    });
  },

  // Completa la NOTA de una abierta ya respondida (corrección aparte, con reintento del lado cliente).
  // IDEMPOTENTE/seguro: el update es CONDICIONAL (`where grade: null`) → si otra request (o un doble
  // disparo del front) ya corrigió el item, afecta 0 filas, devolvemos `false` y NO re-grabamos ni
  // recalculamos. isCorrect ya viene derivado del grade (true SOLO si CORRECT) desde el service. Solo si
  // aplicó la nota (1 fila) recalculamos los agregados (correctCount con el nuevo acierto pleno).
  async recordOpenGrade(
    attemptId: string,
    itemId: string,
    grade: OpenGrade,
    feedback: string,
    isCorrect: boolean,
    now: Date,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const res = await tx.quizAttemptItem.updateMany({
        where: { id: itemId, grade: null },
        data: { grade, feedback, isCorrect },
      });
      if (res.count === 0) return false; // ya corregida (carrera/doble disparo) → no re-aplica
      await recomputeAttemptAggregates(tx, attemptId, now);
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

  // Nº de abiertas PARTIAL por intento (para el puntaje con crédito parcial del historial). UN solo groupBy
  // sobre los intentos de la página (sin N+1, sin traer items). El resto de los grades/MCQ no entran.
  async countPartialByAttempt(attemptIds: string[]): Promise<Map<string, number>> {
    if (attemptIds.length === 0) return new Map();
    const rows = await prisma.quizAttemptItem.groupBy({
      by: ['attemptId'],
      where: { attemptId: { in: attemptIds }, grade: OpenGrade.PARTIAL },
      _count: true,
    });
    return new Map(rows.map((r) => [r.attemptId, r._count as number]));
  },

  // Intento + items (sin N+1: un include). Ownership por userId.
  findByIdAndUserWithItems(id: string, userId: string): Promise<QuizAttemptWithItemsRow | null> {
    return prisma.quizAttempt.findFirst({
      where: { id, userId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
  },
};

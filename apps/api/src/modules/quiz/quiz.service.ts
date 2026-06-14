import type {
  Prisma,
  QuizAttempt as PrismaQuizAttempt,
  QuizAttemptItem as PrismaQuizAttemptItem,
} from '@prisma/client';
import { QuizScope, QuizAttemptStatus } from '@bract/shared';
import type {
  AnswerQuestionInput,
  AnswerReveal,
  GeneratedAttempt,
  GenerateQuizInput,
  PublicQuizQuestion,
  QuizAttempt,
  QuizAttemptItem,
  QuizAttemptListQuery,
  QuizAttemptWithItems,
  QuizOption,
} from '@bract/shared';
import { generateQuiz } from '../../lib/ai/index.js';
import type { GenerateQuizInput as AiGenerateQuizInput } from '../../lib/ai/index.js';
import { AppError } from '../../lib/errors.js';
import { quizRepository } from './quiz.repository.js';
import type { QuizAttemptWithItemsRow } from './quiz.repository.js';

// ============================================================================
// Evaluación / Quiz (Agente I) — lógica de negocio. Recibe DTOs (nunca req), mapea Prisma→shared
// (Date→ISO, enums casteados, Json→tipos), valida ownership, orquesta la generación con IA (lib/ai,
// Agente B) y hace la CORRECCIÓN POR PREGUNTA server-side (fuente de verdad, anti-trampa). NO toca HTTP.
// ============================================================================

const TOPIC_NOT_FOUND = 'Tema no encontrado';
const SUBJECT_NOT_FOUND = 'Materia no encontrada';
const ATTEMPT_NOT_FOUND = 'Intento no encontrado';
const SUBJECT_NO_TOPICS = 'La materia no tiene temas para generar el quiz';
const QUESTION_NOT_FOUND = 'Pregunta inexistente';
const QUESTION_ALREADY_ANSWERED = 'La pregunta ya fue respondida';
const INVALID_OPTION = 'Opción inválida';

// ---- Mappers Prisma → contrato @bract/shared ------------------------------
// DECISIÓN: cast de enum Prisma → enum compartido (mismatch nominal de TS); mismo patrón que
// role/status/type en el resto de los services (ver napkin / error.md).

// DECISIÓN: `options` se persiste como Json (snapshot autoritativo). Al leer, Prisma lo tipa como
// JsonValue → cast al tipo del contrato (se validó al generar; no se re-valida en lectura).
function optionsOf(it: PrismaQuizAttemptItem): QuizOption[] {
  return it.options as unknown as QuizOption[];
}

function toQuizAttempt(a: PrismaQuizAttempt): QuizAttempt {
  return {
    id: a.id,
    userId: a.userId,
    scope: a.scope as QuizScope,
    status: a.status as QuizAttemptStatus,
    subjectId: a.subjectId,
    topicId: a.topicId,
    scopeName: a.scopeName,
    totalCount: a.totalCount,
    correctCount: a.correctCount,
    completedAt: a.completedAt ? a.completedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

function toQuizAttemptItem(it: PrismaQuizAttemptItem): QuizAttemptItem {
  return {
    id: it.id,
    attemptId: it.attemptId,
    userId: it.userId,
    topicId: it.topicId,
    order: it.order,
    question: it.question,
    options: optionsOf(it),
    correctIndex: it.correctIndex,
    selectedIndex: it.selectedIndex,
    isCorrect: it.isCorrect,
    createdAt: it.createdAt.toISOString(),
  };
}

// Pregunta PÚBLICA: SOLO el texto de cada opción (sin correctIndex ni explicación) — anti-trampa.
function toPublicQuestion(it: PrismaQuizAttemptItem): PublicQuizQuestion {
  return {
    order: it.order,
    topicId: it.topicId,
    question: it.question,
    options: optionsOf(it).map((o) => ({ text: o.text })),
  };
}

function toGeneratedAttempt(row: QuizAttemptWithItemsRow): GeneratedAttempt {
  return {
    attemptId: row.id,
    scope: row.scope as QuizScope,
    subjectId: row.subjectId,
    topicId: row.topicId,
    scopeName: row.scopeName,
    totalCount: row.totalCount,
    questions: row.items.map(toPublicQuestion),
  };
}

export const quizService = {
  // ---- Generar: crear el intento IN_PROGRESS (llama a la IA PRIMERO; si falla no persiste nada) ----
  async generate(userId: string, input: GenerateQuizInput): Promise<GeneratedAttempt> {
    let aiInput: AiGenerateQuizInput;
    let subjectId: string | null;
    let topicId: string | null;
    let scopeName: string;

    if (input.scope === QuizScope.TOPIC) {
      // El schema garantiza topicId presente en scope TOPIC.
      const topic = await quizRepository.findTopicContext(input.topicId as string, userId);
      if (!topic) throw new AppError('NOT_FOUND', TOPIC_NOT_FOUND);
      subjectId = topic.subjectId;
      topicId = topic.id;
      scopeName = topic.name;
      aiInput = {
        scope: 'TOPIC',
        subjectName: topic.subject.name,
        topics: [{ id: topic.id, name: topic.name, description: topic.description }],
        ...(input.count !== undefined ? { count: input.count } : {}),
      };
    } else {
      const subject = await quizRepository.findSubjectContext(input.subjectId as string, userId);
      if (!subject) throw new AppError('NOT_FOUND', SUBJECT_NOT_FOUND);
      if (subject.topics.length === 0) throw new AppError('VALIDATION_ERROR', SUBJECT_NO_TOPICS);
      subjectId = subject.id;
      topicId = null;
      scopeName = subject.name;
      aiInput = {
        scope: 'SUBJECT',
        subjectName: subject.name,
        topics: subject.topics,
        ...(input.count !== undefined ? { count: input.count } : {}),
      };
    }

    // IA PRIMERO: si falla (sin key / salida inválida) lanza AI_UNAVAILABLE y NO se persiste nada.
    const generated = await generateQuiz(aiInput);

    // Persistir el intento IN_PROGRESS con correctIndex + explicaciones AUTORITATIVOS (en el server).
    const items: Prisma.QuizAttemptItemUncheckedCreateWithoutAttemptInput[] = generated.map(
      (q, idx) => ({
        userId, // denormalizado (§3.4); topicId proviene de la IA (∈ temas del usuario, ver lib/ai)
        topicId: q.topicId,
        order: idx,
        question: q.question,
        options: q.options as unknown as Prisma.InputJsonValue, // [{ text, explanation }] autoritativo
        correctIndex: q.correctIndex,
        // selectedIndex queda null (sin responder); isCorrect default false.
      }),
    );

    const attempt: Prisma.QuizAttemptUncheckedCreateInput = {
      userId,
      scope: input.scope as PrismaQuizAttempt['scope'],
      // status default IN_PROGRESS
      subjectId,
      topicId,
      scopeName,
      totalCount: items.length,
      correctCount: 0,
    };

    const created = await quizRepository.createAttemptWithItems(attempt, items);
    return toGeneratedAttempt(created);
  },

  // ---- Responder 1 pregunta: corrección server-side + lock anti-trampa ----
  async answer(
    attemptId: string,
    userId: string,
    input: AnswerQuestionInput,
  ): Promise<AnswerReveal> {
    const attempt = await quizRepository.findAttemptOwned(attemptId, userId);
    if (!attempt) throw new AppError('NOT_FOUND', ATTEMPT_NOT_FOUND);

    const item = await quizRepository.findItemByOrder(attemptId, input.order);
    if (!item) throw new AppError('VALIDATION_ERROR', QUESTION_NOT_FOUND);

    // LOCK anti-trampa: si ya tiene selectedIndex, no se re-responde.
    if (item.selectedIndex !== null) throw new AppError('CONFLICT', QUESTION_ALREADY_ANSWERED);

    const options = optionsOf(item);
    if (input.selectedIndex >= options.length) {
      throw new AppError('VALIDATION_ERROR', INVALID_OPTION);
    }

    // GRADING: la verdad es el correctIndex GUARDADO (un selectedIndex tramposo no infla el puntaje).
    const isCorrect = input.selectedIndex === item.correctIndex;
    // El lock real es atómico en la DB (update condicional): si la carrera lo ganó otra request,
    // `recordAnswer` devuelve false → CONFLICT (defense-in-depth con el chequeo de arriba).
    const applied = await quizRepository.recordAnswer(
      attemptId,
      item.id,
      input.selectedIndex,
      isCorrect,
      new Date(),
    );
    if (!applied) throw new AppError('CONFLICT', QUESTION_ALREADY_ANSWERED);

    // Reveal SOLO de esta pregunta (recién acá viajan correctIndex + explicaciones).
    return { order: item.order, isCorrect, correctIndex: item.correctIndex, options };
  },

  // ---- Lectura (historial COMPLETED) ----
  async listAttempts(
    userId: string,
    query: QuizAttemptListQuery,
  ): Promise<{ attempts: QuizAttempt[]; total: number }> {
    const [rows, total] = await Promise.all([
      quizRepository.findManyCompletedByUserPaged(userId, query.page, query.perPage),
      quizRepository.countCompletedByUser(userId),
    ]);
    return { attempts: rows.map(toQuizAttempt), total };
  },

  async getAttempt(id: string, userId: string): Promise<QuizAttemptWithItems> {
    const attempt = await quizRepository.findByIdAndUserWithItems(id, userId);
    if (!attempt) throw new AppError('NOT_FOUND', ATTEMPT_NOT_FOUND);
    return { ...toQuizAttempt(attempt), items: attempt.items.map(toQuizAttemptItem) };
  },
};

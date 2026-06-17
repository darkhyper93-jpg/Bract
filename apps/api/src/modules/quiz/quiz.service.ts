import type {
  ConfidenceLevel as PrismaConfidenceLevel,
  Prisma,
  QuizAttempt as PrismaQuizAttempt,
  QuizAttemptItem as PrismaQuizAttemptItem,
} from '@prisma/client';
import { QuizScope, QuizAttemptStatus, ConfidenceLevel } from '@bract/shared';
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
import { GENERATION_ERRORS } from '../../config/constants.js';
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
// Mensaje canónico compartido (contrato uniforme — README §5.6).
const SUBJECT_NO_TOPICS = GENERATION_ERRORS.SUBJECT_NO_TOPICS;
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
    topicCount: a.topicCount,
    totalCount: a.totalCount,
    correctCount: a.correctCount,
    completedAt: a.completedAt ? a.completedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

// Item del DETALLE (GET /quiz/attempts/:id), con anti-trampa al reanudar: el server es la fuente de
// verdad. Si la pregunta YA fue contestada (selectedIndex !== null) se devuelve completa (opciones con
// explicación, correctIndex, selectedIndex, isCorrect). Si NO fue contestada, se devuelve PÚBLICA
// (opciones solo con text, correctIndex=null, isCorrect=false) — no se puede espiar la respuesta de las
// preguntas pendientes de un intento IN_PROGRESS. En un intento COMPLETED todos están contestados → todos
// completos (sin cambio visible).
function toDetailItem(it: PrismaQuizAttemptItem): QuizAttemptItem {
  const base = {
    id: it.id,
    attemptId: it.attemptId,
    userId: it.userId,
    topicId: it.topicId,
    order: it.order,
    question: it.question,
    createdAt: it.createdAt.toISOString(),
  };

  if (it.selectedIndex !== null) {
    // Contestada: detalle completo (recién acá viajan correctIndex + explicaciones).
    return {
      ...base,
      options: optionsOf(it),
      correctIndex: it.correctIndex,
      selectedIndex: it.selectedIndex,
      isCorrect: it.isCorrect,
      confidence: it.confidence as ConfidenceLevel | null,
    };
  }

  // Sin contestar: vista PÚBLICA (sin correctIndex ni explicación). confidence solo existe al responder.
  return {
    ...base,
    options: optionsOf(it).map((o) => ({ text: o.text })),
    correctIndex: null,
    selectedIndex: null,
    isCorrect: false,
    confidence: null,
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
    topicCount: row.topicCount,
    totalCount: row.totalCount,
    questions: row.items.map(toPublicQuestion),
  };
}

export const quizService = {
  // ---- Generar: crear el intento IN_PROGRESS (llama a la IA PRIMERO; si falla no persiste nada) ----
  // Contrato unificado: el cliente manda { subjectId, topicIds[] } y el server DERIVA el scope persistido
  // (1=TOPIC, todos los temas de la materia=SUBJECT, subconjunto=MULTI_TOPIC) + scopeName + topicCount.
  // La granularidad fina (I-2) no cambia: cada QuizAttemptItem sigue cayendo en su topicId.
  async generate(userId: string, input: GenerateQuizInput): Promise<GeneratedAttempt> {
    // Un solo query: materia + TODOS sus temas (scopeado por userId → valida ownership de la materia).
    const subject = await quizRepository.findSubjectContext(input.subjectId, userId);
    if (!subject) throw new AppError('NOT_FOUND', SUBJECT_NOT_FOUND);
    if (subject.topics.length === 0) throw new AppError('VALIDATION_ERROR', SUBJECT_NO_TOPICS);

    // Dedup defensivo + validación de que TODOS los temas pedidos pertenecen a la materia (y al usuario).
    const topicsById = new Map(subject.topics.map((t) => [t.id, t]));
    const uniqueIds = [...new Set(input.topicIds)];
    const selected = uniqueIds.map((id) => topicsById.get(id));
    if (selected.some((t) => t === undefined)) throw new AppError('NOT_FOUND', TOPIC_NOT_FOUND);
    const topics = selected as { id: string; name: string; description: string | null }[];

    // DERIVAR scope/topicId/scopeName/topicCount. scopeName = NOMBRE PROPIO (tema o materia); el front
    // compone "N temas de X" usando scope + topicCount (la app es bilingüe). topicId solo vive en TOPIC.
    const topicCount = topics.length;
    let scope: QuizScope;
    let topicId: string | null;
    let scopeName: string;
    if (topicCount === 1) {
      scope = QuizScope.TOPIC;
      topicId = topics[0]!.id;
      scopeName = topics[0]!.name;
    } else if (topicCount === subject.topics.length) {
      // El set cubre toda la materia → SUBJECT (caso borde: materia de 1 tema cae en TOPIC, arriba).
      scope = QuizScope.SUBJECT;
      topicId = null;
      scopeName = subject.name;
    } else {
      scope = QuizScope.MULTI_TOPIC;
      topicId = null;
      scopeName = subject.name;
    }

    // El `scope` que recibe la IA es solo el label del prompt (un tema vs varios temas); lo que importa
    // es la lista de temas (el subconjunto). MULTI_TOPIC se etiqueta como "varios temas", igual que SUBJECT.
    const aiInput: AiGenerateQuizInput = {
      scope: topicCount === 1 ? 'TOPIC' : 'SUBJECT',
      subjectName: subject.name,
      topics,
      ...(input.count !== undefined ? { count: input.count } : {}),
    };

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
      scope: scope as PrismaQuizAttempt['scope'],
      // status default IN_PROGRESS
      subjectId: subject.id,
      topicId,
      scopeName,
      topicCount,
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
      // calibración opcional: solo se persiste si el alumno la declaró. Cast enum shared→Prisma
      // (mismatch nominal de TS; mismo patrón que scope/status en este archivo).
      input.confidence === undefined
        ? undefined
        : (input.confidence as PrismaConfidenceLevel),
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
    return { ...toQuizAttempt(attempt), items: attempt.items.map(toDetailItem) };
  },
};

import type {
  ConfidenceLevel as PrismaConfidenceLevel,
  OpenGrade as PrismaOpenGrade,
  Prisma,
  QuizAttempt as PrismaQuizAttempt,
  QuizAttemptItem as PrismaQuizAttemptItem,
} from '@prisma/client';
import { QuizScope, QuizAttemptStatus, ConfidenceLevel, QuestionType, OpenGrade } from '@bract/shared';
import type {
  AnswerQuestionInput,
  AnswerReveal,
  GeneratedAttempt,
  GenerateQuizInput,
  GradeOpenItemInput,
  PublicQuizQuestion,
  QuizAttempt,
  QuizAttemptItem,
  QuizAttemptListQuery,
  QuizAttemptWithItems,
  QuizOption,
} from '@bract/shared';
import { generateQuiz, gradeOpenAnswer } from '../../lib/ai/index.js';
import type { GenerateQuizInput as AiGenerateQuizInput } from '../../lib/ai/index.js';
import { AppError } from '../../lib/errors.js';
import { GENERATION_ERRORS } from '../../config/constants.js';
import { quizRepository } from './quiz.repository.js';
import type { QuizAttemptWithItemsRow } from './quiz.repository.js';
import { gamificationEffects, safeGamify } from '../gamification/gamification.effects.js';

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
const MISSING_SELECTED_INDEX = 'Falta selectedIndex para una pregunta de opción múltiple';
const MISSING_ANSWER_TEXT = 'Falta answerText para una pregunta abierta';
const UNGRADABLE_OPEN = 'No se puede corregir esta pregunta (sin criterio)';
const NOT_OPEN_QUESTION = 'Solo las preguntas abiertas se corrigen con IA';
const QUESTION_NOT_ANSWERED = 'La pregunta todavía no fue respondida';

// ---- Mappers Prisma → contrato @bract/shared ------------------------------
// DECISIÓN: cast de enum Prisma → enum compartido (mismatch nominal de TS); mismo patrón que
// role/status/type en el resto de los services (ver napkin / error.md).

// DECISIÓN: `options` se persiste como Json (snapshot autoritativo). Al leer, Prisma lo tipa como
// JsonValue → cast al tipo del contrato (se validó al generar; no se re-valida en lectura).
function optionsOf(it: PrismaQuizAttemptItem): QuizOption[] {
  return it.options as unknown as QuizOption[];
}

// `partialCount` se DERIVA en lectura (no es columna): lo provee el caller (groupBy en el listado, conteo
// en memoria en el detalle). Default 0 para cualquier lectura que no necesite el puntaje parcial.
function toQuizAttempt(a: PrismaQuizAttempt, partialCount = 0): QuizAttempt {
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
    partialCount,
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
  const type = it.type as QuestionType;
  const base = {
    id: it.id,
    attemptId: it.attemptId,
    userId: it.userId,
    type,
    topicId: it.topicId,
    order: it.order,
    question: it.question,
    createdAt: it.createdAt.toISOString(),
  };

  // "Contestada" abarca ambos tipos: MCQ tiene selectedIndex, OPEN tiene studentAnswer (selectedIndex null).
  const answered = it.selectedIndex !== null || it.studentAnswer !== null;

  if (!answered) {
    // Sin contestar: vista PÚBLICA. MCQ → opciones solo con texto; OPEN → []. NUNCA viaja correctIndex,
    // explicación, expectedAnswer ni feedback (anti-trampa). confidence/grade solo existen al responder.
    return {
      ...base,
      options: type === QuestionType.OPEN ? [] : optionsOf(it).map((o) => ({ text: o.text })),
      correctIndex: null,
      selectedIndex: null,
      isCorrect: false,
      confidence: null,
      studentAnswer: null,
      grade: null,
      feedback: null,
      expectedAnswer: null,
    };
  }

  if (type === QuestionType.OPEN) {
    // Abierta contestada. Si todavía está PENDIENTE de corrección (grade null), viaja SOLO el texto del
    // alumno: el criterio (expectedAnswer) y la devolución de la IA siguen server-only hasta que llega la
    // nota (consistente con el reveal; el front muestra "Evaluando…" y reintenta la corrección aparte).
    const graded = it.grade !== null;
    return {
      ...base,
      options: [], // OPEN no tiene opciones
      correctIndex: null,
      selectedIndex: null,
      isCorrect: it.isCorrect,
      confidence: it.confidence as ConfidenceLevel | null,
      studentAnswer: it.studentAnswer,
      grade: it.grade as OpenGrade | null,
      feedback: graded ? it.feedback : null,
      expectedAnswer: graded ? it.expectedAnswer : null,
    };
  }

  // MCQ contestada: detalle completo (recién acá viajan correctIndex + explicaciones).
  return {
    ...base,
    options: optionsOf(it),
    correctIndex: it.correctIndex,
    selectedIndex: it.selectedIndex,
    isCorrect: it.isCorrect,
    confidence: it.confidence as ConfidenceLevel | null,
    studentAnswer: null,
    grade: null,
    feedback: null,
    expectedAnswer: null,
  };
}

// Pregunta PÚBLICA: lo que ve el cliente mientras responde. MCQ → SOLO el texto de cada opción (sin
// correctIndex ni explicación). OPEN → opciones vacías (el alumno escribe libre; el criterio nunca viaja).
function toPublicQuestion(it: PrismaQuizAttemptItem): PublicQuizQuestion {
  const type = it.type as QuestionType;
  return {
    order: it.order,
    type,
    topicId: it.topicId,
    question: it.question,
    options: type === QuestionType.OPEN ? [] : optionsOf(it).map((o) => ({ text: o.text })),
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
    // sourceText (grounding) viaja hasta el aiInput; el tope total en multi-tema lo aplica lib/ai.
    const topics = selected as {
      id: string;
      name: string;
      description: string | null;
      sourceText: string | null;
    }[];

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
      ...(input.openCount !== undefined ? { openCount: input.openCount } : {}),
    };

    // IA PRIMERO: si falla (sin key / salida inválida) lanza AI_UNAVAILABLE y NO se persiste nada.
    const generated = await generateQuiz(aiInput);

    // Persistir el intento IN_PROGRESS con los snapshots AUTORITATIVOS (server-side). MCQ: options +
    // correctIndex. OPEN: expectedAnswer (criterio server-only, NUNCA viaja antes de responder) + options [].
    const items: Prisma.QuizAttemptItemUncheckedCreateWithoutAttemptInput[] = generated.map(
      (q, idx) => {
        const base = {
          userId, // denormalizado (§3.4); topicId proviene de la IA (∈ temas del usuario, ver lib/ai)
          topicId: q.topicId,
          type: q.type as PrismaQuizAttemptItem['type'],
          order: idx,
          question: q.question,
          // selectedIndex/studentAnswer quedan null (sin responder); isCorrect default false.
        };
        if (q.type === QuestionType.OPEN) {
          return {
            ...base,
            options: [] as unknown as Prisma.InputJsonValue, // OPEN no usa opciones
            correctIndex: null,
            expectedAnswer: q.expectedAnswer, // criterio AUTORITATIVO server-only
          };
        }
        return {
          ...base,
          options: q.options as unknown as Prisma.InputJsonValue, // [{ text, explanation }] autoritativo
          correctIndex: q.correctIndex,
        };
      },
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
  // Ramifica por el TIPO del item guardado (no por lo que mande el cliente). MCQ: corrige contra el
  // correctIndex guardado. OPEN: corrige el texto con la IA, anclada al material + expectedAnswer (ambos
  // server-only). En los dos casos el reveal recién acá expone la respuesta/criterio.
  async answer(
    attemptId: string,
    userId: string,
    input: AnswerQuestionInput,
  ): Promise<AnswerReveal> {
    const attempt = await quizRepository.findAttemptOwned(attemptId, userId);
    if (!attempt) throw new AppError('NOT_FOUND', ATTEMPT_NOT_FOUND);

    const item = await quizRepository.findItemByOrder(attemptId, input.order);
    if (!item) throw new AppError('VALIDATION_ERROR', QUESTION_NOT_FOUND);

    // calibración opcional: solo se persiste si el alumno la declaró. Cast enum shared→Prisma
    // (mismatch nominal de TS; mismo patrón que scope/status en este archivo).
    const confidence =
      input.confidence === undefined ? undefined : (input.confidence as PrismaConfidenceLevel);

    if ((item.type as QuestionType) === QuestionType.OPEN) {
      // LOCK anti-trampa OPEN: si ya tiene studentAnswer, no se re-responde.
      if (item.studentAnswer !== null) throw new AppError('CONFLICT', QUESTION_ALREADY_ANSWERED);
      const answerText = input.answerText?.trim();
      if (answerText === undefined || answerText.length === 0) {
        throw new AppError('VALIDATION_ERROR', MISSING_ANSWER_TEXT);
      }
      if (item.expectedAnswer === null) {
        // No debería pasar (toda OPEN se genera con criterio); si faltara, no hay con qué corregir.
        throw new AppError('VALIDATION_ERROR', UNGRADABLE_OPEN);
      }

      // DESACOPLE registrar↔corregir: responder GUARDA la respuesta al instante (grade=null=pendiente) y
      // NO depende de la IA → nunca falla por una caída de la IA. La corrección corre APARTE
      // (gradeOpenItem / POST :id/grade) con reintento del cliente. El lock anti-trampa se mantiene
      // (studentAnswer != null ⇒ no se re-responde) gracias al update atómico condicional del repo.
      const applied = await quizRepository.recordOpenAnswerPending(
        attemptId,
        item.id,
        answerText,
        new Date(),
        confidence,
      );
      if (!applied) throw new AppError('CONFLICT', QUESTION_ALREADY_ANSWERED);

      // Gamificación (best-effort): registrar una abierta es PARTICIPACIÓN (la maestría llega al CORREGIR
      // → onOpenGraded). Si esta respuesta completó el intento, suma el bonus de "quiz completado".
      await safeGamify(async () => {
        const st = await quizRepository.getAttemptStatus(attemptId);
        await gamificationEffects.onQuizAnswered(userId, {
          isCorrect: false,
          topicId: item.topicId,
          attemptCompleted: st?.status === QuizAttemptStatus.COMPLETED,
        });
      });

      // Reveal PENDIENTE: solo confirma el registro. El criterio (expectedAnswer) y la devolución de la
      // IA siguen server-only hasta que llegue la nota (se exponen juntos al corregir, como en MCQ).
      return {
        type: QuestionType.OPEN,
        order: item.order,
        isCorrect: false,
        grade: null,
        feedback: null,
        expectedAnswer: null,
      };
    }

    // ---- MCQ ----
    // LOCK anti-trampa: si ya tiene selectedIndex, no se re-responde.
    if (item.selectedIndex !== null) throw new AppError('CONFLICT', QUESTION_ALREADY_ANSWERED);
    const selectedIndex = input.selectedIndex;
    if (selectedIndex === undefined) {
      throw new AppError('VALIDATION_ERROR', MISSING_SELECTED_INDEX);
    }
    if (item.correctIndex === null) {
      // MCQ siempre tiene correctIndex (invariante de generación); guarda defensiva para el narrowing.
      throw new AppError('VALIDATION_ERROR', INVALID_OPTION);
    }

    const options = optionsOf(item);
    if (selectedIndex >= options.length) {
      throw new AppError('VALIDATION_ERROR', INVALID_OPTION);
    }

    // GRADING: la verdad es el correctIndex GUARDADO (un selectedIndex tramposo no infla el puntaje).
    const isCorrect = selectedIndex === item.correctIndex;
    // El lock real es atómico en la DB (update condicional): si la carrera lo ganó otra request,
    // `recordAnswer` devuelve false → CONFLICT (defense-in-depth con el chequeo de arriba).
    const applied = await quizRepository.recordAnswer(
      attemptId,
      item.id,
      selectedIndex,
      isCorrect,
      new Date(),
      confidence,
    );
    if (!applied) throw new AppError('CONFLICT', QUESTION_ALREADY_ANSWERED);

    // Gamificación (best-effort): XP por responder + bonus si CORRECTA (daño al jefe si el tema coincide);
    // bonus de "quiz completado" si esta respuesta cerró el intento.
    await safeGamify(async () => {
      const st = await quizRepository.getAttemptStatus(attemptId);
      await gamificationEffects.onQuizAnswered(userId, {
        isCorrect,
        topicId: item.topicId,
        attemptCompleted: st?.status === QuizAttemptStatus.COMPLETED,
      });
    });

    // Reveal SOLO de esta pregunta (recién acá viajan correctIndex + explicaciones).
    return { type: QuestionType.MCQ, order: item.order, isCorrect, correctIndex: item.correctIndex, options };
  },

  // ---- Corregir 1 abierta respondida (corrección server-side, anclada al material) ----
  // Va APARTE de responder: el cliente lo dispara tras registrar (o lo reintenta) hasta que llega la nota.
  // SEGURO/IDEMPOTENTE: solo corrige un item OPEN ya respondido (studentAnswer != null) y SIN nota
  // (grade == null); si ya está corregido devuelve el reveal existente sin re-llamar a la IA. Si la IA
  // falla transitoriamente NO tira error: deja el ítem pendiente y devuelve un reveal pendiente (el
  // cliente reintenta). El criterio (expectedAnswer) recién se expone acá, al completarse la nota.
  async gradeOpenItem(
    attemptId: string,
    userId: string,
    input: GradeOpenItemInput,
  ): Promise<AnswerReveal> {
    const attempt = await quizRepository.findAttemptOwned(attemptId, userId);
    if (!attempt) throw new AppError('NOT_FOUND', ATTEMPT_NOT_FOUND);

    const item = await quizRepository.findItemByOrder(attemptId, input.order);
    if (!item) throw new AppError('VALIDATION_ERROR', QUESTION_NOT_FOUND);
    if ((item.type as QuestionType) !== QuestionType.OPEN) {
      throw new AppError('VALIDATION_ERROR', NOT_OPEN_QUESTION);
    }
    // Debe estar respondida (registramos primero, corregimos después). Sin texto no hay qué corregir.
    if (item.studentAnswer === null) throw new AppError('VALIDATION_ERROR', QUESTION_NOT_ANSWERED);
    if (item.expectedAnswer === null) throw new AppError('VALIDATION_ERROR', UNGRADABLE_OPEN);

    // Ya corregida (grade != null): idempotente, devolvemos el reveal completo SIN re-llamar a la IA.
    if (item.grade !== null) {
      return {
        type: QuestionType.OPEN,
        order: item.order,
        isCorrect: item.isCorrect,
        grade: item.grade as OpenGrade,
        feedback: item.feedback ?? '',
        expectedAnswer: item.expectedAnswer,
      };
    }

    // Corrección con IA (mantiene su withAIRetry interno), anclada al material (sourceText) + criterio.
    let graded: { grade: OpenGrade; feedback: string };
    try {
      graded = await gradeOpenAnswer({
        question: item.question,
        expectedAnswer: item.expectedAnswer,
        sourceText: item.topic?.sourceText ?? null,
        studentAnswer: item.studentAnswer,
      });
    } catch (err) {
      // Falla TRANSITORIA de la IA (AI_UNAVAILABLE): NO tiramos error — el ítem queda pendiente y el
      // cliente reintenta. Cualquier otro error (bug, etc.) se propaga normal.
      if (err instanceof AppError && err.code === 'AI_UNAVAILABLE') {
        return {
          type: QuestionType.OPEN,
          order: item.order,
          isCorrect: false,
          grade: null,
          feedback: null,
          expectedAnswer: null,
        };
      }
      throw err;
    }

    // isCorrect deriva del grade: true SOLO si CORRECT (PARTIAL/INCORRECT ⇒ false → cuenta como débil en I-2).
    const isCorrect = graded.grade === OpenGrade.CORRECT;
    // Update condicional (WHERE grade: null): si otra corrección ganó la carrera, no re-aplica.
    const graded2 = await quizRepository.recordOpenGrade(
      attemptId,
      item.id,
      graded.grade as PrismaOpenGrade,
      graded.feedback,
      isCorrect,
      new Date(),
    );

    // Gamificación (best-effort): SOLO si esta corrección aplicó la nota (graded2) → bonus por DOMINIO
    // (CORRECT/PARTIAL) + daño al jefe si CORRECT. La racha NO se toca acá (ya contó al RESPONDER).
    if (graded2) {
      await safeGamify(() =>
        gamificationEffects.onOpenGraded(userId, { grade: graded.grade, topicId: item.topicId }),
      );
    }

    // Reveal completo: recién acá viajan grade + feedback + expectedAnswer.
    return {
      type: QuestionType.OPEN,
      order: item.order,
      isCorrect,
      grade: graded.grade,
      feedback: graded.feedback,
      expectedAnswer: item.expectedAnswer,
    };
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
    // partialCount derivado en lote (un groupBy sobre la página) → puntaje con crédito parcial en el historial.
    const partials = await quizRepository.countPartialByAttempt(rows.map((r) => r.id));
    return { attempts: rows.map((r) => toQuizAttempt(r, partials.get(r.id) ?? 0)), total };
  },

  async getAttempt(id: string, userId: string): Promise<QuizAttemptWithItems> {
    const attempt = await quizRepository.findByIdAndUserWithItems(id, userId);
    if (!attempt) throw new AppError('NOT_FOUND', ATTEMPT_NOT_FOUND);
    // Detalle: los items ya están en memoria → contamos las abiertas PARTIAL acá (sin query extra).
    const partialCount = attempt.items.filter(
      (it) => (it.grade as OpenGrade | null) === OpenGrade.PARTIAL,
    ).length;
    return { ...toQuizAttempt(attempt, partialCount), items: attempt.items.map(toDetailItem) };
  },
};

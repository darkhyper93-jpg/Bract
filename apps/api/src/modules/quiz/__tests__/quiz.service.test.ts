import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizAttemptItem as PrismaQuizAttemptItem } from '@prisma/client';
import { QuizScope } from '@bract/shared';
import { AppError } from '../../../lib/errors.js';

// Mockeamos el repo (Prisma) y la capa de IA: el service corre real, sin DB ni red.
vi.mock('../quiz.repository.js', () => ({
  quizRepository: {
    findSubjectContext: vi.fn(),
    createAttemptWithItems: vi.fn(),
    findAttemptOwned: vi.fn(),
    findItemByOrder: vi.fn(),
    recordAnswer: vi.fn(),
    recordOpenAnswerPending: vi.fn(),
    recordOpenGrade: vi.fn(),
    findManyCompletedByUserPaged: vi.fn(),
    countCompletedByUser: vi.fn(),
    findByIdAndUserWithItems: vi.fn(),
  },
}));
vi.mock('../../../lib/ai/index.js', () => ({
  generateQuiz: vi.fn(),
  gradeOpenAnswer: vi.fn(),
}));

import { quizRepository } from '../quiz.repository.js';
import { generateQuiz, gradeOpenAnswer } from '../../../lib/ai/index.js';
import { quizService } from '../quiz.service.js';

const now = new Date('2026-06-13T00:00:00.000Z');

// Opciones COMPLETAS (text + explanation) para un item persistido.
const fullOpts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ text: `o${i}`, explanation: `e${i}` }));

// Item persistido (fila Prisma) para los tests de answer. Default MCQ; los campos OPEN van null
// (retrocompat con filas viejas). Los tests de abiertas overridean type + expectedAnswer + topic.
function makeItem(over: Partial<PrismaQuizAttemptItem> = {}): PrismaQuizAttemptItem {
  return {
    id: 'i0',
    attemptId: 'att1',
    userId: 'u1',
    type: 'MCQ',
    topicId: 't1',
    order: 0,
    question: 'P1',
    // options es Json en Prisma; el service lo castea al leer.
    options: fullOpts(4) as unknown as PrismaQuizAttemptItem['options'],
    correctIndex: 2,
    selectedIndex: null,
    isCorrect: false,
    confidence: null,
    studentAnswer: null,
    grade: null,
    feedback: null,
    expectedAnswer: null,
    createdAt: now,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // record* aplican por defecto (true = afectó la fila). Los tests de carrera los overridean.
  vi.mocked(quizRepository.recordAnswer).mockResolvedValue(true);
  vi.mocked(quizRepository.recordOpenAnswerPending).mockResolvedValue(true);
  vi.mocked(quizRepository.recordOpenGrade).mockResolvedValue(true);
});

describe('generate', () => {
  // Materia con 3 temas — el universo para derivar el scope desde el set de topicIds.
  const subjectCtx = {
    id: 's1',
    name: 'Mate',
    topics: [
      { id: 't1', name: 'Integrales', description: 'apuntes' },
      { id: 't2', name: 'Derivadas', description: null },
      { id: 't3', name: 'Límites', description: null },
    ],
  };

  // Mock de persistencia: refleja el attempt recibido (incluye el scope/topicCount DERIVADOS).
  const mockCreate = () =>
    vi.mocked(quizRepository.createAttemptWithItems).mockImplementation((attempt, items) =>
      Promise.resolve({
        id: 'att1',
        userId: attempt.userId,
        scope: attempt.scope,
        status: 'IN_PROGRESS',
        subjectId: attempt.subjectId ?? null,
        topicId: attempt.topicId ?? null,
        scopeName: attempt.scopeName,
        topicCount: attempt.topicCount ?? 1,
        totalCount: attempt.totalCount,
        correctCount: attempt.correctCount,
        completedAt: null,
        createdAt: now,
        items: items.map((it, i) => ({
          id: `i${i}`,
          attemptId: 'att1',
          userId: it.userId,
          type: it.type ?? 'MCQ',
          topicId: it.topicId ?? null,
          order: it.order,
          question: it.question,
          options: it.options,
          correctIndex: it.correctIndex ?? null,
          selectedIndex: it.selectedIndex ?? null,
          isCorrect: it.isCorrect ?? false,
          confidence: null,
          studentAnswer: it.studentAnswer ?? null,
          grade: null,
          feedback: null,
          expectedAnswer: it.expectedAnswer ?? null,
          createdAt: now,
        })),
      }),
    );

  const oneQuestion = (topicId: string) => [
    {
      type: 'MCQ' as const,
      topicId,
      question: '¿Qué es una integral?',
      options: [
        { text: 'a', explanation: 'correcta' },
        { text: 'b', explanation: 'mal' },
      ],
      correctIndex: 0,
    },
  ];

  it('1 tema → DERIVA scope TOPIC: valida ownership, persiste correctIndex AUTORITATIVO, devuelve preguntas PÚBLICAS', async () => {
    vi.mocked(quizRepository.findSubjectContext).mockResolvedValue(subjectCtx);
    vi.mocked(generateQuiz).mockResolvedValue(oneQuestion('t1'));
    mockCreate();

    const result = await quizService.generate('u1', { subjectId: 's1', topicIds: ['t1'] });

    // A la IA viaja el label 'TOPIC' (un solo tema) + el subconjunto pedido.
    expect(generateQuiz).toHaveBeenCalledWith({
      scope: 'TOPIC',
      subjectName: 'Mate',
      topics: [{ id: 't1', name: 'Integrales', description: 'apuntes' }],
    });
    // scope/scopeName/topicId/topicCount DERIVADOS por el server (no vienen del cliente).
    const [attempt, items] = vi.mocked(quizRepository.createAttemptWithItems).mock.calls[0]!;
    expect(attempt).toMatchObject({
      userId: 'u1',
      scope: 'TOPIC',
      subjectId: 's1',
      topicId: 't1',
      scopeName: 'Integrales',
      topicCount: 1,
      totalCount: 1,
      correctCount: 0,
    });
    expect(items[0]).toMatchObject({ userId: 'u1', type: 'MCQ', topicId: 't1', order: 0, correctIndex: 0 });
    expect((items[0]!.options as unknown as { explanation: string }[])[0]!.explanation).toBe(
      'correcta',
    );

    // La respuesta al cliente es PÚBLICA: sin correctIndex, opciones SOLO con text.
    expect(result).toEqual({
      attemptId: 'att1',
      scope: QuizScope.TOPIC,
      subjectId: 's1',
      topicId: 't1',
      scopeName: 'Integrales',
      topicCount: 1,
      totalCount: 1,
      questions: [
        { order: 0, type: 'MCQ', topicId: 't1', question: '¿Qué es una integral?', options: [{ text: 'a' }, { text: 'b' }] },
      ],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('correctIndex');
    expect(serialized).not.toContain('explanation');
  });

  it('subconjunto de temas → DERIVA scope MULTI_TOPIC (topicId null, scopeName = materia, topicCount = N)', async () => {
    vi.mocked(quizRepository.findSubjectContext).mockResolvedValue(subjectCtx);
    vi.mocked(generateQuiz).mockResolvedValue(oneQuestion('t2'));
    mockCreate();

    await quizService.generate('u1', { subjectId: 's1', topicIds: ['t1', 't2'] });

    // A la IA: label 'SUBJECT' (varios temas) + SOLO el subconjunto elegido (no toda la materia).
    expect(generateQuiz).toHaveBeenCalledWith({
      scope: 'SUBJECT',
      subjectName: 'Mate',
      topics: [
        { id: 't1', name: 'Integrales', description: 'apuntes' },
        { id: 't2', name: 'Derivadas', description: null },
      ],
    });
    const [attempt] = vi.mocked(quizRepository.createAttemptWithItems).mock.calls[0]!;
    expect(attempt).toMatchObject({
      scope: 'MULTI_TOPIC',
      subjectId: 's1',
      topicId: null,
      scopeName: 'Mate',
      topicCount: 2,
    });
  });

  it('todos los temas de la materia → DERIVA scope SUBJECT (topicId null, scopeName = materia)', async () => {
    vi.mocked(quizRepository.findSubjectContext).mockResolvedValue(subjectCtx);
    vi.mocked(generateQuiz).mockResolvedValue(oneQuestion('t1'));
    mockCreate();

    await quizService.generate('u1', { subjectId: 's1', topicIds: ['t1', 't2', 't3'] });

    const [attempt] = vi.mocked(quizRepository.createAttemptWithItems).mock.calls[0]!;
    expect(attempt).toMatchObject({
      scope: 'SUBJECT',
      subjectId: 's1',
      topicId: null,
      scopeName: 'Mate',
      topicCount: 3,
    });
  });

  it('topicIds duplicados → se deduplican (no infla topicCount ni cambia el scope derivado)', async () => {
    vi.mocked(quizRepository.findSubjectContext).mockResolvedValue(subjectCtx);
    vi.mocked(generateQuiz).mockResolvedValue(oneQuestion('t1'));
    mockCreate();

    await quizService.generate('u1', { subjectId: 's1', topicIds: ['t1', 't1'] });

    const [attempt] = vi.mocked(quizRepository.createAttemptWithItems).mock.calls[0]!;
    expect(attempt).toMatchObject({ scope: 'TOPIC', topicId: 't1', topicCount: 1 });
  });

  it('algún tema ajeno/inexistente → NOT_FOUND, no llama a la IA ni persiste', async () => {
    vi.mocked(quizRepository.findSubjectContext).mockResolvedValue(subjectCtx);

    await expect(
      quizService.generate('u1', { subjectId: 's1', topicIds: ['t1', 'tX'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(generateQuiz).not.toHaveBeenCalled();
    expect(quizRepository.createAttemptWithItems).not.toHaveBeenCalled();
  });

  it('materia ajena/inexistente → NOT_FOUND, no llama a la IA', async () => {
    vi.mocked(quizRepository.findSubjectContext).mockResolvedValue(null);

    await expect(
      quizService.generate('u1', { subjectId: 's1', topicIds: ['t1'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(generateQuiz).not.toHaveBeenCalled();
  });

  it('materia sin temas → VALIDATION_ERROR, no llama a la IA', async () => {
    vi.mocked(quizRepository.findSubjectContext).mockResolvedValue({
      id: 's1',
      name: 'Mate',
      topics: [],
    });

    await expect(
      quizService.generate('u1', { subjectId: 's1', topicIds: ['t1'] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(generateQuiz).not.toHaveBeenCalled();
  });

  it('si la IA falla, propaga y NO persiste el intento', async () => {
    vi.mocked(quizRepository.findSubjectContext).mockResolvedValue(subjectCtx);
    vi.mocked(generateQuiz).mockRejectedValue(
      new AppError('AI_UNAVAILABLE', 'IA no disponible'),
    );

    await expect(
      quizService.generate('u1', { subjectId: 's1', topicIds: ['t1'] }),
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(quizRepository.createAttemptWithItems).not.toHaveBeenCalled();
  });
});

describe('answer — corrección server-side + lock anti-trampa', () => {
  it('un selectedIndex tramposo NO infla: el server compara contra el correctIndex guardado', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    // correctIndex guardado = 2; el cliente elige 0 (incorrecto).
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(makeItem({ correctIndex: 2 }));

    const reveal = await quizService.answer('att1', 'u1', { order: 0, selectedIndex: 0 });

    // El grading lo decide el server: incorrecto, con el correctIndex real.
    expect(reveal.isCorrect).toBe(false);
    expect(reveal.correctIndex).toBe(2);
    const [attemptId, itemId, selectedIndex, isCorrect] = vi.mocked(
      quizRepository.recordAnswer,
    ).mock.calls[0]!;
    expect(attemptId).toBe('att1');
    expect(itemId).toBe('i0');
    expect(selectedIndex).toBe(0);
    expect(isCorrect).toBe(false);
    // Reveal expone las explicaciones SOLO ahora (tras responder).
    expect(reveal.options[2]).toEqual({ text: 'o2', explanation: 'e2' });
  });

  it('acierto: selectedIndex === correctIndex guardado → isCorrect true', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(makeItem({ correctIndex: 2 }));

    const reveal = await quizService.answer('att1', 'u1', { order: 0, selectedIndex: 2 });

    expect(reveal.isCorrect).toBe(true);
    expect(vi.mocked(quizRepository.recordAnswer).mock.calls[0]![3]).toBe(true);
  });

  it('no se puede responder dos veces la misma pregunta → CONFLICT (lock), no persiste', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(makeItem({ selectedIndex: 1 }));

    await expect(
      quizService.answer('att1', 'u1', { order: 0, selectedIndex: 0 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(quizRepository.recordAnswer).not.toHaveBeenCalled();
  });

  it('carrera de doble-respuesta: el update condicional no afectó fila (false) → CONFLICT', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(makeItem({ correctIndex: 2 }));
    // El pre-check ve selectedIndex null, pero otra request ganó la carrera → recordAnswer aplica 0 filas.
    vi.mocked(quizRepository.recordAnswer).mockResolvedValue(false);

    await expect(
      quizService.answer('att1', 'u1', { order: 0, selectedIndex: 2 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('intento ajeno → NOT_FOUND, no busca la pregunta', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue(null);

    await expect(
      quizService.answer('att1', 'u1', { order: 0, selectedIndex: 0 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(quizRepository.findItemByOrder).not.toHaveBeenCalled();
  });

  it('opción fuera de rango → VALIDATION_ERROR', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(makeItem()); // 4 opciones

    await expect(
      quizService.answer('att1', 'u1', { order: 0, selectedIndex: 9 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(quizRepository.recordAnswer).not.toHaveBeenCalled();
  });
});

describe('answer — preguntas ABIERTAS (registrar al instante, SIN IA)', () => {
  // Item OPEN persistido: sin opciones, sin correctIndex, con expectedAnswer server-only + topic.sourceText.
  const openItem = (over: Partial<PrismaQuizAttemptItem> = {}) => ({
    ...makeItem({
      type: 'OPEN',
      options: [] as unknown as PrismaQuizAttemptItem['options'],
      correctIndex: null,
      expectedAnswer: 'El área bajo la curva',
      ...over,
    }),
    topic: { sourceText: 'La integral es el área bajo la curva.' },
  });

  it('GUARDA la respuesta al instante (grade=null=pendiente) SIN llamar a la IA y devuelve reveal pendiente', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(openItem());

    const reveal = await quizService.answer('att1', 'u1', {
      order: 0,
      answerText: '  el área debajo de la curva  ',
    });

    // DESACOPLE: responder NO depende de la IA.
    expect(gradeOpenAnswer).not.toHaveBeenCalled();
    // Reveal PENDIENTE: confirma el registro, sin criterio ni feedback (server-only hasta corregir).
    expect(reveal).toEqual({
      type: 'OPEN',
      order: 0,
      isCorrect: false,
      grade: null,
      feedback: null,
      expectedAnswer: null,
    });
    // Persistió SOLO el texto TRIMEADO (lock atómico WHERE studentAnswer null vive en el repo).
    const [attemptId, itemId, studentAnswer] = vi.mocked(
      quizRepository.recordOpenAnswerPending,
    ).mock.calls[0]!;
    expect(attemptId).toBe('att1');
    expect(itemId).toBe('i0');
    expect(studentAnswer).toBe('el área debajo de la curva');
  });

  it('falta answerText en una abierta → VALIDATION_ERROR, no guarda', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(openItem());

    await expect(
      quizService.answer('att1', 'u1', { order: 0, selectedIndex: 1 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(quizRepository.recordOpenAnswerPending).not.toHaveBeenCalled();
  });

  it('abierta ya respondida (studentAnswer no-null) → CONFLICT, no guarda', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(openItem({ studentAnswer: 'ya escribí' }));

    await expect(
      quizService.answer('att1', 'u1', { order: 0, answerText: 'otra' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(quizRepository.recordOpenAnswerPending).not.toHaveBeenCalled();
  });

  it('carrera: recordOpenAnswerPending no afectó fila (false) → CONFLICT', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(openItem());
    vi.mocked(quizRepository.recordOpenAnswerPending).mockResolvedValue(false);

    await expect(
      quizService.answer('att1', 'u1', { order: 0, answerText: 'algo' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('una abierta sin expectedAnswer (no debería pasar) → VALIDATION_ERROR, no guarda', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(openItem({ expectedAnswer: null }));

    await expect(
      quizService.answer('att1', 'u1', { order: 0, answerText: 'algo' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(quizRepository.recordOpenAnswerPending).not.toHaveBeenCalled();
  });
});

describe('gradeOpenItem — corrección aparte (IA server-side, idempotente, sin romper si falla)', () => {
  // Item OPEN ya RESPONDIDO pero SIN nota (studentAnswer no-null, grade null) — lo que corrige el endpoint.
  const answeredPending = (over: Partial<PrismaQuizAttemptItem> = {}) => ({
    ...makeItem({
      type: 'OPEN',
      options: [] as unknown as PrismaQuizAttemptItem['options'],
      correctIndex: null,
      expectedAnswer: 'El área bajo la curva',
      studentAnswer: 'el área debajo de la curva',
      grade: null,
      ...over,
    }),
    topic: { sourceText: 'La integral es el área bajo la curva.' },
  });

  it('corrige con la IA (anclada a material + expectedAnswer), deriva isCorrect del grade y persiste la nota', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(answeredPending());
    vi.mocked(gradeOpenAnswer).mockResolvedValue({ grade: 'CORRECT', feedback: '¡Bien!' });

    const reveal = await quizService.gradeOpenItem('att1', 'u1', { order: 0 });

    // La IA recibe la pregunta + criterio server-only + material + el texto YA guardado del alumno.
    expect(gradeOpenAnswer).toHaveBeenCalledWith({
      question: 'P1',
      expectedAnswer: 'El área bajo la curva',
      sourceText: 'La integral es el área bajo la curva.',
      studentAnswer: 'el área debajo de la curva',
    });
    // Reveal completo: recién acá viajan grade + feedback + expectedAnswer.
    expect(reveal).toEqual({
      type: 'OPEN',
      order: 0,
      isCorrect: true,
      grade: 'CORRECT',
      feedback: '¡Bien!',
      expectedAnswer: 'El área bajo la curva',
    });
    const [, , grade, feedback, isCorrect] = vi.mocked(
      quizRepository.recordOpenGrade,
    ).mock.calls[0]!;
    expect(grade).toBe('CORRECT');
    expect(feedback).toBe('¡Bien!');
    expect(isCorrect).toBe(true); // CORRECT → true
  });

  it('PARTIAL cuenta como NO correcta (isCorrect=false) pero conserva la nota de 3 estados', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(answeredPending());
    vi.mocked(gradeOpenAnswer).mockResolvedValue({ grade: 'PARTIAL', feedback: 'Te faltó precisión' });

    const reveal = await quizService.gradeOpenItem('att1', 'u1', { order: 0 });

    expect(reveal).toMatchObject({ type: 'OPEN', isCorrect: false, grade: 'PARTIAL' });
    // isCorrect persistido (índice 4 de recordOpenGrade) = false.
    expect(vi.mocked(quizRepository.recordOpenGrade).mock.calls[0]![4]).toBe(false);
  });

  it('IDEMPOTENTE: si ya está corregida (grade no-null) devuelve el reveal SIN re-llamar a la IA', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(
      answeredPending({ grade: 'PARTIAL', feedback: 'ya estaba', isCorrect: false }),
    );

    const reveal = await quizService.gradeOpenItem('att1', 'u1', { order: 0 });

    expect(gradeOpenAnswer).not.toHaveBeenCalled();
    expect(quizRepository.recordOpenGrade).not.toHaveBeenCalled();
    expect(reveal).toMatchObject({
      type: 'OPEN',
      grade: 'PARTIAL',
      feedback: 'ya estaba',
      expectedAnswer: 'El área bajo la curva',
    });
  });

  it('IA caída TRANSITORIA (AI_UNAVAILABLE): NO tira error, devuelve reveal pendiente y NO graba la nota', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(answeredPending());
    vi.mocked(gradeOpenAnswer).mockRejectedValue(new AppError('AI_UNAVAILABLE', 'IA caída'));

    const reveal = await quizService.gradeOpenItem('att1', 'u1', { order: 0 });

    expect(reveal).toEqual({
      type: 'OPEN',
      order: 0,
      isCorrect: false,
      grade: null,
      feedback: null,
      expectedAnswer: null,
    });
    expect(quizRepository.recordOpenGrade).not.toHaveBeenCalled();
  });

  it('error NO transitorio de la IA → se propaga (no lo tragamos)', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(answeredPending());
    vi.mocked(gradeOpenAnswer).mockRejectedValue(new AppError('INTERNAL_ERROR', 'bug'));

    await expect(
      quizService.gradeOpenItem('att1', 'u1', { order: 0 }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('aún no respondida (studentAnswer null) → VALIDATION_ERROR, no llama a la IA', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue(answeredPending({ studentAnswer: null }));

    await expect(
      quizService.gradeOpenItem('att1', 'u1', { order: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(gradeOpenAnswer).not.toHaveBeenCalled();
  });

  it('pregunta MCQ (no abierta) → VALIDATION_ERROR', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue({ id: 'att1' });
    vi.mocked(quizRepository.findItemByOrder).mockResolvedValue({
      ...makeItem({ selectedIndex: 1 }),
      topic: null,
    });

    await expect(
      quizService.gradeOpenItem('att1', 'u1', { order: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(gradeOpenAnswer).not.toHaveBeenCalled();
  });

  it('intento ajeno → NOT_FOUND, no busca la pregunta', async () => {
    vi.mocked(quizRepository.findAttemptOwned).mockResolvedValue(null);

    await expect(
      quizService.gradeOpenItem('att1', 'u1', { order: 0 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(quizRepository.findItemByOrder).not.toHaveBeenCalled();
  });
});

describe('getAttempt', () => {
  it('intento ajeno/inexistente → NOT_FOUND', async () => {
    vi.mocked(quizRepository.findByIdAndUserWithItems).mockResolvedValue(null);

    await expect(quizService.getAttempt('a1', 'u1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('detalle de un intento IN_PROGRESS: las preguntas SIN responder NO incluyen correctIndex/explicación; las contestadas sí', async () => {
    // Item 0 CONTESTADO (selectedIndex 2) y item 1 SIN responder (selectedIndex null).
    vi.mocked(quizRepository.findByIdAndUserWithItems).mockResolvedValue({
      id: 'att1',
      userId: 'u1',
      scope: 'TOPIC',
      status: 'IN_PROGRESS',
      subjectId: 's1',
      topicId: 't1',
      scopeName: 'Integrales',
      topicCount: 1,
      totalCount: 2,
      correctCount: 1,
      completedAt: null,
      createdAt: now,
      items: [
        makeItem({ id: 'i0', order: 0, correctIndex: 2, selectedIndex: 2, isCorrect: true }),
        makeItem({ id: 'i1', order: 1, correctIndex: 3, selectedIndex: null, isCorrect: false }),
      ],
    });

    const detail = await quizService.getAttempt('att1', 'u1');

    // Sin abiertas PARTIAL → puntaje sin crédito parcial.
    expect(detail.partialCount).toBe(0);

    // Contestada → completa (reveal disponible al revisar).
    const answered = detail.items[0]!;
    expect(answered.selectedIndex).toBe(2);
    expect(answered.correctIndex).toBe(2);
    expect(answered.isCorrect).toBe(true);
    expect(answered.options[2]).toEqual({ text: 'o2', explanation: 'e2' });

    // SIN responder → PÚBLICA: sin correctIndex ni explicación (no se puede espiar la respuesta).
    const pending = detail.items[1]!;
    expect(pending.selectedIndex).toBeNull();
    expect(pending.correctIndex).toBeNull();
    expect(pending.isCorrect).toBe(false);
    expect(pending.options).toEqual([{ text: 'o0' }, { text: 'o1' }, { text: 'o2' }, { text: 'o3' }]);
    expect(pending.options.some((o) => o.explanation !== undefined)).toBe(false);

    // Defensa extra: el correctIndex real (3) del item pendiente NO viaja en el payload serializado.
    const pendingSerialized = JSON.stringify(pending);
    expect(pendingSerialized).not.toContain('explanation');
    expect(pendingSerialized).not.toContain('"correctIndex":3');
  });

  it('detalle con ABIERTAS: la pendiente NO filtra expectedAnswer/feedback; la contestada los muestra', async () => {
    vi.mocked(quizRepository.findByIdAndUserWithItems).mockResolvedValue({
      id: 'att1',
      userId: 'u1',
      scope: 'TOPIC',
      status: 'IN_PROGRESS',
      subjectId: 's1',
      topicId: 't1',
      scopeName: 'Integrales',
      topicCount: 1,
      totalCount: 2,
      correctCount: 0,
      completedAt: null,
      createdAt: now,
      items: [
        // OPEN contestada (studentAnswer no-null): muestra grade + feedback + expectedAnswer.
        makeItem({
          id: 'i0',
          order: 0,
          type: 'OPEN',
          options: [] as unknown as PrismaQuizAttemptItem['options'],
          correctIndex: null,
          selectedIndex: null,
          studentAnswer: 'el área bajo la curva',
          grade: 'PARTIAL',
          feedback: 'Casi: te faltó mencionar el límite',
          expectedAnswer: 'El área bajo la curva entre límites',
          isCorrect: false,
        }),
        // OPEN SIN responder: expectedAnswer/feedback NO viajan (server-only hasta responder).
        makeItem({
          id: 'i1',
          order: 1,
          type: 'OPEN',
          options: [] as unknown as PrismaQuizAttemptItem['options'],
          correctIndex: null,
          selectedIndex: null,
          studentAnswer: null,
          expectedAnswer: 'La derivada es la pendiente',
        }),
      ],
    });

    const detail = await quizService.getAttempt('att1', 'u1');

    // partialCount derivado en lectura desde los grades guardados (1 abierta PARTIAL) → puntaje con crédito parcial.
    expect(detail.partialCount).toBe(1);

    const answered = detail.items[0]!;
    expect(answered.type).toBe('OPEN');
    expect(answered.studentAnswer).toBe('el área bajo la curva');
    expect(answered.grade).toBe('PARTIAL');
    expect(answered.feedback).toBe('Casi: te faltó mencionar el límite');
    expect(answered.expectedAnswer).toBe('El área bajo la curva entre límites');
    expect(answered.options).toEqual([]);

    const pending = detail.items[1]!;
    expect(pending.type).toBe('OPEN');
    expect(pending.studentAnswer).toBeNull();
    expect(pending.grade).toBeNull();
    expect(pending.feedback).toBeNull();
    expect(pending.expectedAnswer).toBeNull();

    // Defensa extra: el criterio real de la pendiente NUNCA viaja en el payload serializado.
    const pendingSerialized = JSON.stringify(pending);
    expect(pendingSerialized).not.toContain('La derivada es la pendiente');
  });

  it('abierta RESPONDIDA pero PENDIENTE de nota (grade null): muestra el texto del alumno pero OCULTA criterio/feedback', async () => {
    vi.mocked(quizRepository.findByIdAndUserWithItems).mockResolvedValue({
      id: 'att1',
      userId: 'u1',
      scope: 'TOPIC',
      status: 'COMPLETED',
      subjectId: 's1',
      topicId: 't1',
      scopeName: 'Integrales',
      topicCount: 1,
      totalCount: 1,
      correctCount: 0,
      completedAt: now,
      createdAt: now,
      items: [
        makeItem({
          id: 'i0',
          order: 0,
          type: 'OPEN',
          options: [] as unknown as PrismaQuizAttemptItem['options'],
          correctIndex: null,
          selectedIndex: null,
          studentAnswer: 'el área debajo de la curva',
          grade: null, // pendiente: la corrección todavía no llegó
          feedback: null,
          expectedAnswer: 'El área bajo la curva entre límites', // server-only hasta corregir
          isCorrect: false,
        }),
      ],
    });

    const detail = await quizService.getAttempt('att1', 'u1');

    // Sin nota → no suma crédito parcial todavía.
    expect(detail.partialCount).toBe(0);

    const pending = detail.items[0]!;
    expect(pending.type).toBe('OPEN');
    expect(pending.studentAnswer).toBe('el área debajo de la curva'); // el texto SÍ viaja (ya respondida)
    expect(pending.grade).toBeNull(); // "Evaluando…"
    expect(pending.feedback).toBeNull();
    expect(pending.expectedAnswer).toBeNull(); // criterio OCULTO hasta que llegue la nota

    // Defensa extra: el criterio real NO viaja mientras está pendiente.
    expect(JSON.stringify(pending)).not.toContain('entre límites');
  });
});

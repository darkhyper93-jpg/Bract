import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flashcard as PrismaFlashcard } from '@prisma/client';
import { TopicStatus } from '@bract/shared';
import { AppError } from '../../../lib/errors.js';

// Mockeamos el repo (Prisma) y la capa de IA: el service corre real, sin DB ni red. Acá se prueba
// la REGLA DELIBERADA de integración del Agente F: cómo Topic.status mueve la rotación SRS, y la
// generación multi-tema (éxito parcial).
vi.mock('../flashcard.repository.js', () => ({
  flashcardRepository: {
    pauseSrsByTopic: vi.fn(),
    activateSrsByTopic: vi.fn(),
    findTopicContext: vi.fn(),
    findManyByTopicPaged: vi.fn(),
    createManyReturning: vi.fn(),
  },
}));
vi.mock('../../../lib/ai/index.js', () => ({
  generateFlashcards: vi.fn(),
}));

import { flashcardRepository } from '../flashcard.repository.js';
import { generateFlashcards } from '../../../lib/ai/index.js';
import { flashcardService } from '../flashcard.service.js';

describe('flashcardService.onTopicStatusChanged (regla de rotación SRS — Agente F)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(flashcardRepository.pauseSrsByTopic).mockResolvedValue(0);
    vi.mocked(flashcardRepository.activateSrsByTopic).mockResolvedValue(0);
  });

  it('COMPLETED → ACTIVA las cartas del tema (entran al due), no las pausa', async () => {
    await flashcardService.onTopicStatusChanged('u1', 't1', TopicStatus.COMPLETED);
    expect(flashcardRepository.activateSrsByTopic).toHaveBeenCalledOnce();
    expect(flashcardRepository.activateSrsByTopic).toHaveBeenCalledWith('u1', 't1', expect.any(Date));
    expect(flashcardRepository.pauseSrsByTopic).not.toHaveBeenCalled();
  });

  it('IN_PROGRESS → ACTIVA las cartas (un tema en estudio mantiene su SRS en rotación)', async () => {
    await flashcardService.onTopicStatusChanged('u1', 't1', TopicStatus.IN_PROGRESS);
    expect(flashcardRepository.activateSrsByTopic).toHaveBeenCalledOnce();
    expect(flashcardRepository.pauseSrsByTopic).not.toHaveBeenCalled();
  });

  it('PENDING → PAUSA las cartas (salen del due), no las activa', async () => {
    await flashcardService.onTopicStatusChanged('u1', 't1', TopicStatus.PENDING);
    expect(flashcardRepository.pauseSrsByTopic).toHaveBeenCalledOnce();
    expect(flashcardRepository.pauseSrsByTopic).toHaveBeenCalledWith('u1', 't1');
    expect(flashcardRepository.activateSrsByTopic).not.toHaveBeenCalled();
  });

  it('scopea por userId (ownership §3.4): pasa el userId al repo en ambas ramas', async () => {
    await flashcardService.onTopicStatusChanged('owner-a', 'top-x', TopicStatus.COMPLETED);
    expect(flashcardRepository.activateSrsByTopic).toHaveBeenCalledWith('owner-a', 'top-x', expect.any(Date));
    await flashcardService.onTopicStatusChanged('owner-b', 'top-y', TopicStatus.PENDING);
    expect(flashcardRepository.pauseSrsByTopic).toHaveBeenCalledWith('owner-b', 'top-y');
  });
});

describe('flashcardService.generateMulti (multi-tema, secuencial con éxito parcial)', () => {
  const now = new Date('2026-06-16T00:00:00.000Z');

  const topicCtx = (id: string) => ({
    id,
    name: `Tema ${id}`,
    description: null,
    difficulty: 'MEDIUM',
    userId: 'u1',
    subject: { name: 'Mate' },
  });

  // Fila Prisma de una carta creada (el service la mapea a DTO).
  const makeCard = (topicId: string, n: number): PrismaFlashcard => ({
    id: `${topicId}-c${n}`,
    topicId,
    userId: 'u1',
    question: `q${n}`,
    answer: `a${n}`,
    source: 'AI',
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    dueDate: now,
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Ownership OK por defecto: cada tema existe y es del usuario.
    vi.mocked(flashcardRepository.findTopicContext).mockImplementation((id: string) =>
      Promise.resolve(topicCtx(id)),
    );
    vi.mocked(flashcardRepository.findManyByTopicPaged).mockResolvedValue([]); // sin existentes (dedup)
    // Persistencia: devuelve una carta por cada item pedido, con su topicId.
    vi.mocked(flashcardRepository.createManyReturning).mockImplementation((rows) =>
      Promise.resolve(rows.map((r, i) => makeCard(r.topicId, i))),
    );
  });

  it('todos los temas OK: agrega las cartas de cada uno y reporta el desglose en meta', async () => {
    vi.mocked(generateFlashcards).mockResolvedValue([{ question: 'q0', answer: 'a0' }]);

    const { flashcards, meta } = await flashcardService.generateMulti(['t1', 't2'], 'u1');

    expect(generateFlashcards).toHaveBeenCalledTimes(2);
    expect(flashcards).toHaveLength(2);
    expect(flashcards.map((c) => c.topicId)).toEqual(['t1', 't2']);
    expect(meta.topics).toEqual([
      { topicId: 't1', generated: 1, failed: false },
      { topicId: 't2', generated: 1, failed: false },
    ]);
  });

  it('ÉXITO PARCIAL: si un tema falla, conserva las cartas de los anteriores y marca el fallido', async () => {
    // t1 OK, t2 falla (IA caída transitoria).
    vi.mocked(generateFlashcards)
      .mockResolvedValueOnce([{ question: 'q0', answer: 'a0' }])
      .mockRejectedValueOnce(new AppError('AI_UNAVAILABLE', 'IA no disponible'));

    const { flashcards, meta } = await flashcardService.generateMulti(['t1', 't2'], 'u1');

    // No tiró todo: las cartas de t1 se conservan.
    expect(flashcards).toHaveLength(1);
    expect(flashcards[0]!.topicId).toBe('t1');
    expect(meta.topics).toEqual([
      { topicId: 't1', generated: 1, failed: false },
      { topicId: 't2', generated: 0, failed: true },
    ]);
  });

  it('si TODOS los temas fallan → propaga AI_UNAVAILABLE', async () => {
    vi.mocked(generateFlashcards).mockRejectedValue(new AppError('AI_UNAVAILABLE', 'IA no disponible'));

    await expect(flashcardService.generateMulti(['t1', 't2'], 'u1')).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
  });

  it('un tema ajeno/inexistente → NOT_FOUND ANTES de gastar llamadas de IA', async () => {
    vi.mocked(flashcardRepository.findTopicContext).mockImplementation((id: string) =>
      Promise.resolve(id === 'tX' ? null : topicCtx(id)),
    );

    await expect(flashcardService.generateMulti(['t1', 'tX'], 'u1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(generateFlashcards).not.toHaveBeenCalled();
  });

  it('topicIds duplicados → se deduplican (una sola generación por tema)', async () => {
    vi.mocked(generateFlashcards).mockResolvedValue([{ question: 'q0', answer: 'a0' }]);

    const { meta } = await flashcardService.generateMulti(['t1', 't1'], 'u1');

    expect(generateFlashcards).toHaveBeenCalledTimes(1);
    expect(meta.topics).toEqual([{ topicId: 't1', generated: 1, failed: false }]);
  });
});

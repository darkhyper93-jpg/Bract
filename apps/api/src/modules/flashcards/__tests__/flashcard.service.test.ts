import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopicStatus } from '@bract/shared';

// Mockeamos el repo (Prisma) y la capa de IA: el service corre real, sin DB ni red. Acá se prueba
// la REGLA DELIBERADA de integración del Agente F: cómo Topic.status mueve la rotación SRS.
vi.mock('../flashcard.repository.js', () => ({
  flashcardRepository: {
    pauseSrsByTopic: vi.fn(),
    activateSrsByTopic: vi.fn(),
  },
}));
vi.mock('../../../lib/ai/index.js', () => ({
  generateFlashcards: vi.fn(),
}));

import { flashcardRepository } from '../flashcard.repository.js';
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

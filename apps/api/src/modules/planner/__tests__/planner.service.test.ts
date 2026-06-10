import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Subject as PrismaSubject,
  Topic as PrismaTopic,
  StudyAvailability as PrismaAvailability,
  StudyPlan as PrismaStudyPlan,
  StudyPlanItem as PrismaStudyPlanItem,
} from '@prisma/client';
import { StudyPlanItemStatus, TopicStatus } from '@bract/shared';
import { AppError } from '../../../lib/errors.js';

// Mockeamos repos (Prisma) y la capa de IA: el service corre real, sin DB ni red.
vi.mock('../subject.repository.js', () => ({
  subjectRepository: {
    findManyByUserWithTopics: vi.fn(),
    findByIdAndUserWithTopics: vi.fn(),
    findByIdAndUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
  },
}));
vi.mock('../topic.repository.js', () => ({
  topicRepository: {
    findManyBySubject: vi.fn(),
    findByIdAndUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
  },
}));
vi.mock('../study.repository.js', () => ({
  studyRepository: {
    getAvailability: vi.fn(),
    replaceAvailability: vi.fn(),
    getActivePlanWithItems: vi.fn(),
    createActivePlan: vi.fn(),
    regenerateFutureItems: vi.fn(),
    findPlanItemWithOwner: vi.fn(),
    updatePlanItemStatus: vi.fn(),
  },
}));
vi.mock('../../../lib/ai/index.js', () => ({
  generateStudyPlan: vi.fn(),
  generateStudyPlanBaseline: vi.fn(),
}));

import { subjectRepository } from '../subject.repository.js';
import { topicRepository } from '../topic.repository.js';
import { studyRepository } from '../study.repository.js';
import { generateStudyPlan, generateStudyPlanBaseline } from '../../../lib/ai/index.js';
import { plannerService } from '../planner.service.js';

const now = new Date('2026-06-10T00:00:00.000Z');

function makeSubject(over: Partial<PrismaSubject> = {}): PrismaSubject {
  return {
    id: 's1',
    userId: 'u1',
    name: 'Matemática',
    examDate: null,
    color: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

function makeTopic(over: Partial<PrismaTopic> = {}): PrismaTopic {
  return {
    id: 't1',
    subjectId: 's1',
    userId: 'u1',
    name: 'Integrales',
    description: null,
    status: 'PENDING',
    difficulty: 'MEDIUM',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

function makeAvailability(): PrismaAvailability {
  return { id: 'a1', userId: 'u1', weekday: 1, minutes: 60, createdAt: now, updatedAt: now };
}

function makePlanItem(over: Partial<PrismaStudyPlanItem> = {}): PrismaStudyPlanItem {
  return {
    id: 'i1',
    planId: 'p1',
    topicId: 't1',
    date: now,
    order: 0,
    estimatedMinutes: 45,
    status: 'PENDING',
    completedAt: null,
    createdAt: now,
    ...over,
  };
}

function makePlan(
  items: (PrismaStudyPlanItem & { topic: PrismaTopic })[] = [],
): PrismaStudyPlan & { items: (PrismaStudyPlanItem & { topic: PrismaTopic })[] } {
  return {
    id: 'p1',
    userId: 'u1',
    status: 'ACTIVE',
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
    items,
  };
}

describe('plannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults para buildPlanInput (materias + disponibilidad del usuario).
    vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
      { ...makeSubject(), topics: [makeTopic()] },
    ]);
    vi.mocked(studyRepository.getAvailability).mockResolvedValue([makeAvailability()]);
  });

  it('createSubject mapea el DTO y persiste (examDate→Date, fechas→ISO en la salida)', async () => {
    vi.mocked(subjectRepository.create).mockResolvedValue(
      makeSubject({ examDate: new Date('2026-07-01T00:00:00.000Z'), color: '#6366f1' }),
    );
    const subject = await plannerService.createSubject('u1', {
      name: 'Matemática',
      examDate: '2026-07-01T00:00:00.000Z',
      color: '#6366f1',
    });
    expect(subjectRepository.create).toHaveBeenCalledOnce();
    expect(subject.examDate).toBe('2026-07-01T00:00:00.000Z');
    expect(typeof subject.createdAt).toBe('string');
  });

  it('generatePlan usa la IA (degradable) y crea un plan ACTIVE nuevo', async () => {
    vi.mocked(generateStudyPlan).mockResolvedValue([
      { date: '2026-06-11', items: [{ topicId: 't1', estimatedMinutes: 45 }] },
    ]);
    vi.mocked(studyRepository.createActivePlan).mockResolvedValue(
      makePlan([{ ...makePlanItem(), topic: makeTopic() }]),
    );

    const result = await plannerService.generatePlan('u1');

    expect(generateStudyPlan).toHaveBeenCalledOnce();
    expect(generateStudyPlanBaseline).not.toHaveBeenCalled();
    expect(studyRepository.createActivePlan).toHaveBeenCalledOnce();
    // El service aplanó days→items con date Date y order incremental.
    const [, items] = vi.mocked(studyRepository.createActivePlan).mock.calls[0]!;
    expect(items[0]).toMatchObject({ topicId: 't1', order: 0, estimatedMinutes: 45 });
    expect(items[0]!.date).toBeInstanceOf(Date);
    expect(result.status).toBe('ACTIVE');
    expect(result.items[0]?.topicId).toBe('t1');
  });

  it('completar un tema dispara recálculo DETERMINISTA (baseline, sin IA)', async () => {
    vi.mocked(topicRepository.findByIdAndUser).mockResolvedValue(makeTopic());
    vi.mocked(topicRepository.update).mockResolvedValue(
      makeTopic({ status: 'COMPLETED', completedAt: now }),
    );
    vi.mocked(studyRepository.getActivePlanWithItems).mockResolvedValue(makePlan());
    vi.mocked(generateStudyPlanBaseline).mockReturnValue([]);
    vi.mocked(studyRepository.regenerateFutureItems).mockResolvedValue(makePlan());

    const result = await plannerService.updateTopicStatus('t1', 'u1', TopicStatus.COMPLETED);

    expect(generateStudyPlanBaseline).toHaveBeenCalledOnce();
    expect(generateStudyPlan).not.toHaveBeenCalled();
    expect(studyRepository.regenerateFutureItems).toHaveBeenCalledOnce();
    expect(result.topic.status).toBe('COMPLETED');
    expect(result.topic.completedAt).not.toBeNull();
    expect(result.plan).not.toBeNull();
  });

  it('sin plan activo, completar un tema no recalcula (plan = null)', async () => {
    vi.mocked(topicRepository.findByIdAndUser).mockResolvedValue(makeTopic());
    vi.mocked(topicRepository.update).mockResolvedValue(makeTopic({ status: 'COMPLETED' }));
    vi.mocked(studyRepository.getActivePlanWithItems).mockResolvedValue(null);

    const result = await plannerService.updateTopicStatus('t1', 'u1', TopicStatus.COMPLETED);

    expect(generateStudyPlanBaseline).not.toHaveBeenCalled();
    expect(studyRepository.regenerateFutureItems).not.toHaveBeenCalled();
    expect(result.plan).toBeNull();
  });

  it('saltar un bloque (SKIPPED) adapta el plan; completarlo (COMPLETED) no recalcula', async () => {
    // SKIPPED → recalc determinista
    vi.mocked(studyRepository.findPlanItemWithOwner).mockResolvedValue({
      ...makePlanItem(),
      plan: { id: 'p1', userId: 'u1' },
    });
    vi.mocked(studyRepository.updatePlanItemStatus).mockResolvedValue(
      makePlanItem({ status: 'SKIPPED' }),
    );
    vi.mocked(studyRepository.getActivePlanWithItems).mockResolvedValue(makePlan());
    vi.mocked(generateStudyPlanBaseline).mockReturnValue([]);
    vi.mocked(studyRepository.regenerateFutureItems).mockResolvedValue(makePlan());

    await plannerService.updatePlanItem('i1', 'u1', StudyPlanItemStatus.SKIPPED);
    expect(studyRepository.regenerateFutureItems).toHaveBeenCalledOnce();

    // COMPLETED → solo registra, sin recálculo
    vi.mocked(studyRepository.regenerateFutureItems).mockClear();
    vi.mocked(generateStudyPlanBaseline).mockClear();
    vi.mocked(studyRepository.updatePlanItemStatus).mockResolvedValue(
      makePlanItem({ status: 'COMPLETED', completedAt: now }),
    );

    await plannerService.updatePlanItem('i1', 'u1', StudyPlanItemStatus.COMPLETED);
    expect(studyRepository.regenerateFutureItems).not.toHaveBeenCalled();
    expect(generateStudyPlanBaseline).not.toHaveBeenCalled();
  });

  it('un bloque de otro usuario devuelve NOT_FOUND (ownership vía plan padre)', async () => {
    vi.mocked(studyRepository.findPlanItemWithOwner).mockResolvedValue({
      ...makePlanItem(),
      plan: { id: 'p1', userId: 'OTRO_USUARIO' },
    });
    await expect(
      plannerService.updatePlanItem('i1', 'u1', StudyPlanItemStatus.COMPLETED),
    ).rejects.toBeInstanceOf(AppError);
    expect(studyRepository.updatePlanItemStatus).not.toHaveBeenCalled();
  });

  it('getSubject lanza NOT_FOUND si la materia no es del usuario', async () => {
    vi.mocked(subjectRepository.findByIdAndUserWithTopics).mockResolvedValue(null);
    await expect(plannerService.getSubject('s1', 'u1')).rejects.toBeInstanceOf(AppError);
  });
});

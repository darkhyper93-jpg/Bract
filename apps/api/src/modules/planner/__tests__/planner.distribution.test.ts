import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Subject as PrismaSubject,
  Topic as PrismaTopic,
  StudyAvailability as PrismaAvailability,
  StudyPlan as PrismaStudyPlan,
  StudyPlanItem as PrismaStudyPlanItem,
} from '@prisma/client';
import { StudyPlanItemStatus, TopicStatus } from '@bract/shared';

// A diferencia de planner.service.test.ts, acá NO mockeamos lib/ai: la distribución
// determinista (buildBaselinePlan vía generateStudyPlanBaseline) corre REAL. Solo mockeamos
// ai.client para controlar isAIConfigured y no tocar la red, y los repos (Prisma).
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
  topicRepository: { findByIdAndUser: vi.fn(), update: vi.fn() },
}));
vi.mock('../study.repository.js', () => ({
  studyRepository: {
    getAvailability: vi.fn(),
    getActivePlanWithItems: vi.fn(),
    createActivePlan: vi.fn(),
    regenerateFutureItems: vi.fn(),
    findPlanItemWithOwner: vi.fn(),
    updatePlanItemStatus: vi.fn(),
  },
}));
vi.mock('../../../lib/ai/ai.client.js', () => ({
  isAIConfigured: vi.fn(() => false), // sin AI_API_KEY → generate degrada al baseline
  getAIClient: vi.fn(),
  AI_MODELS: { generation: 'claude-haiku-4-5', chat: 'claude-sonnet-4-6' },
  isEffortCapable: () => false,
}));
// F: updateTopicStatus delega el efecto SRS al flashcardService; lo mockeamos para no tocar Prisma.
vi.mock('../../flashcards/flashcard.service.js', () => ({
  flashcardService: { onTopicStatusChanged: vi.fn() },
}));

import { subjectRepository } from '../subject.repository.js';
import { topicRepository } from '../topic.repository.js';
import { studyRepository } from '../study.repository.js';
import { getAIClient, isAIConfigured } from '../../../lib/ai/ai.client.js';
import { plannerService } from '../planner.service.js';
import type { NewPlanItem } from '../study.repository.js';

const DAY = 86_400_000;
const now = new Date();

function subj(id: string, examInDays: number | null): PrismaSubject {
  return {
    id,
    userId: 'u1',
    name: id,
    examDate: examInDays === null ? null : new Date(now.getTime() + examInDays * DAY),
    color: null,
    createdAt: now,
    updatedAt: now,
  };
}

function topic(id: string, subjectId: string, status: PrismaTopic['status'] = 'PENDING'): PrismaTopic {
  return {
    id,
    subjectId,
    userId: 'u1',
    name: id,
    description: null,
    status,
    difficulty: 'MEDIUM', // 45 min/bloque
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

// 7 días disponibles, 60 min c/u → slots existen sea cual sea el día de hoy.
function fullWeekAvailability(): PrismaAvailability[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    id: `a${weekday}`,
    userId: 'u1',
    weekday,
    minutes: 60,
    createdAt: now,
    updatedAt: now,
  }));
}

function activePlan(): PrismaStudyPlan & { items: (PrismaStudyPlanItem & { topic: PrismaTopic })[] } {
  return {
    id: 'p1',
    userId: 'u1',
    status: 'ACTIVE',
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
    items: [],
  };
}

// Suma de minutos por día (clave = fecha ISO) — para verificar que no se excede la capacidad.
function minutesPerDay(items: NewPlanItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const key = it.date.toISOString();
    m.set(key, (m.get(key) ?? 0) + it.estimatedMinutes);
  }
  return m;
}

describe('plannerService — distribución determinista (lógica riesgosa, sin IA)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(studyRepository.getAvailability).mockResolvedValue(fullWeekAvailability());
  });

  it('generate sin AI_API_KEY degrada al baseline (no toca el cliente de IA)', async () => {
    vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
      { ...subj('s1', 5), topics: [topic('t1', 's1'), topic('t2', 's1')] },
    ]);
    vi.mocked(studyRepository.createActivePlan).mockResolvedValue(activePlan());

    await plannerService.generatePlan('u1');

    // Degradación: NUNCA se instancia el cliente del proveedor.
    expect(getAIClient).not.toHaveBeenCalled();
    expect(studyRepository.createActivePlan).toHaveBeenCalledOnce();
    const [, items] = vi.mocked(studyRepository.createActivePlan).mock.calls[0]!;
    // El baseline distribuyó los temas pendientes.
    expect(items.length).toBeGreaterThan(0);
    const topicIds = items.map((i) => i.topicId).sort();
    expect(topicIds).toEqual(['t1', 't2']);
  });

  it('ordena por urgencia (examen más cercano primero) y respeta los minutos/día', async () => {
    // Materia urgente (examen en 2 días) vs lejana (en 10). 60 min/día, bloques de 45.
    vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
      { ...subj('urgent', 2), topics: [topic('u_a', 'urgent'), topic('u_b', 'urgent')] },
      { ...subj('later', 10), topics: [topic('l_a', 'later')] },
    ]);
    vi.mocked(studyRepository.createActivePlan).mockResolvedValue(activePlan());

    await plannerService.generatePlan('u1');

    const [, items] = vi.mocked(studyRepository.createActivePlan).mock.calls[0]!;
    expect(items.length).toBeGreaterThan(0);
    // Urgencia: el primer bloque agendado es de la materia con examen más cercano.
    expect(items[0]!.topicId.startsWith('u_')).toBe(true);
    // Capacidad: ningún día excede sus 60 min disponibles.
    for (const total of minutesPerDay(items).values()) {
      expect(total).toBeLessThanOrEqual(60);
    }
  });

  it('completar un tema redistribuye lo pendiente y EXCLUYE el tema completado', async () => {
    vi.mocked(topicRepository.findByIdAndUser).mockResolvedValue(topic('done', 's1'));
    vi.mocked(topicRepository.update).mockResolvedValue(topic('done', 's1', 'COMPLETED'));
    vi.mocked(studyRepository.getActivePlanWithItems).mockResolvedValue(activePlan());
    // Estado tras completar: 'done' COMPLETED, 'pend' PENDING.
    vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
      { ...subj('s1', 4), topics: [topic('done', 's1', 'COMPLETED'), topic('pend', 's1')] },
    ]);
    vi.mocked(studyRepository.regenerateFutureItems).mockResolvedValue(activePlan());

    await plannerService.updateTopicStatus('done', 'u1', TopicStatus.COMPLETED);

    expect(studyRepository.regenerateFutureItems).toHaveBeenCalledOnce();
    const [, , items] = vi.mocked(studyRepository.regenerateFutureItems).mock.calls[0]!;
    const ids = items.map((i) => i.topicId);
    expect(ids).toContain('pend');
    expect(ids).not.toContain('done'); // el completado no se reagenda
  });

  it('saltar un bloque (SKIPPED) redistribuye el tema pendiente en días restantes', async () => {
    vi.mocked(studyRepository.findPlanItemWithOwner).mockResolvedValue({
      id: 'i1',
      planId: 'p1',
      topicId: 'skipme',
      date: now,
      order: 0,
      estimatedMinutes: 45,
      status: 'PENDING',
      completedAt: null,
      createdAt: now,
      plan: { id: 'p1', userId: 'u1' },
    });
    vi.mocked(studyRepository.updatePlanItemStatus).mockResolvedValue({
      id: 'i1',
      planId: 'p1',
      topicId: 'skipme',
      date: now,
      order: 0,
      estimatedMinutes: 45,
      status: 'SKIPPED',
      completedAt: null,
      createdAt: now,
    });
    vi.mocked(studyRepository.getActivePlanWithItems).mockResolvedValue(activePlan());
    // El tema sigue PENDING globalmente → el baseline lo reagenda.
    vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
      { ...subj('s1', 6), topics: [topic('skipme', 's1')] },
    ]);
    vi.mocked(studyRepository.regenerateFutureItems).mockResolvedValue(activePlan());

    await plannerService.updatePlanItem('i1', 'u1', StudyPlanItemStatus.SKIPPED);

    expect(studyRepository.regenerateFutureItems).toHaveBeenCalledOnce();
    const [, , items] = vi.mocked(studyRepository.regenerateFutureItems).mock.calls[0]!;
    expect(items.map((i) => i.topicId)).toContain('skipme');
  });
});

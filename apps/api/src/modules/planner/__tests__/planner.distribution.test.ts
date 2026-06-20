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
// Gamificación aislada (no se dispara en la distribución, pero el service la importa).
vi.mock('../../gamification/gamification.effects.js', () => ({
  safeGamify: vi.fn().mockResolvedValue(undefined),
  gamificationEffects: {
    onQuizAnswered: vi.fn(),
    onOpenGraded: vi.fn(),
    onFlashcardReviewed: vi.fn(),
    onPlanItemCompleted: vi.fn(),
    onTopicCompleted: vi.fn(),
  },
}));

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
  AI_MODELS: { generation: 'gemini-2.5-flash-lite', chat: 'gemini-2.5-flash' },
}));
// F: updateTopicStatus delega el efecto SRS al flashcardService; lo mockeamos para no tocar Prisma.
vi.mock('../../flashcards/flashcard.service.js', () => ({
  flashcardService: { onTopicStatusChanged: vi.fn() },
}));
// I-2 (capa 2): buildPlanInput consulta progreso + preferencias. Por defecto NO aportan señal (mapa vacío + LOW)
// → el planner se comporta como hoy. Los tests de blend sobreescriben estos mocks puntualmente.
vi.mock('../../progress/progress.service.js', () => ({
  progressService: { getWeaknessMap: vi.fn(async () => new Map<string, number>()) },
}));
vi.mock('../../preferences/preferences.service.js', () => ({
  preferencesService: {
    get: vi.fn(async () => ({
      remediationIntensity: 'LOW',
      prioritySubjectIds: [],
      weightQuiz: null,
      weightSrs: null,
      dailyGoalMinutes: null,
    })),
  },
}));

import { subjectRepository } from '../subject.repository.js';
import { topicRepository } from '../topic.repository.js';
import { studyRepository } from '../study.repository.js';
import { getAIClient, isAIConfigured } from '../../../lib/ai/ai.client.js';
import { progressService } from '../../progress/progress.service.js';
import { preferencesService } from '../../preferences/preferences.service.js';
import { RemediationIntensity } from '@bract/shared';
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
    // I-2: por defecto sin señal de debilidad ni prioridades → orden idéntico al baseline de hoy.
    vi.mocked(progressService.getWeaknessMap).mockResolvedValue(new Map());
    vi.mocked(preferencesService.get).mockResolvedValue({
      remediationIntensity: RemediationIntensity.LOW,
      prioritySubjectIds: [],
      weightQuiz: null,
      weightSrs: null,
      dailyGoalMinutes: null,
    });
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

  it('GOLDEN: sin datos de debilidad Y sin materias prioritarias ⇒ orden idéntico al baseline de hoy', async () => {
    // Misma data que el test de urgencia. weaknessMap vacío + prioritySubjectIds=[] (defaults del beforeEach):
    // ambos términos (debilidad y prioridad) en 0 ⇒ effectiveDays=examDays ⇒ idéntico a hoy, con cualquier α.
    vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
      { ...subj('urgent', 2), topics: [topic('u_a', 'urgent')] },
      { ...subj('later', 10), topics: [topic('l_a', 'later')] },
    ]);
    vi.mocked(studyRepository.createActivePlan).mockResolvedValue(activePlan());

    await plannerService.generatePlan('u1');

    const [, items] = vi.mocked(studyRepository.createActivePlan).mock.calls[0]!;
    // El primer bloque sigue siendo el de la materia con examen más cercano.
    expect(items[0]!.topicId).toBe('u_a');
  });

  it('con HIGH intensity, un tema flojo con examen algo más lejano puede adelantarse', async () => {
    // urgente: examen en 8 días, no flojo. later: examen en 10 días, muy flojo.
    vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
      { ...subj('urgent', 8), topics: [topic('u_a', 'urgent')] },
      { ...subj('later', 10), topics: [topic('l_a', 'later')] },
    ]);
    vi.mocked(progressService.getWeaknessMap).mockResolvedValue(new Map([['l_a', 1]]));
    vi.mocked(preferencesService.get).mockResolvedValue({
      remediationIntensity: RemediationIntensity.HIGH,
      prioritySubjectIds: [],
      weightQuiz: null,
      weightSrs: null,
      dailyGoalMinutes: null,
    });
    vi.mocked(studyRepository.createActivePlan).mockResolvedValue(activePlan());

    await plannerService.generatePlan('u1');

    const [, items] = vi.mocked(studyRepository.createActivePlan).mock.calls[0]!;
    // l_a: effectiveDays = 10 - 1*7*1 = 3 < 8 ⇒ se adelanta a u_a.
    expect(items[0]!.topicId).toBe('l_a');
  });

  it('PRIORIDAD independiente de α: en OFF, una materia prioritaria con examen algo más lejano igual se adelanta', async () => {
    // urgente: examen en 5 días, NO prioritaria. priori: examen en 7 días, prioritaria. SIN datos de debilidad.
    // remediationIntensity=OFF ⇒ α=0 ⇒ el nudge de DEBILIDAD se anula, pero el de PRIORIDAD (fijo) sigue aplicando.
    vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
      { ...subj('urgent', 5), topics: [topic('u_a', 'urgent')] },
      { ...subj('priori', 7), topics: [topic('p_a', 'priori')] },
    ]);
    vi.mocked(preferencesService.get).mockResolvedValue({
      remediationIntensity: RemediationIntensity.OFF,
      prioritySubjectIds: ['priori'],
      weightQuiz: null,
      weightSrs: null,
      dailyGoalMinutes: null,
    });
    vi.mocked(studyRepository.createActivePlan).mockResolvedValue(activePlan());

    await plannerService.generatePlan('u1');

    const [, items] = vi.mocked(studyRepository.createActivePlan).mock.calls[0]!;
    // p_a: effectiveDays = 7 - 0 (α=0, sin nudge de debilidad) - 3*1 (prioridad FIJA) = 4 < 5 ⇒ se adelanta a u_a.
    // Prueba clave: la prioridad NO depende de α (vale aun en OFF) y no toca el weakness.
    expect(items[0]!.topicId).toBe('p_a');
  });
});

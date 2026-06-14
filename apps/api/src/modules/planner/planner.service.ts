import type {
  Prisma,
  Subject as PrismaSubject,
  Topic as PrismaTopic,
  StudyAvailability as PrismaAvailability,
  StudyPlanItem as PrismaStudyPlanItem,
} from '@prisma/client';
import {
  TopicStatus,
  TopicDifficulty,
  StudyPlanStatus,
  StudyPlanItemStatus,
} from '@bract/shared';
import type {
  Subject,
  Topic,
  SubjectWithTopics,
  StudyAvailability,
  StudyPlanItem,
  StudyPlanItemWithTopic,
  StudyPlanWithItems,
  CreateSubjectInput,
  UpdateSubjectInput,
  CreateTopicInput,
  UpdateTopicInput,
  SetAvailabilityInput,
} from '@bract/shared';
import { generateStudyPlan, generateStudyPlanBaseline } from '../../lib/ai/index.js';
import type { GeneratePlanInput, PlanDay } from '../../lib/ai/index.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { progressService } from '../progress/progress.service.js';
import { preferencesService } from '../preferences/preferences.service.js';
import { INTENSITY_ALPHA } from '../progress/progress.formula.js';
import { flashcardService } from '../flashcards/flashcard.service.js';
import { subjectRepository } from './subject.repository.js';
import type { SubjectWithTopicsRow } from './subject.repository.js';
import { topicRepository } from './topic.repository.js';
import { studyRepository } from './study.repository.js';
import type {
  NewPlanItem,
  PlanItemWithTopicRow,
  PlanWithItemsRow,
} from './study.repository.js';

// ============================================================================
// Planificador (Agente C) — lógica de negocio. Recibe DTOs (nunca req), mapea
// Prisma→shared (Date→ISO, enums casteados), orquesta la distribución del plan
// (vía lib/ai del Agente B) y la persistencia. NO toca HTTP.
// ============================================================================

// ---- Mappers Prisma → contrato @bract/shared ------------------------------
// DECISIÓN: cast de enums Prisma → enum compartido (mismatch nominal de TS); mismo
// patrón que role/status en auth.service y type en notification.service.

function toSubject(s: PrismaSubject): Subject {
  return {
    id: s.id,
    userId: s.userId,
    name: s.name,
    examDate: s.examDate ? s.examDate.toISOString() : null,
    color: s.color,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function toTopic(t: PrismaTopic): Topic {
  return {
    id: t.id,
    subjectId: t.subjectId,
    userId: t.userId,
    name: t.name,
    description: t.description,
    status: t.status as TopicStatus,
    difficulty: t.difficulty as TopicDifficulty,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function toSubjectWithTopics(s: SubjectWithTopicsRow): SubjectWithTopics {
  return { ...toSubject(s), topics: s.topics.map(toTopic) };
}

function toAvailability(a: PrismaAvailability): StudyAvailability {
  return {
    id: a.id,
    userId: a.userId,
    weekday: a.weekday,
    minutes: a.minutes,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function toPlanItem(i: PrismaStudyPlanItem): StudyPlanItem {
  return {
    id: i.id,
    planId: i.planId,
    topicId: i.topicId,
    date: i.date.toISOString(),
    order: i.order,
    estimatedMinutes: i.estimatedMinutes,
    status: i.status as StudyPlanItemStatus,
    completedAt: i.completedAt ? i.completedAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
  };
}

function toPlanItemWithTopic(row: PlanItemWithTopicRow): StudyPlanItemWithTopic {
  return { ...toPlanItem(row), topic: toTopic(row.topic) };
}

function toPlanWithItems(p: PlanWithItemsRow): StudyPlanWithItems {
  return {
    id: p.id,
    userId: p.userId,
    status: p.status as StudyPlanStatus,
    generatedAt: p.generatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    items: p.items.map(toPlanItemWithTopic),
  };
}

// ---- Helpers de fecha / distribución --------------------------------------

function startOfTodayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// El baseline emite `date` como `yyyy-mm-dd` → Date en medianoche UTC para persistir.
function planDayToDate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

function flattenDays(days: PlanDay[]): NewPlanItem[] {
  const items: NewPlanItem[] = [];
  for (const day of days) {
    const date = planDayToDate(day.date);
    day.items.forEach((it, idx) => {
      items.push({ topicId: it.topicId, date, order: idx, estimatedMinutes: it.estimatedMinutes });
    });
  }
  return items;
}

// Arma el input que consume lib/ai (Agente B) con el estado actual del usuario.
async function buildPlanInput(userId: string): Promise<GeneratePlanInput> {
  const subjects = await subjectRepository.findManyByUserWithTopics(userId);
  const availability = await studyRepository.getAvailability(userId);

  // I-2 (capa 2): debilidad (objetiva) + intensidad + materias prioritarias (preferencia). Si algo falla,
  // degradamos a SIN señal (mapa vacío / prioridades vacías) ⇒ el planner se comporta byte-idéntico a hoy.
  let weaknessMap = new Map<string, number>();
  let alpha = 0;
  let prioritySubjectIds: string[] = [];
  try {
    const [map, prefs] = await Promise.all([
      progressService.getWeaknessMap(userId),
      preferencesService.get(userId),
    ]);
    weaknessMap = map;
    alpha = INTENSITY_ALPHA[prefs.remediationIntensity];
    prioritySubjectIds = prefs.prioritySubjectIds;
  } catch (err) {
    logger.error('planner: weakness/priority enrichment failed; degradando a baseline de hoy', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      examDate: s.examDate ? s.examDate.toISOString() : null,
    })),
    topics: subjects.flatMap((s) =>
      s.topics.map((t) => ({
        id: t.id,
        subjectId: t.subjectId,
        name: t.name,
        status: t.status as TopicStatus,
        difficulty: t.difficulty as TopicDifficulty,
        weakness: weaknessMap.get(t.id) ?? 0,
      })),
    ),
    availability: availability.map((a) => ({ weekday: a.weekday, minutes: a.minutes })),
    remediationAlpha: alpha,
    prioritySubjectIds,
  };
}

async function getActivePlanForUser(userId: string): Promise<StudyPlanWithItems | null> {
  const row = await studyRepository.getActivePlanWithItems(userId);
  return row ? toPlanWithItems(row) : null;
}

// Recálculo incremental DETERMINISTA (sin IA): redistribuye lo pendiente en los días
// restantes. La IA queda reservada para la generación explícita (generatePlan).
async function recalcActivePlan(userId: string): Promise<StudyPlanWithItems | null> {
  const active = await studyRepository.getActivePlanWithItems(userId);
  if (!active) return null; // sin plan activo no hay nada que recalcular
  const input = await buildPlanInput(userId);
  const days = generateStudyPlanBaseline(input);
  const updated = await studyRepository.regenerateFutureItems(
    active.id,
    startOfTodayUTC(),
    flattenDays(days),
  );
  return toPlanWithItems(updated);
}

export const plannerService = {
  // ---- Materias ----
  async listSubjects(userId: string): Promise<SubjectWithTopics[]> {
    const rows = await subjectRepository.findManyByUserWithTopics(userId);
    return rows.map(toSubjectWithTopics);
  },

  async getSubject(id: string, userId: string): Promise<SubjectWithTopics> {
    const row = await subjectRepository.findByIdAndUserWithTopics(id, userId);
    if (!row) throw new AppError('NOT_FOUND', 'Materia no encontrada');
    return toSubjectWithTopics(row);
  },

  async createSubject(userId: string, input: CreateSubjectInput): Promise<Subject> {
    const created = await subjectRepository.create({
      userId,
      name: input.name,
      examDate: input.examDate ? new Date(input.examDate) : null,
      color: input.color ?? null,
    });
    return toSubject(created);
  },

  async updateSubject(id: string, userId: string, input: UpdateSubjectInput): Promise<Subject> {
    const existing = await subjectRepository.findByIdAndUser(id, userId);
    if (!existing) throw new AppError('NOT_FOUND', 'Materia no encontrada');
    const data: Prisma.SubjectUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.examDate !== undefined) data.examDate = input.examDate ? new Date(input.examDate) : null;
    if (input.color !== undefined) data.color = input.color ?? null;
    const updated = await subjectRepository.update(id, data);
    return toSubject(updated);
  },

  async deleteSubject(id: string, userId: string): Promise<void> {
    const existing = await subjectRepository.findByIdAndUser(id, userId);
    if (!existing) throw new AppError('NOT_FOUND', 'Materia no encontrada');
    await subjectRepository.deleteById(id);
  },

  // ---- Temas ----
  async listTopics(subjectId: string, userId: string): Promise<Topic[]> {
    const subject = await subjectRepository.findByIdAndUserWithTopics(subjectId, userId);
    if (!subject) throw new AppError('NOT_FOUND', 'Materia no encontrada');
    return subject.topics.map(toTopic);
  },

  async createTopic(subjectId: string, userId: string, input: CreateTopicInput): Promise<Topic> {
    const subject = await subjectRepository.findByIdAndUser(subjectId, userId);
    if (!subject) throw new AppError('NOT_FOUND', 'Materia no encontrada');
    const data: Prisma.TopicUncheckedCreateInput = {
      subjectId,
      userId, // denormalizado al crear; nunca se transfiere (§3.4)
      name: input.name,
      ...(input.description != null ? { description: input.description } : {}),
      ...(input.difficulty !== undefined
        ? { difficulty: input.difficulty as PrismaTopic['difficulty'] }
        : {}),
    };
    const created = await topicRepository.create(data);
    return toTopic(created);
  },

  async updateTopic(id: string, userId: string, input: UpdateTopicInput): Promise<Topic> {
    const existing = await topicRepository.findByIdAndUser(id, userId);
    if (!existing) throw new AppError('NOT_FOUND', 'Tema no encontrado');
    const data: Prisma.TopicUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.difficulty !== undefined) {
      data.difficulty = input.difficulty as PrismaTopic['difficulty'];
    }
    const updated = await topicRepository.update(id, data);
    return toTopic(updated);
  },

  async deleteTopic(id: string, userId: string): Promise<void> {
    const existing = await topicRepository.findByIdAndUser(id, userId);
    if (!existing) throw new AppError('NOT_FOUND', 'Tema no encontrado');
    await topicRepository.deleteById(id);
  },

  // Completar/cambiar estado de un tema → recálculo determinista del plan activo.
  async updateTopicStatus(
    id: string,
    userId: string,
    status: TopicStatus,
  ): Promise<{ topic: Topic; plan: StudyPlanWithItems | null }> {
    const existing = await topicRepository.findByIdAndUser(id, userId);
    if (!existing) throw new AppError('NOT_FOUND', 'Tema no encontrado');
    const completedAt = status === TopicStatus.COMPLETED ? new Date() : null;
    const updated = await topicRepository.update(id, {
      status: status as PrismaTopic['status'],
      completedAt,
    });
    // F (contexto compartido): el cambio de estado del tema ajusta la rotación SRS de SUS flashcards
    // (COMPLETED/IN_PROGRESS → activar; PENDING → pausar). Coupling limpio: el flashcardService es
    // dueño de esa data — el planner delega, nunca toca las tablas de flashcards. Ver error.md.
    await flashcardService.onTopicStatusChanged(userId, id, status);
    const plan = await recalcActivePlan(userId);
    return { topic: toTopic(updated), plan };
  },

  // ---- Disponibilidad ----
  async getAvailability(userId: string): Promise<StudyAvailability[]> {
    const rows = await studyRepository.getAvailability(userId);
    return rows.map(toAvailability);
  },

  async setAvailability(userId: string, input: SetAvailabilityInput): Promise<StudyAvailability[]> {
    const rows = await studyRepository.replaceAvailability(userId, input.days);
    return rows.map(toAvailability);
  },

  // ---- Plan ----
  async getActivePlan(userId: string): Promise<StudyPlanWithItems | null> {
    return getActivePlanForUser(userId);
  },

  // Generación/regeneración explícita: distribución determinista + refinamiento IA
  // (degrada al baseline si falta AI_API_KEY o la IA falla — nunca rompe). Archiva el
  // plan ACTIVE anterior y crea uno nuevo.
  async generatePlan(userId: string): Promise<StudyPlanWithItems> {
    const input = await buildPlanInput(userId);
    const days = await generateStudyPlan(input);
    const created = await studyRepository.createActivePlan(userId, flattenDays(days));
    return toPlanWithItems(created);
  },

  // Marcar un bloque del día. Ownership vía el plan padre (StudyPlanItem no tiene userId, §3.4).
  // SKIPPED adapta el plan (recálculo determinista); COMPLETED solo registra el bloque.
  async updatePlanItem(
    id: string,
    userId: string,
    status: StudyPlanItemStatus,
  ): Promise<{ item: StudyPlanItem; plan: StudyPlanWithItems | null }> {
    const row = await studyRepository.findPlanItemWithOwner(id);
    if (!row || row.plan.userId !== userId) {
      throw new AppError('NOT_FOUND', 'Bloque de plan no encontrado');
    }
    const completedAt = status === StudyPlanItemStatus.COMPLETED ? new Date() : null;
    const updated = await studyRepository.updatePlanItemStatus(
      id,
      status as PrismaStudyPlanItem['status'],
      completedAt,
    );
    const plan =
      status === StudyPlanItemStatus.SKIPPED
        ? await recalcActivePlan(userId)
        : await getActivePlanForUser(userId);
    return { item: toPlanItem(updated), plan };
  },
};

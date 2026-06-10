import { prisma } from '../../prisma/client.js';
import type { StudyAvailability, StudyPlan, StudyPlanItem, Topic } from '@prisma/client';

// Bloque a persistir: el service ya resolvió la distribución (vía lib/ai) y mapeó date→Date.
export interface NewPlanItem {
  topicId: string;
  date: Date;
  order: number | null;
  estimatedMinutes: number;
}

export type PlanItemWithTopicRow = StudyPlanItem & { topic: Topic };
export type PlanWithItemsRow = StudyPlan & { items: PlanItemWithTopicRow[] };
export type PlanItemWithOwner = StudyPlanItem & { plan: { id: string; userId: string } };

export const studyRepository = {
  // ---- Disponibilidad ----
  getAvailability(userId: string): Promise<StudyAvailability[]> {
    return prisma.studyAvailability.findMany({ where: { userId }, orderBy: { weekday: 'asc' } });
  },

  // Set bulk de la semana: reemplazo atómico (una config por día — @@unique([userId, weekday])).
  replaceAvailability(
    userId: string,
    days: { weekday: number; minutes: number }[],
  ): Promise<StudyAvailability[]> {
    return prisma.$transaction(async (tx) => {
      await tx.studyAvailability.deleteMany({ where: { userId } });
      if (days.length > 0) {
        await tx.studyAvailability.createMany({
          data: days.map((d) => ({ userId, weekday: d.weekday, minutes: d.minutes })),
        });
      }
      return tx.studyAvailability.findMany({ where: { userId }, orderBy: { weekday: 'asc' } });
    });
  },

  // ---- Plan ----
  getActivePlanWithItems(userId: string): Promise<PlanWithItemsRow | null> {
    return prisma.studyPlan.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { items: { include: { topic: true }, orderBy: [{ date: 'asc' }, { order: 'asc' }] } },
    });
  },

  // Generación explícita: archiva el ACTIVE anterior y crea uno nuevo con sus bloques.
  createActivePlan(userId: string, items: NewPlanItem[]): Promise<PlanWithItemsRow> {
    return prisma.$transaction(async (tx) => {
      await tx.studyPlan.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      const plan = await tx.studyPlan.create({ data: { userId } });
      if (items.length > 0) {
        await tx.studyPlanItem.createMany({
          data: items.map((i) => ({
            planId: plan.id,
            topicId: i.topicId,
            date: i.date,
            order: i.order,
            estimatedMinutes: i.estimatedMinutes,
          })),
        });
      }
      return tx.studyPlan.findFirstOrThrow({
        where: { id: plan.id },
        include: {
          items: { include: { topic: true }, orderBy: [{ date: 'asc' }, { order: 'asc' }] },
        },
      });
    });
  },

  // Recálculo incremental (determinista, sin IA): reescribe SOLO los bloques futuros PENDING,
  // preservando el historial (COMPLETED/SKIPPED y todo lo anterior a `fromDate`). Muta el MISMO
  // plan ACTIVE (no archiva, no crea uno nuevo).
  regenerateFutureItems(
    planId: string,
    fromDate: Date,
    items: NewPlanItem[],
  ): Promise<PlanWithItemsRow> {
    return prisma.$transaction(async (tx) => {
      await tx.studyPlanItem.deleteMany({
        where: { planId, status: 'PENDING', date: { gte: fromDate } },
      });
      if (items.length > 0) {
        await tx.studyPlanItem.createMany({
          data: items.map((i) => ({
            planId,
            topicId: i.topicId,
            date: i.date,
            order: i.order,
            estimatedMinutes: i.estimatedMinutes,
          })),
        });
      }
      await tx.studyPlan.update({ where: { id: planId }, data: { generatedAt: new Date() } });
      return tx.studyPlan.findFirstOrThrow({
        where: { id: planId },
        include: {
          items: { include: { topic: true }, orderBy: [{ date: 'asc' }, { order: 'asc' }] },
        },
      });
    });
  },

  // ---- Items (ownership vía plan padre — StudyPlanItem no tiene userId, §3.4) ----
  findPlanItemWithOwner(id: string): Promise<PlanItemWithOwner | null> {
    return prisma.studyPlanItem.findUnique({
      where: { id },
      include: { plan: { select: { id: true, userId: true } } },
    });
  },

  updatePlanItemStatus(
    id: string,
    status: StudyPlanItem['status'],
    completedAt: Date | null,
  ): Promise<StudyPlanItem> {
    return prisma.studyPlanItem.update({ where: { id }, data: { status, completedAt } });
  },
};

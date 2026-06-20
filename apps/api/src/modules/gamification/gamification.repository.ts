import type {
  DailyBoss as PrismaDailyBoss,
  DailyQuest as PrismaDailyQuest,
  GamificationProfile as PrismaProfile,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import type { QuestTemplate } from './gamification.rules.js';

// ============================================================================
// Repositorio de Gamificación (Agente J) — SOLO Prisma. Ownership por `userId` denormalizado (§3.4).
// Creación LAZY idempotente (perfil 1:1, quests por @@unique([userId,date,type]), jefe por
// @@unique([userId,date])) → seguro ante carreras. Las mutaciones de XP/racha/quest/jefe (F4) viven acá.
// ============================================================================

export const gamificationRepository = {
  // ---- Perfil del jugador ----
  async findProfile(userId: string): Promise<PrismaProfile | null> {
    return prisma.gamificationProfile.findUnique({ where: { userId } });
  },

  // Idempotente: crea el perfil con defaults si no existe (no pisa valores existentes).
  async ensureProfile(userId: string): Promise<PrismaProfile> {
    return prisma.gamificationProfile.upsert({
      where: { userId },
      update: {},
      create: { user: { connect: { id: userId } } },
    });
  },

  async updateProfile(userId: string, data: Prisma.GamificationProfileUpdateInput): Promise<PrismaProfile> {
    return prisma.gamificationProfile.update({ where: { userId }, data });
  },

  // ---- Misiones del día ----
  async findQuestsByDate(userId: string, date: Date): Promise<PrismaDailyQuest[]> {
    return prisma.dailyQuest.findMany({ where: { userId, date }, orderBy: { type: 'asc' } });
  },

  // createMany + skipDuplicates: idempotente y race-safe (el @@unique([userId,date,type]) frena los dup).
  async createQuests(userId: string, date: Date, templates: QuestTemplate[]): Promise<void> {
    await prisma.dailyQuest.createMany({
      data: templates.map((t) => ({
        userId,
        date,
        type: t.type as PrismaDailyQuest['type'],
        target: t.target,
        xpReward: t.xpReward,
      })),
      skipDuplicates: true,
    });
  },

  async findQuestById(id: string): Promise<PrismaDailyQuest | null> {
    return prisma.dailyQuest.findUnique({ where: { id } });
  },

  async updateQuest(id: string, data: Prisma.DailyQuestUpdateInput): Promise<PrismaDailyQuest> {
    return prisma.dailyQuest.update({ where: { id }, data });
  },

  // ---- Jefe del día ----
  async findBossByDate(userId: string, date: Date): Promise<PrismaDailyBoss | null> {
    return prisma.dailyBoss.findUnique({ where: { userId_date: { userId, date } } });
  },

  // Idempotente (upsert por @@unique([userId,date])): si ya existe el jefe de hoy, no lo recrea.
  async createBoss(
    userId: string,
    date: Date,
    data: {
      topicId: string | null;
      topicName: string;
      subjectName: string;
      maxHp: number;
      hp: number;
      xpReward: number;
    },
  ): Promise<PrismaDailyBoss> {
    return prisma.dailyBoss.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: {
        user: { connect: { id: userId } },
        date,
        ...(data.topicId !== null ? { topic: { connect: { id: data.topicId } } } : {}),
        topicName: data.topicName,
        subjectName: data.subjectName,
        maxHp: data.maxHp,
        hp: data.hp,
        xpReward: data.xpReward,
      },
    });
  },

  async updateBoss(id: string, data: Prisma.DailyBossUpdateInput): Promise<PrismaDailyBoss> {
    return prisma.dailyBoss.update({ where: { id }, data });
  },
};

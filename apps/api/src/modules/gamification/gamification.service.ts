import type {
  DailyBoss as PrismaDailyBoss,
  DailyQuest as PrismaDailyQuest,
  GamificationProfile as PrismaProfile,
} from '@prisma/client';
import {
  BossStatus,
  QuestStatus,
  QuestType,
  levelForXp,
  BOSS_HP,
  BOSS_XP_REWARD,
} from '@bract/shared';
import type { DailyBoss, DailyQuest, GamificationProfile, GamificationSummary } from '@bract/shared';
import { logger } from '../../lib/logger.js';
import { progressService } from '../progress/progress.service.js';
import { gamificationRepository } from './gamification.repository.js';
import { buildQuestTemplates, utcDateOnly } from './gamification.rules.js';

// ============================================================================
// Gamificación (Agente J) — lógica de negocio. Recibe DTOs (nunca req), mapea Prisma→shared (Date→ISO,
// enum casteado), deriva el nivel con la fórmula compartida (levelForXp) y genera LAZY las misiones/jefe
// del día (idempotente). SOLO LECTURA acá; las mutaciones por efecto van en gamification.effects (F4).
// NO toca HTTP. README §3.7.
// ============================================================================

// ---- Mappers Prisma → contrato @bract/shared ------------------------------
// DECISIÓN: cast de enum Prisma → enum compartido (mismatch nominal de TS); mismo patrón que el resto.

function toProfile(p: PrismaProfile): GamificationProfile {
  const info = levelForXp(p.totalXp);
  return {
    totalXp: p.totalXp,
    level: info.level,
    xpIntoLevel: info.xpIntoLevel,
    xpForNextLevel: info.xpForNextLevel,
    currentStreak: p.currentStreak,
    longestStreak: p.longestStreak,
    freezeTokens: p.freezeTokens,
    lastStudyDate: p.lastStudyDate ? p.lastStudyDate.toISOString() : null,
  };
}

function toQuest(q: PrismaDailyQuest): DailyQuest {
  return {
    type: q.type as QuestType,
    target: q.target,
    progress: q.progress,
    status: q.status as QuestStatus,
    xpReward: q.xpReward,
    completedAt: q.completedAt ? q.completedAt.toISOString() : null,
  };
}

function toBoss(b: PrismaDailyBoss): DailyBoss {
  return {
    topicId: b.topicId,
    topicName: b.topicName,
    subjectName: b.subjectName,
    maxHp: b.maxHp,
    hp: b.hp,
    status: b.status as BossStatus,
    xpReward: b.xpReward,
    defeatedAt: b.defeatedAt ? b.defeatedAt.toISOString() : null,
  };
}

// Resuelve el jefe de hoy: lo lee, y si falta lo crea desde el tema más flojo de I-2. Si el motor de
// progreso falla, degrada a "sin jefe" (try/catch) — nunca rompe el summary.
async function resolveBoss(userId: string, today: Date): Promise<PrismaDailyBoss | null> {
  const existing = await gamificationRepository.findBossByDate(userId, today);
  if (existing) return existing;

  try {
    const weakest = (await progressService.getWeakTopics(userId, 1))[0];
    if (!weakest) return null; // sin datos de debilidad ⇒ no hay jefe hoy
    return await gamificationRepository.createBoss(userId, today, {
      topicId: weakest.topicId,
      topicName: weakest.name,
      subjectName: weakest.subjectName,
      maxHp: BOSS_HP,
      hp: BOSS_HP,
      xpReward: BOSS_XP_REWARD,
    });
  } catch (err) {
    logger.warn('gamification: no se pudo resolver el jefe del día', { userId, err });
    return null;
  }
}

// Asegura el estado del día (idempotente): resuelve el jefe (lazy desde I-2) y crea el set de misiones
// si falta. Se llama tanto al LEER el summary como al aplicar el PRIMER efecto del día (gamification.
// effects) — así una acción previa a abrir la Home igual cuenta. El jefe se resuelve PRIMERO porque
// define si la 3ra misión es DEFEAT_BOSS o COMPLETE_PLAN_ITEMS.
export async function ensureDailyState(userId: string, now: Date = new Date()): Promise<void> {
  const today = utcDateOnly(now);
  const boss = await resolveBoss(userId, today);
  const quests = await gamificationRepository.findQuestsByDate(userId, today);
  if (quests.length === 0) {
    await gamificationRepository.createQuests(userId, today, buildQuestTemplates(boss !== null));
  }
}

export const gamificationService = {
  // GET /gamification/summary: perfil + misiones de hoy + jefe de hoy (genera lazy lo que falte).
  async getSummary(userId: string): Promise<GamificationSummary> {
    const now = new Date();
    const today = utcDateOnly(now);
    const profile = await gamificationRepository.ensureProfile(userId);

    await ensureDailyState(userId, now);
    const quests = await gamificationRepository.findQuestsByDate(userId, today);
    const boss = await gamificationRepository.findBossByDate(userId, today);

    return {
      profile: toProfile(profile),
      quests: quests.map(toQuest),
      boss: boss ? toBoss(boss) : null,
    };
  },
};

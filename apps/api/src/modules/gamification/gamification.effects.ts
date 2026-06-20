import type { Prisma } from '@prisma/client';
import { BossStatus as PrismaBossStatus, QuestStatus as PrismaQuestStatus } from '@prisma/client';
import { OpenGrade, QuestStatus, QuestType, XP } from '@bract/shared';
import { logger } from '../../lib/logger.js';
import { gamificationRepository } from './gamification.repository.js';
import { ensureDailyState } from './gamification.service.js';
import {
  advanceQuestProgress,
  applyBossDamage,
  applyStreakOnActivity,
  effectiveXpEarnedToday,
  grantActionXp,
  utcDateOnly,
} from './gamification.rules.js';

// ============================================================================
// Gamificación (Agente J) — EFECTOS (write path). Se disparan POR EFECTO de acciones reales (responder
// quiz, repasar carta vencida, completar item del plan/tema): otorgan XP (capeado), avanzan misiones, dañan
// al jefe y actualizan la racha. El cliente NUNCA llama esto directo (anti-trampa). Premia APRENDER, no
// actividad vacía. Cada efecto es BEST-EFFORT: los services delegan vía `safeGamify` → un fallo acá NUNCA
// rompe la acción del usuario (quiz/flashcards/planner se comportan idéntico a hoy). README §3.7.
// ============================================================================

// Envoltorio best-effort: corre el efecto y traga cualquier error (lo loguea). Los services lo usan para
// delegar sin propagar — la gamificación es secundaria a la acción real.
export async function safeGamify(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (err) {
    logger.warn('gamification: efecto degradado (la acción del usuario no se ve afectada)', { err });
  }
}

interface CommitInput {
  actionXp: number; // XP "por acción" (sujeto al tope diario)
  countsForStreak: boolean;
  questType?: QuestType; // misión a avanzar (si aplica)
  questAmount?: number;
  masteryTopicId?: string | null; // tema de la acción de DOMINIO → daña al jefe si coincide
}

// Avanza una misión del día; si la completa, devuelve su recompensa de XP (para sumarla al total).
async function advanceQuest(userId: string, today: Date, type: QuestType, amount: number): Promise<number> {
  const quests = await gamificationRepository.findQuestsByDate(userId, today);
  const quest = quests.find((q) => (q.type as QuestType) === type);
  if (!quest) return 0;
  const r = advanceQuestProgress(quest.progress, quest.target, quest.status as QuestStatus, amount);
  if (r.progress === quest.progress && r.status === (quest.status as QuestStatus)) return 0;
  const data: Prisma.DailyQuestUpdateInput = {
    progress: r.progress,
    status: r.status as PrismaQuestStatus,
    ...(r.justCompleted ? { completedAt: new Date() } : {}),
  };
  await gamificationRepository.updateQuest(quest.id, data);
  return r.justCompleted ? quest.xpReward : 0;
}

// Núcleo: aplica daño al jefe + avance de misión + XP (acción capeada + recompensas) + racha, en una
// sola lectura/escritura del perfil. Garantiza el estado del día PRIMERO (misiones/jefe) para que una
// acción previa a abrir la Home igual cuente.
async function commit(userId: string, input: CommitInput, now: Date): Promise<void> {
  const today = utcDateOnly(now);
  await ensureDailyState(userId, now);

  let rewardXp = 0;

  // 1) Daño al jefe si la acción es de DOMINIO sobre el tema-jefe.
  if (input.masteryTopicId) {
    const boss = await gamificationRepository.findBossByDate(userId, today);
    if (boss && boss.status === PrismaBossStatus.ACTIVE && boss.topicId === input.masteryTopicId) {
      const { hp, defeated } = applyBossDamage(boss.hp, 1);
      await gamificationRepository.updateBoss(boss.id, {
        hp,
        ...(defeated ? { status: PrismaBossStatus.DEFEATED, defeatedAt: now } : {}),
      });
      if (defeated) {
        rewardXp += boss.xpReward;
        rewardXp += await advanceQuest(userId, today, QuestType.DEFEAT_BOSS, 1);
      }
    }
  }

  // 2) Avanzar la misión nombrada (si aplica).
  if (input.questType && input.questAmount && input.questAmount > 0) {
    rewardXp += await advanceQuest(userId, today, input.questType, input.questAmount);
  }

  // 3) XP (acción capeada + recompensas uncapped) + racha, en un solo update del perfil.
  const profile = await gamificationRepository.ensureProfile(userId);
  const effToday = effectiveXpEarnedToday(profile.xpEarnedToday, profile.xpTodayDate, now);
  const { granted, xpEarnedToday } = grantActionXp(effToday, input.actionXp);

  const data: Prisma.GamificationProfileUpdateInput = {
    totalXp: { increment: granted + rewardXp },
    xpEarnedToday,
    xpTodayDate: today,
  };

  if (input.countsForStreak) {
    const s = applyStreakOnActivity(
      {
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        freezeTokens: profile.freezeTokens,
        lastStudyDate: profile.lastStudyDate,
      },
      now,
    );
    if (s.changed) {
      data.currentStreak = s.currentStreak;
      data.longestStreak = s.longestStreak;
      data.freezeTokens = s.freezeTokens;
      data.lastStudyDate = today;
    }
  }

  await gamificationRepository.updateProfile(userId, data);
}

export const gamificationEffects = {
  // Repaso SRS: SOLO las cartas vencidas dan XP (anti-farmeo). Bonus + daño al jefe si el recuerdo fue bueno.
  async onFlashcardReviewed(
    userId: string,
    p: { wasDue: boolean; quality: number; topicId: string },
    now: Date = new Date(),
  ): Promise<void> {
    if (!p.wasDue) return;
    const recall = p.quality >= 4;
    await commit(
      userId,
      {
        actionXp: XP.REVIEW_DUE_CARD + (recall ? XP.REVIEW_RECALL_BONUS : 0),
        countsForStreak: true,
        questType: QuestType.REVIEW_DUE_CARDS,
        questAmount: 1,
        masteryTopicId: recall ? p.topicId : null,
      },
      now,
    );
  },

  // Responder una pregunta de quiz (MCQ con isCorrect; OPEN al registrar va isCorrect=false → solo
  // participación, la maestría llega al corregir vía onOpenGraded). Al completar el intento suma el bonus
  // de "completar quiz" y avanza esa misión.
  async onQuizAnswered(
    userId: string,
    p: { isCorrect: boolean; topicId: string | null; attemptCompleted: boolean },
    now: Date = new Date(),
  ): Promise<void> {
    await commit(
      userId,
      {
        actionXp:
          XP.QUIZ_ANSWER +
          (p.isCorrect ? XP.QUIZ_CORRECT_BONUS : 0) +
          (p.attemptCompleted ? XP.QUIZ_COMPLETED : 0),
        countsForStreak: true,
        ...(p.attemptCompleted ? { questType: QuestType.COMPLETE_QUIZ, questAmount: 1 } : {}),
        masteryTopicId: p.isCorrect ? p.topicId : null,
      },
      now,
    );
  },

  // Corrección de una abierta (aparte de responder). Bonus por dominio (CORRECT/PARTIAL) + daño al jefe si
  // CORRECT. La racha NO se toca acá: ya contó al RESPONDER (onQuizAnswered del registro).
  async onOpenGraded(
    userId: string,
    p: { grade: OpenGrade; topicId: string | null },
    now: Date = new Date(),
  ): Promise<void> {
    const correct = p.grade === OpenGrade.CORRECT;
    const actionXp = correct ? XP.OPEN_CORRECT : p.grade === OpenGrade.PARTIAL ? XP.OPEN_PARTIAL : 0;
    await commit(
      userId,
      {
        actionXp,
        countsForStreak: false,
        masteryTopicId: correct ? p.topicId : null,
      },
      now,
    );
  },

  async onPlanItemCompleted(userId: string, now: Date = new Date()): Promise<void> {
    await commit(
      userId,
      {
        actionXp: XP.PLAN_ITEM_COMPLETED,
        countsForStreak: true,
        questType: QuestType.COMPLETE_PLAN_ITEMS,
        questAmount: 1,
      },
      now,
    );
  },

  async onTopicCompleted(userId: string, now: Date = new Date()): Promise<void> {
    await commit(userId, { actionXp: XP.TOPIC_COMPLETED, countsForStreak: true }, now);
  },
};

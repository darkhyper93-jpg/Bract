import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DailyBoss as PrismaDailyBoss,
  DailyQuest as PrismaDailyQuest,
  GamificationProfile as PrismaProfile,
} from '@prisma/client';
import {
  BOSS_XP_REWARD,
  DAILY_ACTION_XP_CAP,
  OpenGrade,
  QUEST_XP,
  QuestType,
  XP,
} from '@bract/shared';

// El service (ensureDailyState) y el repo (Prisma) se mockean: los efectos corren REAL, sin DB.
vi.mock('../gamification.service.js', () => ({
  ensureDailyState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../gamification.repository.js', () => ({
  gamificationRepository: {
    ensureProfile: vi.fn(),
    updateProfile: vi.fn(),
    findQuestsByDate: vi.fn(),
    updateQuest: vi.fn(),
    findBossByDate: vi.fn(),
    updateBoss: vi.fn(),
  },
}));

import { gamificationRepository } from '../gamification.repository.js';
import { gamificationEffects, safeGamify } from '../gamification.effects.js';

const NOW = new Date('2026-06-20T12:00:00.000Z');
const TODAY = new Date('2026-06-20T00:00:00.000Z');
const USER = 'u1';
const TOPIC = 't-boss';

function makeProfile(over: Partial<PrismaProfile> = {}): PrismaProfile {
  return {
    id: 'p1',
    userId: USER,
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    freezeTokens: 0,
    xpEarnedToday: 0,
    xpTodayDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as PrismaProfile;
}

function makeBoss(over: Partial<PrismaDailyBoss> = {}): PrismaDailyBoss {
  return {
    id: 'b1',
    userId: USER,
    date: TODAY,
    topicId: TOPIC,
    topicName: 'Tema jefe',
    subjectName: 'Materia',
    maxHp: 5,
    hp: 5,
    status: 'ACTIVE',
    xpReward: BOSS_XP_REWARD,
    defeatedAt: null,
    createdAt: NOW,
    ...over,
  } as PrismaDailyBoss;
}

function makeQuest(type: QuestType, over: Partial<PrismaDailyQuest> = {}): PrismaDailyQuest {
  return {
    id: `q-${type}`,
    userId: USER,
    date: TODAY,
    type: type as PrismaDailyQuest['type'],
    target: 10,
    progress: 0,
    status: 'ACTIVE',
    xpReward: 20,
    completedAt: null,
    createdAt: NOW,
    ...over,
  } as PrismaDailyQuest;
}

// Devuelve el `data` con el que se llamó updateProfile (las mutaciones de XP/racha terminan acá).
function profileUpdateData(): Record<string, unknown> {
  const call = vi.mocked(gamificationRepository.updateProfile).mock.calls.at(-1);
  return (call?.[1] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(gamificationRepository.ensureProfile).mockResolvedValue(makeProfile());
  vi.mocked(gamificationRepository.updateProfile).mockResolvedValue(makeProfile());
  vi.mocked(gamificationRepository.findQuestsByDate).mockResolvedValue([]);
  vi.mocked(gamificationRepository.updateQuest).mockResolvedValue(makeQuest(QuestType.COMPLETE_QUIZ));
  vi.mocked(gamificationRepository.findBossByDate).mockResolvedValue(null);
  vi.mocked(gamificationRepository.updateBoss).mockResolvedValue(makeBoss());
});

describe('safeGamify — degradación', () => {
  it('traga el error del efecto (la acción del usuario nunca se rompe)', async () => {
    await expect(
      safeGamify(async () => {
        throw new Error('boom');
      }),
    ).resolves.toBeUndefined();
  });
});

describe('onFlashcardReviewed', () => {
  it('carta NO vencida: no otorga nada (anti-farmeo)', async () => {
    await gamificationEffects.onFlashcardReviewed(USER, { wasDue: false, quality: 5, topicId: TOPIC }, NOW);
    expect(gamificationRepository.ensureProfile).not.toHaveBeenCalled();
    expect(gamificationRepository.updateProfile).not.toHaveBeenCalled();
  });

  it('carta vencida con buen recuerdo (q≥4): XP base+bonus, daña al jefe del tema y cuenta racha', async () => {
    vi.mocked(gamificationRepository.findBossByDate).mockResolvedValue(makeBoss({ hp: 5 }));
    await gamificationEffects.onFlashcardReviewed(USER, { wasDue: true, quality: 5, topicId: TOPIC }, NOW);

    // 1 de daño al jefe (5 → 4), sin vencerlo.
    expect(gamificationRepository.updateBoss).toHaveBeenCalledWith('b1', { hp: 4 });
    // XP de acción = base + bonus de recuerdo; racha cuenta (primera actividad → 1).
    const data = profileUpdateData();
    expect(data['totalXp']).toEqual({ increment: XP.REVIEW_DUE_CARD + XP.REVIEW_RECALL_BONUS });
    expect(data['currentStreak']).toBe(1);
  });

  it('carta vencida con mal recuerdo (q<4): XP base sin bonus y NO daña al jefe', async () => {
    vi.mocked(gamificationRepository.findBossByDate).mockResolvedValue(makeBoss({ hp: 5 }));
    await gamificationEffects.onFlashcardReviewed(USER, { wasDue: true, quality: 3, topicId: TOPIC }, NOW);

    expect(gamificationRepository.updateBoss).not.toHaveBeenCalled();
    expect(profileUpdateData()['totalXp']).toEqual({ increment: XP.REVIEW_DUE_CARD });
  });
});

describe('onQuizAnswered', () => {
  it('MCQ correcta que completa el intento: XP responder+correcta+completar y avanza misión de quiz', async () => {
    vi.mocked(gamificationRepository.findQuestsByDate).mockResolvedValue([
      makeQuest(QuestType.COMPLETE_QUIZ, { target: 1, progress: 0 }),
    ]);
    await gamificationEffects.onQuizAnswered(
      USER,
      { isCorrect: true, topicId: 't-otro', attemptCompleted: true },
      NOW,
    );

    // Misión COMPLETE_QUIZ pasa a COMPLETED.
    expect(gamificationRepository.updateQuest).toHaveBeenCalledWith(
      'q-COMPLETE_QUIZ',
      expect.objectContaining({ status: 'COMPLETED', progress: 1 }),
    );
    // XP acción = responder + correcta + completar; + recompensa de misión (uncapped).
    const data = profileUpdateData();
    const action = XP.QUIZ_ANSWER + XP.QUIZ_CORRECT_BONUS + XP.QUIZ_COMPLETED;
    expect(data['totalXp']).toEqual({ increment: action + QUEST_XP.COMPLETE_QUIZ });
  });

  it('respuesta incorrecta no daña al jefe', async () => {
    vi.mocked(gamificationRepository.findBossByDate).mockResolvedValue(makeBoss());
    await gamificationEffects.onQuizAnswered(
      USER,
      { isCorrect: false, topicId: TOPIC, attemptCompleted: false },
      NOW,
    );
    expect(gamificationRepository.updateBoss).not.toHaveBeenCalled();
    expect(profileUpdateData()['totalXp']).toEqual({ increment: XP.QUIZ_ANSWER });
  });

  it('correcta sobre el tema-jefe con 1 HP: lo vence → +recompensa de jefe y de la misión DEFEAT_BOSS', async () => {
    vi.mocked(gamificationRepository.findBossByDate).mockResolvedValue(makeBoss({ hp: 1 }));
    vi.mocked(gamificationRepository.findQuestsByDate).mockResolvedValue([
      makeQuest(QuestType.DEFEAT_BOSS, { target: 1, progress: 0, xpReward: QUEST_XP.DEFEAT_BOSS }),
    ]);
    await gamificationEffects.onQuizAnswered(
      USER,
      { isCorrect: true, topicId: TOPIC, attemptCompleted: false },
      NOW,
    );

    // Jefe a 0 + DEFEATED.
    expect(gamificationRepository.updateBoss).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ hp: 0, status: 'DEFEATED', defeatedAt: NOW }),
    );
    const data = profileUpdateData();
    const action = XP.QUIZ_ANSWER + XP.QUIZ_CORRECT_BONUS;
    expect(data['totalXp']).toEqual({
      increment: action + BOSS_XP_REWARD + QUEST_XP.DEFEAT_BOSS,
    });
  });
});

describe('onOpenGraded', () => {
  it('CORRECT: XP de dominio, daña al jefe y NO toca la racha', async () => {
    vi.mocked(gamificationRepository.findBossByDate).mockResolvedValue(makeBoss({ hp: 5 }));
    await gamificationEffects.onOpenGraded(USER, { grade: OpenGrade.CORRECT, topicId: TOPIC }, NOW);

    expect(gamificationRepository.updateBoss).toHaveBeenCalledWith('b1', { hp: 4 });
    const data = profileUpdateData();
    expect(data['totalXp']).toEqual({ increment: XP.OPEN_CORRECT });
    expect(data['currentStreak']).toBeUndefined(); // countsForStreak=false
  });

  it('INCORRECT: 0 XP de bonus y no daña al jefe', async () => {
    vi.mocked(gamificationRepository.findBossByDate).mockResolvedValue(makeBoss());
    await gamificationEffects.onOpenGraded(USER, { grade: OpenGrade.INCORRECT, topicId: TOPIC }, NOW);
    expect(gamificationRepository.updateBoss).not.toHaveBeenCalled();
    expect(profileUpdateData()['totalXp']).toEqual({ increment: 0 });
  });
});

describe('onPlanItemCompleted / onTopicCompleted', () => {
  it('completar item del plan: XP + avanza misión de plan + cuenta racha', async () => {
    vi.mocked(gamificationRepository.findQuestsByDate).mockResolvedValue([
      makeQuest(QuestType.COMPLETE_PLAN_ITEMS, { target: 2, progress: 1 }),
    ]);
    await gamificationEffects.onPlanItemCompleted(USER, NOW);

    expect(gamificationRepository.updateQuest).toHaveBeenCalledWith(
      'q-COMPLETE_PLAN_ITEMS',
      expect.objectContaining({ status: 'COMPLETED', progress: 2 }),
    );
    const data = profileUpdateData();
    // Item completa la misión (target 2, ya iba 1) → XP item + recompensa de misión.
    expect(data['totalXp']).toEqual({ increment: XP.PLAN_ITEM_COMPLETED + QUEST_XP.COMPLETE_PLAN_ITEMS });
    expect(data['currentStreak']).toBe(1);
  });

  it('completar tema: XP de dominio (sin misión asociada)', async () => {
    await gamificationEffects.onTopicCompleted(USER, NOW);
    expect(profileUpdateData()['totalXp']).toEqual({ increment: XP.TOPIC_COMPLETED });
  });
});

describe('tope diario de XP por acción', () => {
  it('clampa el XP de acción al cap (las recompensas de misión/jefe NO cuentan al tope)', async () => {
    vi.mocked(gamificationRepository.ensureProfile).mockResolvedValue(
      makeProfile({ xpEarnedToday: DAILY_ACTION_XP_CAP - 2, xpTodayDate: TODAY }),
    );
    vi.mocked(gamificationRepository.findQuestsByDate).mockResolvedValue([
      makeQuest(QuestType.COMPLETE_QUIZ, { target: 1, progress: 0 }),
    ]);
    await gamificationEffects.onQuizAnswered(
      USER,
      { isCorrect: true, topicId: 't-otro', attemptCompleted: true },
      NOW,
    );

    const data = profileUpdateData();
    // Acción topeada a 2 (lo que quedaba) + recompensa de misión completa (uncapped).
    expect(data['totalXp']).toEqual({ increment: 2 + QUEST_XP.COMPLETE_QUIZ });
    expect(data['xpEarnedToday']).toBe(DAILY_ACTION_XP_CAP);
  });
});

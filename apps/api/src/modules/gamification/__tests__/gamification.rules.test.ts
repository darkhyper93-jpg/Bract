import { describe, expect, it } from 'vitest';
import { QuestStatus, QuestType, DAILY_ACTION_XP_CAP, FREEZE_CAP, levelForXp } from '@bract/shared';
import {
  advanceQuestProgress,
  applyBossDamage,
  applyStreakOnActivity,
  buildQuestTemplates,
  daysBetween,
  effectiveXpEarnedToday,
  grantActionXp,
  utcDateOnly,
  type StreakState,
} from '../gamification.rules.js';

const D = (s: string): Date => new Date(s);

describe('utcDateOnly / daysBetween', () => {
  it('normaliza al día UTC e ignora la hora', () => {
    expect(utcDateOnly(D('2026-06-19T23:59:59.000Z')).toISOString()).toBe('2026-06-19T00:00:00.000Z');
  });
  it('cuenta días enteros (mismo día = 0, ayer→hoy = 1)', () => {
    expect(daysBetween(D('2026-06-19T10:00:00Z'), D('2026-06-19T22:00:00Z'))).toBe(0);
    expect(daysBetween(D('2026-06-18T10:00:00Z'), D('2026-06-19T01:00:00Z'))).toBe(1);
    expect(daysBetween(D('2026-06-19T00:00:00Z'), D('2026-06-15T00:00:00Z'))).toBe(-4);
  });
});

describe('levelForXp (curva compartida)', () => {
  it('Lv.1 en 0 XP; sube de forma monótona', () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(0).xpIntoLevel).toBe(0);
    const a = levelForXp(100).level;
    const b = levelForXp(1000).level;
    expect(b).toBeGreaterThan(a);
  });
  it('xpIntoLevel < xpForNextLevel (la barra nunca se desborda)', () => {
    const info = levelForXp(500);
    expect(info.xpIntoLevel).toBeGreaterThanOrEqual(0);
    expect(info.xpIntoLevel).toBeLessThan(info.xpForNextLevel);
  });
});

describe('buildQuestTemplates', () => {
  it('sin jefe: la 3ra misión es COMPLETE_PLAN_ITEMS', () => {
    const t = buildQuestTemplates(false);
    expect(t.map((q) => q.type)).toEqual([
      QuestType.COMPLETE_QUIZ,
      QuestType.REVIEW_DUE_CARDS,
      QuestType.COMPLETE_PLAN_ITEMS,
    ]);
  });
  it('con jefe: la 3ra misión es DEFEAT_BOSS', () => {
    const t = buildQuestTemplates(true);
    expect(t.map((q) => q.type)).toEqual([
      QuestType.COMPLETE_QUIZ,
      QuestType.REVIEW_DUE_CARDS,
      QuestType.DEFEAT_BOSS,
    ]);
  });
});

describe('applyStreakOnActivity — racha perdonadora', () => {
  const base: StreakState = { currentStreak: 0, longestStreak: 0, freezeTokens: 0, lastStudyDate: null };

  it('primera actividad: racha 1', () => {
    const r = applyStreakOnActivity(base, D('2026-06-19T12:00:00Z'));
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.changed).toBe(true);
  });

  it('misma fecha: no cambia (no se persiste)', () => {
    const state: StreakState = { ...base, currentStreak: 3, lastStudyDate: D('2026-06-19T00:00:00Z') };
    const r = applyStreakOnActivity(state, D('2026-06-19T20:00:00Z'));
    expect(r.changed).toBe(false);
    expect(r.currentStreak).toBe(3);
  });

  it('día siguiente: +1', () => {
    const state: StreakState = { ...base, currentStreak: 3, longestStreak: 3, lastStudyDate: D('2026-06-18T00:00:00Z') };
    const r = applyStreakOnActivity(state, D('2026-06-19T08:00:00Z'));
    expect(r.currentStreak).toBe(4);
    expect(r.longestStreak).toBe(4);
  });

  it('un día perdido con escudo: consume el escudo y continúa', () => {
    const state: StreakState = { ...base, currentStreak: 6, longestStreak: 6, freezeTokens: 1, lastStudyDate: D('2026-06-17T00:00:00Z') };
    const r = applyStreakOnActivity(state, D('2026-06-19T08:00:00Z')); // se perdió el 18
    expect(r.currentStreak).toBe(7);
    expect(r.freezeTokens).toBe(0);
    expect(r.streakStartedOver).toBe(false);
  });

  it('días perdidos sin escudos suficientes: reinicia a 1 sin penalizar', () => {
    const state: StreakState = { ...base, currentStreak: 12, longestStreak: 12, freezeTokens: 0, lastStudyDate: D('2026-06-15T00:00:00Z') };
    const r = applyStreakOnActivity(state, D('2026-06-19T08:00:00Z'));
    expect(r.currentStreak).toBe(1);
    expect(r.streakStartedOver).toBe(true);
    expect(r.longestStreak).toBe(12); // récord preservado (nunca se pierde XP/nivel ni récord)
  });

  it('gana un escudo al cruzar un múltiplo de 5 (cap incluido)', () => {
    const state: StreakState = { ...base, currentStreak: 4, longestStreak: 4, freezeTokens: 0, lastStudyDate: D('2026-06-18T00:00:00Z') };
    const r = applyStreakOnActivity(state, D('2026-06-19T08:00:00Z')); // racha 5 → +1 escudo
    expect(r.currentStreak).toBe(5);
    expect(r.freezeTokens).toBe(1);
  });

  it('los escudos no superan el cap', () => {
    const state: StreakState = { ...base, currentStreak: 9, longestStreak: 9, freezeTokens: FREEZE_CAP, lastStudyDate: D('2026-06-18T00:00:00Z') };
    const r = applyStreakOnActivity(state, D('2026-06-19T08:00:00Z')); // racha 10 → intentaría +1
    expect(r.freezeTokens).toBe(FREEZE_CAP);
  });
});

describe('XP de acción con tope diario', () => {
  it('effectiveXpEarnedToday se resetea si cambió el día', () => {
    expect(effectiveXpEarnedToday(200, D('2026-06-18T00:00:00Z'), D('2026-06-19T10:00:00Z'))).toBe(0);
    expect(effectiveXpEarnedToday(200, D('2026-06-19T00:00:00Z'), D('2026-06-19T10:00:00Z'))).toBe(200);
    expect(effectiveXpEarnedToday(50, null, D('2026-06-19T10:00:00Z'))).toBe(0);
  });

  it('grantActionXp tope al cap diario', () => {
    expect(grantActionXp(0, 10)).toEqual({ granted: 10, xpEarnedToday: 10 });
    const nearCap = DAILY_ACTION_XP_CAP - 5;
    expect(grantActionXp(nearCap, 20)).toEqual({ granted: 5, xpEarnedToday: DAILY_ACTION_XP_CAP });
    expect(grantActionXp(DAILY_ACTION_XP_CAP, 20)).toEqual({ granted: 0, xpEarnedToday: DAILY_ACTION_XP_CAP });
  });
});

describe('advanceQuestProgress', () => {
  it('avanza sin completar', () => {
    expect(advanceQuestProgress(0, 10, QuestStatus.ACTIVE, 3)).toEqual({
      progress: 3,
      status: QuestStatus.ACTIVE,
      justCompleted: false,
    });
  });
  it('completa al alcanzar el target (clampa al target)', () => {
    expect(advanceQuestProgress(8, 10, QuestStatus.ACTIVE, 5)).toEqual({
      progress: 10,
      status: QuestStatus.COMPLETED,
      justCompleted: true,
    });
  });
  it('una misión ya completada no vuelve a completarse', () => {
    expect(advanceQuestProgress(10, 10, QuestStatus.COMPLETED, 5)).toEqual({
      progress: 10,
      status: QuestStatus.COMPLETED,
      justCompleted: false,
    });
  });
});

describe('applyBossDamage', () => {
  it('resta vida sin pasar de 0', () => {
    expect(applyBossDamage(5, 1)).toEqual({ hp: 4, defeated: false });
    expect(applyBossDamage(1, 1)).toEqual({ hp: 0, defeated: true });
    expect(applyBossDamage(0, 3)).toEqual({ hp: 0, defeated: true });
  });
});

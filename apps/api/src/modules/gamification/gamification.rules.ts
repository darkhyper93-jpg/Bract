import {
  DAILY_ACTION_XP_CAP,
  FREEZE_CAP,
  FREEZE_EARN_EVERY,
  QUEST_TARGETS,
  QUEST_XP,
  QuestStatus,
  QuestType,
} from '@bract/shared';

// ============================================================================
// Gamificación (Agente J) — LÓGICA PURA (sin DB/HTTP/reloj propio: el caller pasa `now`). Patrón srs.ts /
// progress.formula.ts → la mecánica del juego es trivialmente testeable. La curva de nivel y las constantes
// de XP viven en @bract/shared (lib/gamification.xp); acá va la lógica de racha/escudos, tope diario,
// avance de misión, daño al jefe y la composición del set de misiones del día. README §3.7.
// ============================================================================

// ---- Fechas: el "día" es UTC (rota a las 00:00 UTC). Limitación conocida v1 (ver §3.7). ----
const MS_PER_DAY = 86_400_000;

export function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Días enteros entre dos fechas (por su parte de día UTC). Negativo si `to` es anterior a `from`.
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcDateOnly(to).getTime() - utcDateOnly(from).getTime()) / MS_PER_DAY);
}

// ---- Misiones del día (3 fijas; la 3ra es vencer al jefe si hay, si no cumplir items del plan) ----
export interface QuestTemplate {
  type: QuestType;
  target: number;
  xpReward: number;
}

export function buildQuestTemplates(hasBoss: boolean): QuestTemplate[] {
  return [
    { type: QuestType.COMPLETE_QUIZ, target: QUEST_TARGETS.COMPLETE_QUIZ, xpReward: QUEST_XP.COMPLETE_QUIZ },
    {
      type: QuestType.REVIEW_DUE_CARDS,
      target: QUEST_TARGETS.REVIEW_DUE_CARDS,
      xpReward: QUEST_XP.REVIEW_DUE_CARDS,
    },
    hasBoss
      ? { type: QuestType.DEFEAT_BOSS, target: QUEST_TARGETS.DEFEAT_BOSS, xpReward: QUEST_XP.DEFEAT_BOSS }
      : {
          type: QuestType.COMPLETE_PLAN_ITEMS,
          target: QUEST_TARGETS.COMPLETE_PLAN_ITEMS,
          xpReward: QUEST_XP.COMPLETE_PLAN_ITEMS,
        },
  ];
}

// ---- Racha PERDONADORA ----
export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
  lastStudyDate: Date | null;
}

export interface StreakResult extends StreakState {
  changed: boolean; // false ⇒ ya contaba hoy (no persistir)
  streakStartedOver: boolean; // true ⇒ se reinició (framing amable, sin penalizar XP/nivel)
}

// Gana un escudo al CRUZAR cada múltiplo de FREEZE_EARN_EVERY (sin columna extra: usa la racha, no un
// contador). Solo cuando la racha aumentó. Cap en FREEZE_CAP.
function withEarnedFreeze(state: StreakState, increased: boolean): number {
  if (increased && state.currentStreak > 0 && state.currentStreak % FREEZE_EARN_EVERY === 0) {
    return Math.min(FREEZE_CAP, state.freezeTokens + 1);
  }
  return state.freezeTokens;
}

function finalize(state: StreakState, startedOver: boolean): StreakResult {
  return {
    currentStreak: state.currentStreak,
    longestStreak: Math.max(state.longestStreak, state.currentStreak),
    freezeTokens: withEarnedFreeze(state, true),
    lastStudyDate: state.lastStudyDate,
    changed: true,
    streakStartedOver: startedOver,
  };
}

// Actualiza la racha ante UNA acción que cuenta. Misma fecha ⇒ sin cambios. Ayer ⇒ +1. Hueco cubierto por
// escudos ⇒ consume escudos y continúa. Hueco sin escudos suficientes ⇒ reinicia a 1 (NUNCA toca XP/nivel).
export function applyStreakOnActivity(state: StreakState, now: Date): StreakResult {
  const today = utcDateOnly(now);

  if (state.lastStudyDate === null) {
    return finalize({ ...state, currentStreak: 1, lastStudyDate: today }, false);
  }

  const diff = daysBetween(state.lastStudyDate, today);
  if (diff <= 0) {
    return { ...state, changed: false, streakStartedOver: false }; // ya contó hoy (o reloj hacia atrás)
  }
  if (diff === 1) {
    return finalize({ ...state, currentStreak: state.currentStreak + 1, lastStudyDate: today }, false);
  }

  // diff >= 2 ⇒ días perdidos.
  const missed = diff - 1;
  if (missed <= state.freezeTokens) {
    return finalize(
      {
        ...state,
        freezeTokens: state.freezeTokens - missed,
        currentStreak: state.currentStreak + 1,
        lastStudyDate: today,
      },
      false,
    );
  }
  return finalize({ ...state, currentStreak: 1, lastStudyDate: today }, true);
}

// ---- XP "por acción" con tope diario (anti-farmeo) ----
// Devuelve el acumulado del día EFECTIVO (0 si el día cambió respecto de `xpTodayDate`).
export function effectiveXpEarnedToday(
  xpEarnedToday: number,
  xpTodayDate: Date | null,
  now: Date,
): number {
  if (xpTodayDate === null) return 0;
  return daysBetween(xpTodayDate, now) === 0 ? xpEarnedToday : 0;
}

// Concede XP de acción topeado por DAILY_ACTION_XP_CAP. `xpEarnedTodayEffective` ya debe venir "roleado".
export function grantActionXp(
  xpEarnedTodayEffective: number,
  amount: number,
): { granted: number; xpEarnedToday: number } {
  const remaining = Math.max(0, DAILY_ACTION_XP_CAP - xpEarnedTodayEffective);
  const granted = Math.max(0, Math.min(amount, remaining));
  return { granted, xpEarnedToday: xpEarnedTodayEffective + granted };
}

// ---- Avance de misión ----
export function advanceQuestProgress(
  progress: number,
  target: number,
  status: QuestStatus,
  amount: number,
): { progress: number; status: QuestStatus; justCompleted: boolean } {
  if (status === QuestStatus.COMPLETED) return { progress, status, justCompleted: false };
  const next = Math.min(target, progress + amount);
  const completed = next >= target;
  return {
    progress: next,
    status: completed ? QuestStatus.COMPLETED : QuestStatus.ACTIVE,
    justCompleted: completed,
  };
}

// ---- Daño al jefe ----
export function applyBossDamage(hp: number, amount: number): { hp: number; defeated: boolean } {
  const next = Math.max(0, hp - amount);
  return { hp: next, defeated: next === 0 };
}

// Gamificación (Agente J) — README §3.7. Lógica PURA compartida API↔web (sin deps de runtime): la curva
// de nivel y las constantes de XP/mecánicas. Front y back derivan el MISMO nivel desde `totalXp` → sin
// drift (el `level` NO se persiste). Tunear el juego = cambiar estas constantes en un solo lugar.
//
// Principio: el XP premia APRENDER (dominio/retención), nunca actividad vacía. No hay XP por abrir la app.

// ---- XP por acción (solo aprendizaje) ----
export const XP = {
  REVIEW_DUE_CARD: 2, // repasar una flashcard VENCIDA (due); las no-due no dan XP (anti-farmeo)
  REVIEW_RECALL_BONUS: 3, // bonus si el recuerdo fue bueno (quality >= 4)
  QUIZ_ANSWER: 2, // responder una pregunta de quiz
  QUIZ_CORRECT_BONUS: 5, // bonus si la MCQ fue correcta
  OPEN_CORRECT: 12, // abierta corregida CORRECT (incluye su "responder")
  OPEN_PARTIAL: 6, // abierta corregida PARTIAL (medio dominio)
  QUIZ_COMPLETED: 15, // completar un intento de quiz (attempt COMPLETED)
  PLAN_ITEM_COMPLETED: 10, // completar un item del plan del día
  TOPIC_COMPLETED: 30, // completar/dominar un tema
  BOSS_DEFEATED: 50, // vencer al jefe del día
} as const;

// Tope diario del XP "por acción" (anti-farmeo). Los premios de misión/jefe son finitos por día (1 set)
// → no cuentan contra este tope. Se enforce con GamificationProfile.xpEarnedToday/xpTodayDate.
export const DAILY_ACTION_XP_CAP = 300;

// ---- Racha PERDONADORA (escudos de gracia) ----
export const FREEZE_EARN_EVERY = 5; // +1 escudo cada N días activos
export const FREEZE_CAP = 2; // máximo de escudos acumulables

// ---- Jefe del día ----
export const BOSS_HP = 5; // "vida": nº de interacciones de dominio sobre el tema-jefe para vencerlo
export const BOSS_XP_REWARD = XP.BOSS_DEFEATED;

// ---- Misiones diarias (targets fijos v1; adaptarlas a metas/horarios = fase posterior) ----
export const QUEST_TARGETS = {
  COMPLETE_QUIZ: 1,
  REVIEW_DUE_CARDS: 10,
  COMPLETE_PLAN_ITEMS: 2,
  DEFEAT_BOSS: 1,
} as const;

export const QUEST_XP = {
  COMPLETE_QUIZ: 20,
  REVIEW_DUE_CARDS: 20,
  COMPLETE_PLAN_ITEMS: 20,
  DEFEAT_BOSS: 25,
} as const;

// ---- Curva de nivel ----
// XP ACUMULADO necesario para ALCANZAR el nivel n (n>=1). Lv.1 = 0 XP. Creciente suave: round(50·n^1.6)
// (Lv.2≈242, Lv.5≈660, Lv.10≈1995). Mantener en sincronía front/back usando SIEMPRE esta función.
const LEVEL_BASE = 50;
const LEVEL_EXP = 1.6;

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(LEVEL_BASE * Math.pow(level, LEVEL_EXP));
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number; // XP acumulado dentro del nivel actual (>= 0)
  xpForNextLevel: number; // tamaño del tramo nivel→siguiente (denominador de la barra de XP)
}

// Deriva nivel + progreso de la barra desde el XP total. Pura y total (clampa XP negativo/decimal).
// La barra de XP del front se llena con xpIntoLevel / xpForNextLevel ∈ [0, 1).
export function levelForXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForNextLevel: next - floor,
  };
}

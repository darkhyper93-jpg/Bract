import { RemediationIntensity } from '@bract/shared';
import type { UserStudyPreferences } from '@bract/shared';
import { DEFAULT_REMEDIATION_INTENSITY, DEFAULT_WEIGHT_QUIZ, DEFAULT_WEIGHT_SRS } from '@bract/shared';

// Fórmula de debilidad por tema (README §3.6). PURA: sin Prisma ni HTTP → testeable en aislamiento y
// reusable por planner (capa 2) y chat (capa 3). El service la alimenta con señales agregadas + prefs.
// weakness es 100% OBJETIVO: SOLO quiz + SRS. La PRIORIDAD (prioritySubjectIds) NO vive acá — es un término
// aparte del planner (ai.service.buildBaselinePlan). El dashboard muestra siempre el weakness real.

export const MIN_ANSWERS = 3; // confianza: por debajo, lowConfidence=true
export const EASE_BASE = 2.5; // ease inicial del SM-2
export const EASE_FLOOR = 1.3; // piso de ease del SM-2
export const SRS_EASE_WEIGHT = 0.6;
export const SRS_OVERDUE_WEIGHT = 0.4;

// Mapa intensidad → α (escala el peso de la debilidad en el plan; ver ai.service.buildBaselinePlan).
export const INTENSITY_ALPHA: Record<RemediationIntensity, number> = {
  [RemediationIntensity.OFF]: 0,
  [RemediationIntensity.LOW]: 0.33,
  [RemediationIntensity.MEDIUM]: 0.66,
  [RemediationIntensity.HIGH]: 1.0,
};

export interface TopicSignals {
  topicId: string;
  subjectId: string;
  answered: number; // ítems de quiz contestados (selectedIndex != null)
  correct: number;
  totalCards: number; // flashcards del tema
  dueCards: number; // flashcards vencidas (dueDate <= now)
  avgEase: number | null; // promedio de ease; null si no hay cartas
}

export interface ResolvedPreferences {
  remediationIntensity: RemediationIntensity;
  weightQuiz: number;
  weightSrs: number;
}
// NOTA: prioritySubjectIds NO está acá a propósito — la prioridad es un término del planner, no de la
// fórmula de debilidad (que es objetiva). El planner lee prioritySubjectIds de preferencesService directo.

export interface WeaknessResult {
  weakness: number;
  accuracy: number | null;
  answered: number;
  lowConfidence: boolean;
  hasData: boolean;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Resuelve prefs (o null) a valores concretos con los defaults del motor.
export function resolvePreferences(prefs: UserStudyPreferences | null): ResolvedPreferences {
  let weightQuiz = prefs?.weightQuiz ?? DEFAULT_WEIGHT_QUIZ;
  let weightSrs = prefs?.weightSrs ?? DEFAULT_WEIGHT_SRS;
  // DECISIÓN: si el usuario pone AMBOS pesos en 0 explícito, un tema con datos daría 0/0. Para no dividir por
  // cero (ni devolver weakness=0 teniendo datos), caemos a los defaults (0.6/0.4). Un solo peso en 0 sí es válido.
  if (weightQuiz === 0 && weightSrs === 0) {
    weightQuiz = DEFAULT_WEIGHT_QUIZ;
    weightSrs = DEFAULT_WEIGHT_SRS;
  }
  return {
    remediationIntensity: prefs?.remediationIntensity ?? DEFAULT_REMEDIATION_INTENSITY,
    weightQuiz,
    weightSrs,
  };
}

// weakness ∈ [0,1] (1 = más débil). Ignora la señal ausente; ambas ausentes ⇒ hasData=false.
export function computeTopicWeakness(s: TopicSignals, prefs: ResolvedPreferences): WeaknessResult {
  const hasQuiz = s.answered > 0;
  const hasSrs = s.totalCards > 0;
  const accuracy = hasQuiz ? s.correct / s.answered : null;

  if (!hasQuiz && !hasSrs) {
    return { weakness: 0, accuracy: null, answered: 0, lowConfidence: false, hasData: false };
  }

  const quizWeak = accuracy === null ? null : 1 - accuracy;

  let srsWeak: number | null = null;
  if (hasSrs) {
    const easeGap = clamp01((EASE_BASE - (s.avgEase ?? EASE_BASE)) / (EASE_BASE - EASE_FLOOR));
    const overdueRatio = s.totalCards > 0 ? s.dueCards / s.totalCards : 0;
    srsWeak = clamp01(SRS_EASE_WEIGHT * easeGap + SRS_OVERDUE_WEIGHT * overdueRatio);
  }

  let num = 0;
  let den = 0;
  if (quizWeak !== null) {
    num += prefs.weightQuiz * quizWeak;
    den += prefs.weightQuiz;
  }
  if (srsWeak !== null) {
    num += prefs.weightSrs * srsWeak;
    den += prefs.weightSrs;
  }
  // weakness OBJETIVO: solo quiz + SRS. La prioridad NO se aplica acá (es un término del planner).
  const weakness = den > 0 ? num / den : 0;

  return {
    weakness,
    accuracy,
    answered: s.answered,
    lowConfidence: hasQuiz && s.answered < MIN_ANSWERS,
    hasData: true,
  };
}

import { TopicDifficulty } from '@bract/shared';
import type { ReviewQuality } from '@bract/shared';

// ============================================================================
// Motor SRS — SM-2 simplificado (PLAN_AGENTES Apéndice B). Función PURA: sin DB,
// sin HTTP, sin reloj propio (recibe `now`). Es la lógica más crítica/testeable.
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3; // piso de SM-2: una carta nunca baja de 1.3

// Ease inicial sesgado por dificultad del tema (§3.3 / Apéndice B): los temas difíciles
// arrancan con ease menor → intervalos más cortos → aparecen más seguido. Confirmado por el usuario.
export const INITIAL_EASE_BY_DIFFICULTY: Record<TopicDifficulty, number> = {
  [TopicDifficulty.EASY]: 2.6,
  [TopicDifficulty.MEDIUM]: 2.5,
  [TopicDifficulty.HARD]: 2.3,
};

export function initialEaseForDifficulty(difficulty: TopicDifficulty): number {
  return INITIAL_EASE_BY_DIFFICULTY[difficulty];
}

// Pausa de rotación SRS (Agente F — efecto de Topic.status). Una carta cuyo tema vuelve a PENDING
// sale del `due` fijando su `dueDate` a un futuro inalcanzable. Se elige año 9999, fuera del
// horizonte de cualquier schedule real de SM-2: alcanzar ese año exigiría ~15 repasos perfectos
// consecutivos (interval compuesto ×ease), imposible en uso humano. NO se tocan `ease`/`intervalDays`/
// `reps` → al reactivar el tema la carta vuelve con su aprendizaje intacto. Ver error.md.
export const SRS_PAUSED_DUE_DATE = new Date('9999-01-01T00:00:00.000Z');
// Umbral de detección: cualquier `dueDate ≥ umbral` se considera pausada. Margen amplio (año 9000)
// respecto a los intervalos reales de SM-2 para distinguir "pausada" de "agendada por un repaso".
export const SRS_PAUSED_THRESHOLD = new Date('9000-01-01T00:00:00.000Z');

// Estado SRS que entra al cálculo (subconjunto del modelo Flashcard).
export interface SrsState {
  ease: number;
  intervalDays: number;
  reps: number;
}

// Resultado del repaso: nuevo estado SRS + cuándo vuelve y cuándo se repasó.
export interface SrsReview {
  ease: number;
  intervalDays: number;
  reps: number;
  dueDate: Date;
  lastReviewedAt: Date;
}

function clampEase(ease: number): number {
  return ease < MIN_EASE ? MIN_EASE : ease;
}

/**
 * Aplica una calificación SM-2 (Apéndice B). `quality` ∈ {0,3,4,5} (Again/Hard/Good/Easy).
 *
 * - q < 3: la carta falla → `reps=0`, `intervalDays=1`, `ease = max(1.3, ease - 0.2)`.
 * - q >= 3: repaso exitoso → `reps+1`; intervalo 1d (1º) · 6d (2º) · `round(intervalDays * ease)`
 *   (siguientes), y luego `ease = max(1.3, ease + (0.1 - (5-q)*(0.08 + (5-q)*0.02)))`.
 *
 * DECISIÓN: en `reps>=3` el intervalo usa el ease PREVIO y el ease se actualiza DESPUÉS — es el
 * orden canónico de SM-2 (SuperMemo) y coincide con el orden del Apéndice B (intervalo, luego ease).
 * Resuelve la única ambigüedad del algoritmo. Ver error.md.
 */
export function reviewSrs(state: SrsState, quality: ReviewQuality, now: Date): SrsReview {
  let ease: number;
  let intervalDays: number;
  let reps: number;

  if (quality < 3) {
    reps = 0;
    intervalDays = 1;
    ease = clampEase(state.ease - 0.2);
  } else {
    reps = state.reps + 1;
    if (reps === 1) {
      intervalDays = 1;
    } else if (reps === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(state.intervalDays * state.ease); // ease PREVIO (canónico)
    }
    ease = clampEase(state.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  }

  const dueDate = new Date(now.getTime() + intervalDays * DAY_MS);
  return { ease, intervalDays, reps, dueDate, lastReviewedAt: now };
}

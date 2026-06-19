import { OpenGrade } from '../types/quiz.types';

// Puntaje del quiz con CRÉDITO PARCIAL (Calidad de aprendizaje). Una abierta PARTIAL vale medio acierto
// (entre acierto y fallo), no un fallo total. Es un puntaje DERIVADO de los grades ya guardados — no se
// persiste ninguna columna nueva. `isCorrect` (booleano) se mantiene intacto para el lock/anti-trampa;
// acá solo se lee el `grade` de 3 estados para sumar el medio punto.

// Cuánto vale una respuesta PARTIAL en el puntaje (entre 0 y 1).
export const PARTIAL_CREDIT = 0.5;

// Puntaje fraccionario del intento: cada acierto vale 1, cada parcial 0.5, el resto 0.
// `correctCount` = ítems con isCorrect (MCQ acertada u OPEN CORRECT); `partialCount` = abiertas PARTIAL.
// Devuelve p. ej. 8.5 sobre N (los valores siempre caen en múltiplos de 0.5 → sin ruido de float).
export function quizScore(correctCount: number, partialCount: number): number {
  return correctCount + PARTIAL_CREDIT * partialCount;
}

// Cuenta correct/partial de una lista de ítems YA corregidos (reveal del runner o item del detalle).
// Una abierta corregida trae su `grade`; MCQ no tiene `grade` (queda undefined → no suma medio punto).
// isCorrect cubre MCQ acertada y OPEN CORRECT; el medio punto se deriva del grade PARTIAL.
export function tallyScore(
  items: ReadonlyArray<{ isCorrect: boolean; grade?: OpenGrade | null }>,
): { correctCount: number; partialCount: number } {
  let correctCount = 0;
  let partialCount = 0;
  for (const it of items) {
    if (it.isCorrect) correctCount += 1;
    else if (it.grade === OpenGrade.PARTIAL) partialCount += 1;
  }
  return { correctCount, partialCount };
}

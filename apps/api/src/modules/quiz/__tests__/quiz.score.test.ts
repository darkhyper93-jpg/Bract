import { describe, expect, it } from 'vitest';
import { OpenGrade, PARTIAL_CREDIT, quizScore, tallyScore } from '@bract/shared';

// Helper puro de puntaje con crédito parcial (Calidad de aprendizaje). Una abierta PARTIAL vale 0.5.
describe('quizScore', () => {
  it('una parcial vale medio punto: 2 correctas + 1 parcial = 2.5', () => {
    expect(quizScore(2, 1)).toBe(2.5);
  });

  it('sin parciales ⇒ puntaje entero = correctas', () => {
    expect(quizScore(7, 0)).toBe(7);
  });

  it('PARTIAL_CREDIT es 0.5', () => {
    expect(PARTIAL_CREDIT).toBe(0.5);
  });
});

describe('tallyScore', () => {
  it('cuenta correctas (MCQ acierto u OPEN CORRECT) y parciales (OPEN PARTIAL); INCORRECT/MCQ fallo no suman', () => {
    const items = [
      { isCorrect: true }, // MCQ acierto (sin grade)
      { isCorrect: true, grade: OpenGrade.CORRECT }, // OPEN correcta
      { isCorrect: false, grade: OpenGrade.PARTIAL }, // OPEN parcial → 0.5
      { isCorrect: false, grade: OpenGrade.INCORRECT }, // OPEN fallo → 0
      { isCorrect: false }, // MCQ fallo → 0
    ];
    const { correctCount, partialCount } = tallyScore(items);
    expect({ correctCount, partialCount }).toEqual({ correctCount: 2, partialCount: 1 });
    // Puntaje fraccionario derivado: 2 + 0.5 = 2.5 sobre 5.
    expect(quizScore(correctCount, partialCount)).toBe(2.5);
  });

  it('lista vacía ⇒ 0/0', () => {
    expect(tallyScore([])).toEqual({ correctCount: 0, partialCount: 0 });
  });
});

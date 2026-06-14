import { describe, expect, it } from 'vitest';
import { RemediationIntensity } from '@bract/shared';
import {
  computeTopicWeakness,
  resolvePreferences,
  INTENSITY_ALPHA,
  MIN_ANSWERS,
  type TopicSignals,
} from '../progress.formula.js';

const base: TopicSignals = {
  topicId: 't1',
  subjectId: 's1',
  answered: 0,
  correct: 0,
  totalCards: 0,
  dueCards: 0,
  avgEase: null,
};

describe('progress.formula — computeTopicWeakness', () => {
  it('sin quiz ni SRS ⇒ hasData=false, weakness=0 (sin datos ≠ débil)', () => {
    const r = computeTopicWeakness(base, resolvePreferences(null));
    expect(r.hasData).toBe(false);
    expect(r.weakness).toBe(0);
    expect(r.accuracy).toBeNull();
  });

  it('solo quiz: 1 de 4 correctas ⇒ weakness=0.75, accuracy=0.25', () => {
    const r = computeTopicWeakness({ ...base, answered: 4, correct: 1 }, resolvePreferences(null));
    expect(r.hasData).toBe(true);
    expect(r.accuracy).toBeCloseTo(0.25, 5);
    expect(r.weakness).toBeCloseTo(0.75, 5);
    expect(r.lowConfidence).toBe(false);
  });

  it('answered < MIN_ANSWERS ⇒ lowConfidence=true', () => {
    const r = computeTopicWeakness({ ...base, answered: MIN_ANSWERS - 1, correct: 0 }, resolvePreferences(null));
    expect(r.lowConfidence).toBe(true);
  });

  it('solo SRS: ease en el piso + todas vencidas ⇒ weakness=1', () => {
    const r = computeTopicWeakness({ ...base, totalCards: 4, dueCards: 4, avgEase: 1.3 }, resolvePreferences(null));
    expect(r.weakness).toBeCloseTo(1, 5);
  });

  it('quiz + SRS combinan con pesos default 0.6/0.4', () => {
    const r = computeTopicWeakness(
      { ...base, answered: 5, correct: 0, totalCards: 2, dueCards: 0, avgEase: 2.5 },
      resolvePreferences(null),
    );
    expect(r.weakness).toBeCloseTo(0.6, 5);
  });

  it('la PRIORIDAD no afecta el weakness (es objetivo): mismas señales ⇒ mismo weakness con cualquier pref', () => {
    const signals = { ...base, answered: 2, correct: 1 };
    const a = computeTopicWeakness(signals, resolvePreferences(null));
    const b = computeTopicWeakness(
      signals,
      resolvePreferences({
        remediationIntensity: RemediationIntensity.HIGH,
        prioritySubjectIds: ['s1'],
        weightQuiz: null,
        weightSrs: null,
        dailyGoalMinutes: null,
      }),
    );
    expect(b.weakness).toBe(a.weakness);
  });

  it('weakness SIEMPRE en [0,1] (señales máximas no se pasan de 1)', () => {
    const r = computeTopicWeakness(
      { ...base, answered: 10, correct: 0, totalCards: 5, dueCards: 5, avgEase: 1.3 },
      resolvePreferences(null),
    );
    expect(r.weakness).toBeGreaterThanOrEqual(0);
    expect(r.weakness).toBeLessThanOrEqual(1);
    expect(r.weakness).toBeCloseTo(1, 5);
  });

  it('AMBOS pesos en 0 explícito ⇒ no divide por cero; cae a defaults (0.6/0.4)', () => {
    const prefs = resolvePreferences({
      remediationIntensity: RemediationIntensity.LOW,
      prioritySubjectIds: [],
      weightQuiz: 0,
      weightSrs: 0,
      dailyGoalMinutes: null,
    });
    const r = computeTopicWeakness(
      { ...base, answered: 4, correct: 0, totalCards: 2, dueCards: 0, avgEase: 2.5 },
      prefs,
    );
    expect(Number.isNaN(r.weakness)).toBe(false);
    expect(r.weakness).toBeCloseTo(0.6, 5);
    expect(r.hasData).toBe(true);
  });

  it('INTENSITY_ALPHA: OFF=0, HIGH=1', () => {
    expect(INTENSITY_ALPHA[RemediationIntensity.OFF]).toBe(0);
    expect(INTENSITY_ALPHA[RemediationIntensity.HIGH]).toBe(1);
  });
});

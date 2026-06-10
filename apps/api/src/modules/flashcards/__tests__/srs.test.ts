import { describe, expect, it } from 'vitest';
import { TopicDifficulty } from '@bract/shared';
import {
  INITIAL_EASE_BY_DIFFICULTY,
  initialEaseForDifficulty,
  reviewSrs,
  type SrsState,
} from '../srs.js';

// Reloj fijo para asertar dueDate de forma determinista.
const NOW = new Date('2026-06-10T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAfter(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

describe('reviewSrs — fallo (quality < 3)', () => {
  it('resetea reps a 0, intervalo a 1 y baja el ease 0.2', () => {
    const state: SrsState = { ease: 2.5, intervalDays: 30, reps: 5 };
    const r = reviewSrs(state, 0, NOW);
    expect(r.reps).toBe(0);
    expect(r.intervalDays).toBe(1);
    expect(r.ease).toBeCloseTo(2.3, 10);
    expect(r.dueDate).toEqual(daysAfter(NOW, 1));
    expect(r.lastReviewedAt).toEqual(NOW);
  });

  it('respeta el piso de ease 1.3', () => {
    const state: SrsState = { ease: 1.4, intervalDays: 10, reps: 3 };
    const r = reviewSrs(state, 0, NOW);
    expect(r.ease).toBe(1.3); // 1.4 - 0.2 = 1.2 → clamp a 1.3
  });
});

describe('reviewSrs — éxito (quality >= 3): progresión de intervalos', () => {
  it('1er repaso exitoso → intervalo 1 día', () => {
    const state: SrsState = { ease: 2.5, intervalDays: 0, reps: 0 };
    const r = reviewSrs(state, 4, NOW);
    expect(r.reps).toBe(1);
    expect(r.intervalDays).toBe(1);
    expect(r.dueDate).toEqual(daysAfter(NOW, 1));
  });

  it('2do repaso exitoso → intervalo 6 días', () => {
    const state: SrsState = { ease: 2.5, intervalDays: 1, reps: 1 };
    const r = reviewSrs(state, 4, NOW);
    expect(r.reps).toBe(2);
    expect(r.intervalDays).toBe(6);
    expect(r.dueDate).toEqual(daysAfter(NOW, 6));
  });

  it('3er+ repaso → round(intervalDays * ease) usando el ease PREVIO', () => {
    const state: SrsState = { ease: 2.5, intervalDays: 6, reps: 2 };
    const r = reviewSrs(state, 4, NOW);
    expect(r.reps).toBe(3);
    expect(r.intervalDays).toBe(15); // round(6 * 2.5) = 15, con ease previo
    expect(r.dueDate).toEqual(daysAfter(NOW, 15));
  });

  it('el intervalo se redondea (round, no floor)', () => {
    const state: SrsState = { ease: 2.3, intervalDays: 15, reps: 3 };
    const r = reviewSrs(state, 4, NOW);
    expect(r.intervalDays).toBe(Math.round(15 * 2.3)); // 34.5 → 35
  });
});

describe('reviewSrs — fórmula de ease (quality >= 3)', () => {
  it('q=5 (Easy) → ease + 0.1', () => {
    const r = reviewSrs({ ease: 2.5, intervalDays: 1, reps: 1 }, 5, NOW);
    expect(r.ease).toBeCloseTo(2.6, 10);
  });

  it('q=4 (Good) → ease sin cambios', () => {
    const r = reviewSrs({ ease: 2.5, intervalDays: 1, reps: 1 }, 4, NOW);
    expect(r.ease).toBeCloseTo(2.5, 10);
  });

  it('q=3 (Hard) → ease - 0.14', () => {
    const r = reviewSrs({ ease: 2.5, intervalDays: 1, reps: 1 }, 3, NOW);
    // 0.1 - (5-3)*(0.08 + (5-3)*0.02) = 0.1 - 2*0.12 = -0.14
    expect(r.ease).toBeCloseTo(2.36, 10);
  });
});

describe('initialEaseForDifficulty — sesgo por dificultad del tema', () => {
  it('temas difíciles arrancan con menor ease que los fáciles', () => {
    const easy = initialEaseForDifficulty(TopicDifficulty.EASY);
    const medium = initialEaseForDifficulty(TopicDifficulty.MEDIUM);
    const hard = initialEaseForDifficulty(TopicDifficulty.HARD);
    expect(easy).toBe(2.6);
    expect(medium).toBe(2.5);
    expect(hard).toBe(2.3);
    expect(hard).toBeLessThan(medium);
    expect(medium).toBeLessThan(easy);
  });

  it('la constante cubre las 3 dificultades', () => {
    expect(Object.keys(INITIAL_EASE_BY_DIFFICULTY)).toHaveLength(3);
  });
});

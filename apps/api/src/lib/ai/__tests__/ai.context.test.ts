import { describe, expect, it } from 'vitest';
import { TopicDifficulty, TopicStatus } from '@bract/shared';
import type { SubjectWithTopics } from '@bract/shared';
import { assembleStudentContext, renderContextForPrompt } from '../ai.context.js';

function subject(over: Partial<SubjectWithTopics> = {}): SubjectWithTopics {
  return {
    id: 's1',
    userId: 'u1',
    name: 'Matemática',
    examDate: null,
    color: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    topics: [],
    ...over,
  };
}

describe('assembleStudentContext', () => {
  it('cuenta pendientes/completados y deriva daysUntilExam + próximo examen', () => {
    const now = new Date('2026-06-09T00:00:00.000Z');
    const subjects: SubjectWithTopics[] = [
      subject({
        id: 's1',
        name: 'Matemática',
        examDate: '2026-06-19T00:00:00.000Z', // 10 días
        topics: [
          {
            id: 't1',
            subjectId: 's1',
            userId: 'u1',
            name: 'Integrales',
            description: null,
            status: TopicStatus.PENDING,
            difficulty: TopicDifficulty.HARD,
            completedAt: null,
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
          {
            id: 't2',
            subjectId: 's1',
            userId: 'u1',
            name: 'Derivadas',
            description: null,
            status: TopicStatus.COMPLETED,
            difficulty: TopicDifficulty.MEDIUM,
            completedAt: '2026-06-05T00:00:00.000Z',
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-05T00:00:00.000Z',
          },
        ],
      }),
      subject({
        id: 's2',
        name: 'Historia',
        examDate: '2026-06-29T00:00:00.000Z', // 20 días
        topics: [],
      }),
    ];

    const ctx = assembleStudentContext(subjects, now);

    expect(ctx.pendingTopicCount).toBe(1);
    expect(ctx.completedTopicCount).toBe(1);
    expect(ctx.subjects[0]?.daysUntilExam).toBe(10);
    expect(ctx.nextExam?.subjectName).toBe('Matemática');
    expect(ctx.nextExam?.daysUntilExam).toBe(10);
  });

  it('maneja materias sin examen (daysUntilExam null, nextExam null)', () => {
    const ctx = assembleStudentContext([subject({ examDate: null })], new Date('2026-06-09T00:00:00.000Z'));
    expect(ctx.subjects[0]?.daysUntilExam).toBeNull();
    expect(ctx.nextExam).toBeNull();
  });
});

describe('renderContextForPrompt', () => {
  it('acota la lista de pendientes a 15 e indica el resto con "(+N más)"', () => {
    const topics = Array.from({ length: 20 }, (_, i) => ({
      id: `t${i}`,
      subjectId: 's1',
      userId: 'u1',
      name: `Tema ${i}`,
      description: null,
      status: TopicStatus.PENDING,
      difficulty: TopicDifficulty.EASY,
      completedAt: null,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    }));
    const ctx = assembleStudentContext([subject({ topics })], new Date('2026-06-09T00:00:00.000Z'));
    const text = renderContextForPrompt(ctx);

    expect(text).toContain('(+5 más)'); // 20 - 15
    expect(text).toContain('Totales: 20 pendientes, 0 completados.');
  });

  it('no rompe sin materias', () => {
    const ctx = assembleStudentContext([], new Date('2026-06-09T00:00:00.000Z'));
    expect(renderContextForPrompt(ctx)).toContain('Todavía no cargó materias');
  });

  it('GOLDEN: sin weakTopics ⇒ el system prompt es idéntico a hoy', () => {
    const now = new Date('2026-06-09T00:00:00.000Z');
    const subjects = [subject({ name: 'Mate' })];
    const withoutArg = renderContextForPrompt(assembleStudentContext(subjects, now));
    const withEmpty = renderContextForPrompt(assembleStudentContext(subjects, now, []));
    expect(withEmpty).toBe(withoutArg); // pasar [] no agrega bloque
    expect(withoutArg).not.toContain('flojos');
  });

  it('con weakTopics ⇒ agrega el bloque de puntos débiles', () => {
    const now = new Date('2026-06-09T00:00:00.000Z');
    const rendered = renderContextForPrompt(
      assembleStudentContext([subject({ name: 'Mate' })], now, [{ name: 'Álgebra', weakness: 0.8 }]),
    );
    expect(rendered).toContain('Álgebra');
    expect(rendered).toContain('flojos');
  });
});

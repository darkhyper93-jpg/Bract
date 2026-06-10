import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { TopicDifficulty, TopicStatus } from '@bract/shared';
import { AppError } from '../../errors.js';

// Mockeamos la capa de cliente para controlar isAIConfigured + el cliente Anthropic,
// sin gastar API ni tocar la red. El resto del service corre real (validación incluida).
vi.mock('../ai.client.js', () => ({
  isAIConfigured: vi.fn(),
  getAIClient: vi.fn(),
  AI_MODELS: { generation: 'claude-haiku-4-5', chat: 'claude-sonnet-4-6' },
  isEffortCapable: (m: string) => m.includes('sonnet-4-6') || m.includes('opus-4'),
}));

import { getAIClient, isAIConfigured } from '../ai.client.js';
import { assembleStudentContext } from '../ai.context.js';
import {
  chatReply,
  generateFlashcards,
  generateStudyPlan,
  streamChatReply,
} from '../ai.service.js';

// DECISIÓN: mock parcial del cliente Anthropic en test → cast a través de unknown
// (solo implementamos los métodos que el service usa).
function asClient(partial: unknown): Anthropic {
  return partial as Anthropic;
}

async function* fakeStream(chunks: string[]): AsyncGenerator<unknown> {
  for (const text of chunks) {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
  }
  yield { type: 'message_stop' };
}

const planInput = {
  now: '2026-06-15',
  horizonDays: 14,
  availability: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, minutes: 60 })),
  subjects: [{ id: 's1', name: 'Mate', examDate: '2026-06-22T00:00:00.000Z' }],
  topics: [
    {
      id: 't1',
      subjectId: 's1',
      name: 'Integrales',
      status: TopicStatus.PENDING,
      difficulty: TopicDifficulty.MEDIUM,
    },
  ],
};

const chatInput = {
  context: assembleStudentContext([], new Date('2026-06-09T00:00:00.000Z')),
  history: [] as { role: 'user' | 'assistant'; content: string }[],
  message: 'Explicame integrales',
};

beforeEach(() => {
  vi.mocked(isAIConfigured).mockReset();
  vi.mocked(getAIClient).mockReset();
});

describe('generateStudyPlan', () => {
  it('sin AI_API_KEY devuelve la distribución base determinista (no rompe)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);

    const plan = await generateStudyPlan(planInput);

    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0]?.date).toBe('2026-06-15');
    expect(plan[0]?.items[0]).toEqual({ topicId: 't1', estimatedMinutes: 45 });
    for (const day of plan) {
      const sum = day.items.reduce((acc, it) => acc + it.estimatedMinutes, 0);
      expect(sum).toBeLessThanOrEqual(60);
    }
    expect(getAIClient).not.toHaveBeenCalled();
  });

  it('valida la salida de la IA: descarta topicId desconocido y clampea minutos/día', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            days: [
              {
                date: '2026-06-16',
                items: [
                  { topicId: 't1', estimatedMinutes: 999 }, // excede los 60 del día
                  { topicId: 'ghost', estimatedMinutes: 30 }, // topicId inexistente
                ],
              },
            ],
          }),
        },
      ],
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ messages: { create } }));

    const plan = await generateStudyPlan(planInput);

    expect(create).toHaveBeenCalledOnce();
    expect(plan).toEqual([{ date: '2026-06-16', items: [{ topicId: 't1', estimatedMinutes: 60 }] }]);
  });

  it('si el proveedor falla, degrada a baseline (nunca lanza)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const create = vi.fn().mockRejectedValue(new Error('boom'));
    vi.mocked(getAIClient).mockReturnValue(asClient({ messages: { create } }));

    const plan = await generateStudyPlan(planInput);

    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0]?.items[0]?.topicId).toBe('t1');
  });
});

describe('generateFlashcards', () => {
  it('sin AI_API_KEY lanza AI_UNAVAILABLE (es inherente a IA)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);
    await expect(
      generateFlashcards({ topic: { id: 't1', name: 'Integrales' }, subjectName: 'Mate' }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      generateFlashcards({ topic: { id: 't1', name: 'Integrales' }, subjectName: 'Mate' }),
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('deduplica contra existentes y entre sí, y capa la cantidad', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            cards: [
              { question: '¿Qué es X?', answer: 'a' }, // dup de existing
              { question: 'Definí Y', answer: 'b' },
              { question: 'Definí Y', answer: 'dup' }, // dup interno
            ],
          }),
        },
      ],
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ messages: { create } }));

    const cards = await generateFlashcards({
      topic: { id: 't1', name: 'Integrales' },
      subjectName: 'Mate',
      existing: [{ question: 'Qué es X?' }],
    });

    expect(cards).toEqual([{ question: 'Definí Y', answer: 'b' }]);
  });
});

describe('chatReply', () => {
  it('sin AI_API_KEY lanza AI_UNAVAILABLE', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);
    await expect(chatReply(chatInput)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('concatena los bloques de texto de la respuesta', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const create = vi.fn().mockResolvedValue({
      content: [
        { type: 'text', text: 'Hola' },
        { type: 'thinking', thinking: 'razonando' },
        { type: 'text', text: ' mundo' },
      ],
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ messages: { create } }));

    await expect(chatReply(chatInput)).resolves.toBe('Hola mundo');
  });
});

describe('streamChatReply', () => {
  it('emite los deltas de texto del stream', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const stream = vi.fn().mockReturnValue(fakeStream(['Hola ', 'mundo']));
    vi.mocked(getAIClient).mockReturnValue(asClient({ messages: { stream } }));

    let out = '';
    for await (const delta of streamChatReply(chatInput)) out += delta;

    expect(out).toBe('Hola mundo');
  });

  it('sin AI_API_KEY lanza AI_UNAVAILABLE al iterar', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);
    await expect(
      (async () => {
        for await (const _ of streamChatReply(chatInput)) void _;
      })(),
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });
});

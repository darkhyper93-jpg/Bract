import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleGenAI } from '@google/genai';
import { TopicDifficulty, TopicStatus } from '@bract/shared';
import { AppError } from '../../errors.js';

// Mockeamos la capa de cliente para controlar isAIConfigured + el cliente Gemini,
// sin gastar API ni tocar la red. El resto del service corre real (validación incluida).
vi.mock('../ai.client.js', () => ({
  isAIConfigured: vi.fn(),
  getAIClient: vi.fn(),
  AI_MODELS: { generation: 'gemini-2.5-flash-lite', chat: 'gemini-2.5-flash' },
}));

import { getAIClient, isAIConfigured } from '../ai.client.js';
import { assembleStudentContext } from '../ai.context.js';
import {
  chatReply,
  extractTopics,
  generateFlashcards,
  generateQuiz,
  generateStudyPlan,
  streamChatReply,
} from '../ai.service.js';

// DECISIÓN: mock parcial del cliente Gemini en test → cast a través de unknown
// (solo implementamos `models.generateContent` / `models.generateContentStream`, lo que usa el service).
function asClient(partial: unknown): GoogleGenAI {
  return partial as GoogleGenAI;
}

// `generateContentStream` del SDK devuelve Promise<AsyncGenerator>; cada chunk expone `.text`.
async function* fakeStream(chunks: string[]): AsyncGenerator<unknown> {
  for (const text of chunks) {
    yield { text };
  }
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
  language: 'es' as const,
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
    const generateContent = vi.fn().mockResolvedValue({
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
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const plan = await generateStudyPlan(planInput);

    expect(generateContent).toHaveBeenCalledOnce();
    expect(plan).toEqual([{ date: '2026-06-16', items: [{ topicId: 't1', estimatedMinutes: 60 }] }]);
  });

  it('si el proveedor falla, degrada a baseline (nunca lanza)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockRejectedValue(new Error('boom'));
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

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
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        cards: [
          { question: '¿Qué es X?', answer: 'a' }, // dup de existing
          { question: 'Definí Y', answer: 'b' },
          { question: 'Definí Y', answer: 'dup' }, // dup interno
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const cards = await generateFlashcards({
      topic: { id: 't1', name: 'Integrales' },
      subjectName: 'Mate',
      existing: [{ question: 'Qué es X?' }],
    });

    expect(cards).toEqual([{ question: 'Definí Y', answer: 'b' }]);
  });
});

describe('extractTopics', () => {
  it('sin AI_API_KEY lanza AI_UNAVAILABLE (es inherente a IA)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);
    await expect(extractTopics({ text: 'apuntes' })).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
  });

  it('normaliza la dificultad laxa, deduplica por nombre y filtra vacíos', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        topics: [
          { name: 'Integrales', difficulty: 'hard' }, // minúsculas → HARD
          { name: 'integrales', difficulty: 'EASY' }, // dup (normalizado) → se omite
          { name: 'Derivadas', difficulty: 'media' }, // desconocida → MEDIUM
          { name: '   ', difficulty: 'EASY' }, // vacío → se omite
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const topics = await extractTopics({ text: 'apuntes', subjectName: 'Mate' });

    expect(topics).toEqual([
      { name: 'Integrales', difficulty: TopicDifficulty.HARD },
      { name: 'Derivadas', difficulty: TopicDifficulty.MEDIUM },
    ]);
  });

  it('capa la cantidad al máximo pedido', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const many = Array.from({ length: 10 }, (_, i) => ({ name: `Tema ${i}`, difficulty: 'MEDIUM' }));
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify({ topics: many }) });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const topics = await extractTopics({ text: 'apuntes', max: 3 });

    expect(topics).toHaveLength(3);
  });
});

describe('generateQuiz', () => {
  const quizInput = {
    scope: 'SUBJECT' as const,
    subjectName: 'Mate',
    topics: [
      { id: 't1', name: 'Integrales' },
      { id: 't2', name: 'Derivadas' },
    ],
  };
  // Genera N opciones válidas (texto + explicación no vacíos).
  const opts = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ text: `o${i}`, explanation: `e${i}` }));

  it('sin AI_API_KEY lanza AI_UNAVAILABLE (es inherente a IA)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);
    await expect(generateQuiz(quizInput)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('valida invariantes: descarta inválidas, mapea topicId desconocido al fallback y deduplica', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        questions: [
          { topicId: 't2', question: 'P1', options: opts(4), correctIndex: 2 }, // válida
          { topicId: 't1', question: 'P2', options: opts(4), correctIndex: 9 }, // correctIndex OOR → drop
          {
            topicId: 't1',
            question: 'P3',
            options: [{ text: 'a', explanation: '  ' }, ...opts(3)],
            correctIndex: 0,
          }, // explicación vacía → drop
          { topicId: 't1', question: 'P4', options: opts(1), correctIndex: 0 }, // pocas opciones → drop
          { topicId: 'ghost', question: 'P5', options: opts(3), correctIndex: 1 }, // topic desconocido → fallback t1
          { topicId: 't2', question: 'p1', options: opts(4), correctIndex: 0 }, // dup de P1 → drop
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const questions = await generateQuiz(quizInput);

    expect(generateContent).toHaveBeenCalledOnce();
    expect(questions).toEqual([
      { topicId: 't2', question: 'P1', options: opts(4), correctIndex: 2 },
      { topicId: 't1', question: 'P5', options: opts(3), correctIndex: 1 }, // 'ghost' → fallback al 1er tema
    ]);
  });

  it('capa la cantidad al máximo pedido', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const many = Array.from({ length: 10 }, (_, i) => ({
      topicId: 't1',
      question: `Pregunta ${i}`,
      options: opts(4),
      correctIndex: 0,
    }));
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify({ questions: many }) });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const questions = await generateQuiz({ ...quizInput, count: 3 });

    expect(questions).toHaveLength(3);
  });

  it('si la IA no devuelve ninguna pregunta válida, lanza AI_UNAVAILABLE', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        questions: [{ topicId: 't1', question: 'X', options: opts(4), correctIndex: 99 }],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    await expect(generateQuiz(quizInput)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });
});

describe('chatReply', () => {
  it('sin AI_API_KEY lanza AI_UNAVAILABLE', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);
    await expect(chatReply(chatInput)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('devuelve el texto de la respuesta del modelo', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({ text: 'Hola mundo' });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    await expect(chatReply(chatInput)).resolves.toBe('Hola mundo');
  });
});

describe('streamChatReply', () => {
  it('emite los deltas de texto del stream', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContentStream = vi.fn().mockResolvedValue(fakeStream(['Hola ', 'mundo']));
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContentStream } }));

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

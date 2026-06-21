import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleGenAI } from '@google/genai';
import { TopicDifficulty, TopicStatus, MAX_TOPIC_SOURCE_TEXT_LENGTH } from '@bract/shared';
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
  gradeOpenAnswer,
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

  it('grounding: arrastra sourceText trimeado y capado; omite el vacío y el ausente', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const longExcerpt = 'x'.repeat(MAX_TOPIC_SOURCE_TEXT_LENGTH + 200);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        topics: [
          { name: 'Integrales', difficulty: 'HARD', sourceText: '  resumen fiel  ' }, // se trimea
          { name: 'Derivadas', difficulty: 'MEDIUM', sourceText: longExcerpt }, // se capa
          { name: 'Límites', difficulty: 'EASY', sourceText: '   ' }, // vacío → se omite
          { name: 'Series', difficulty: 'EASY' }, // sin sourceText → omitido
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const topics = await extractTopics({ text: 'apuntes' });

    expect(topics).toEqual([
      { name: 'Integrales', difficulty: TopicDifficulty.HARD, sourceText: 'resumen fiel' },
      {
        name: 'Derivadas',
        difficulty: TopicDifficulty.MEDIUM,
        sourceText: 'x'.repeat(MAX_TOPIC_SOURCE_TEXT_LENGTH),
      },
      { name: 'Límites', difficulty: TopicDifficulty.EASY }, // sin sourceText
      { name: 'Series', difficulty: TopicDifficulty.EASY },
    ]);
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
      { type: 'MCQ', topicId: 't2', question: 'P1', options: opts(4), correctIndex: 2 },
      { type: 'MCQ', topicId: 't1', question: 'P5', options: opts(3), correctIndex: 1 }, // 'ghost' → fallback al 1er tema
    ]);
  });

  it('MCQ con explicación faltante: conserva la pregunta y la opción con explanation = "" (no descarta)', async () => {
    // FIX bug quiz mixto: antes una sola opción con explicación vacía tiraba la MCQ ENTERA → en modo
    // mixto se caían todas las MCQ y quedaban solo las abiertas. Ahora la opción requiere SOLO el `text`.
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        questions: [
          {
            topicId: 't1',
            question: 'P1',
            options: [{ text: 'a', explanation: '  ' }, ...opts(3)], // 1ª opción sin explicación → se conserva con ''
            correctIndex: 0,
          },
          {
            topicId: 't1',
            question: 'P2',
            options: [{ text: '  ', explanation: 'e' }, ...opts(3)], // opción SIN texto → sigue descartando la pregunta
            correctIndex: 1,
          },
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const questions = await generateQuiz(quizInput);

    expect(questions).toEqual([
      {
        type: 'MCQ',
        topicId: 't1',
        question: 'P1',
        options: [{ text: 'a', explanation: '' }, ...opts(3)],
        correctIndex: 0,
      },
    ]);
  });

  it('quiz MIXTO (MCQ + OPEN): dispara DOS llamadas separadas (una por tipo) y combina MCQ primero, luego OPEN', async () => {
    // FIX bug quiz mixto: gemini-flash-lite devolvía SOLO abiertas al pedir ambos tipos en UNA llamada.
    // Ahora se piden por separado (count=5, openCount=2 → mcqCap=3, openCap=2). Distinguimos las dos
    // llamadas por lo que pide el prompt: la MCQ-only pide "EXACTAMENTE 0" abiertas; la OPEN-only "EXACTAMENTE 2".
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockImplementation((req: { contents: string }) => {
      if (req.contents.includes('EXACTAMENTE 0')) {
        // Llamada MCQ-only (cap=3, openCount=0).
        return Promise.resolve({
          text: JSON.stringify({
            questions: [
              { type: 'MCQ', topicId: 't1', question: 'M1', options: opts(4), correctIndex: 1 }, // ok
              { type: 'MCQ', topicId: 't2', question: 'M2', options: opts(3), correctIndex: 0 }, // ok
              { type: 'OPEN', topicId: 't1', question: 'X', expectedAnswer: 'fuga' }, // OPEN en la MCQ-only → drop (openCap=0)
            ],
          }),
        });
      }
      // Llamada OPEN-only (cap=openCount=2).
      return Promise.resolve({
        text: JSON.stringify({
          questions: [
            { type: 'OPEN', topicId: 't1', question: 'A1', expectedAnswer: 'la integral es el área' }, // ok (1ª)
            { type: 'OPEN', topicId: 't2', question: 'A2', expectedAnswer: '   ' }, // criterio vacío → drop
            { type: 'OPEN', topicId: 't1', question: 'A3', expectedAnswer: 'criterio 3' }, // ok (2ª)
          ],
        }),
      });
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const questions = await generateQuiz({ ...quizInput, count: 5, openCount: 2 });

    expect(generateContent).toHaveBeenCalledTimes(2); // DOS llamadas: una MCQ, una OPEN
    expect(questions).toEqual([
      // MCQ primero (la fuga OPEN de la llamada MCQ quedó descartada por openCap=0)
      { type: 'MCQ', topicId: 't1', question: 'M1', options: opts(4), correctIndex: 1 },
      { type: 'MCQ', topicId: 't2', question: 'M2', options: opts(3), correctIndex: 0 },
      // luego OPEN (A2 con criterio vacío descartada)
      { type: 'OPEN', topicId: 't1', question: 'A1', expectedAnswer: 'la integral es el área' },
      { type: 'OPEN', topicId: 't1', question: 'A3', expectedAnswer: 'criterio 3' },
    ]);
    // Cada llamada pidió SOLO su tipo: 0 abiertas en la MCQ-only, EXACTAMENTE 2 en la OPEN-only.
    const prompts = generateContent.mock.calls.map((c) => c[0].contents as string);
    expect(prompts.some((p) => p.includes('EXACTAMENTE 0'))).toBe(true);
    expect(prompts.some((p) => p.includes('EXACTAMENTE 2'))).toBe(true);
  });

  it('usa un responseSchema específico por tipo: la MCQ-only exige options+correctIndex; la OPEN-only exige expectedAnswer', async () => {
    // FIX raíz del bug mixto: el responseSchema viejo NO ponía correctIndex en `required`, así que el
    // modelo lo omitía y validateAndCapQuiz descartaba TODAS las MCQ. Ahora cada llamada usa un schema
    // por tipo: la MCQ-only fuerza options+correctIndex; la OPEN-only fuerza expectedAnswer.
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockImplementation((req: { contents: string }) => {
      if (req.contents.includes('EXACTAMENTE 0')) {
        return Promise.resolve({
          text: JSON.stringify({
            questions: [{ type: 'MCQ', topicId: 't1', question: 'M1', options: opts(4), correctIndex: 1 }],
          }),
        });
      }
      return Promise.resolve({
        text: JSON.stringify({
          questions: [{ type: 'OPEN', topicId: 't1', question: 'A1', expectedAnswer: 'crit' }],
        }),
      });
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    await generateQuiz({ ...quizInput, count: 5, openCount: 2 });

    // DECISIÓN: assert estructural (no por referencia) sobre el `required` del item de pregunta de cada
    // llamada → testea el CONTRATO con Gemini (qué campos exige), no un objeto importado.
    const configFor = (needle: string) =>
      generateContent.mock.calls.find((c) => (c[0].contents as string).includes(needle))![0].config;
    const mcqRequired = configFor('EXACTAMENTE 0').responseSchema.properties.questions.items.required;
    const openRequired = configFor('EXACTAMENTE 2').responseSchema.properties.questions.items.required;
    expect(mcqRequired).toEqual(expect.arrayContaining(['options', 'correctIndex']));
    expect(mcqRequired).not.toContain('expectedAnswer');
    expect(openRequired).toContain('expectedAnswer');
    expect(openRequired).not.toContain('correctIndex');
  });

  it('una opción MCQ sin "explanation" no rompe el parse: se conserva con explanation ""', async () => {
    // Gate latente: antes quizOptionSchema exigía explanation.min(1) → si la IA omitía la explicación de
    // UNA opción, fallaba el parse del quiz ENTERO (503). Ahora explanation es opcional (default '').
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        questions: [
          {
            type: 'MCQ',
            topicId: 't1',
            question: 'M1',
            options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }], // SIN explanation
            correctIndex: 0,
          },
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const questions = await generateQuiz({ ...quizInput, count: 5 }); // solo MCQ (openCount default 0)

    expect(questions).toEqual([
      {
        type: 'MCQ',
        topicId: 't1',
        question: 'M1',
        options: [
          { text: 'a', explanation: '' },
          { text: 'b', explanation: '' },
          { text: 'c', explanation: '' },
          { text: 'd', explanation: '' },
        ],
        correctIndex: 0,
      },
    ]);
  });

  it('single-type (solo MCQ, openCount 0): dispara UNA sola llamada (sin costo extra)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        questions: [
          { type: 'MCQ', topicId: 't1', question: 'M1', options: opts(3), correctIndex: 0 },
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const questions = await generateQuiz({ ...quizInput, count: 5 }); // openCount default 0

    expect(generateContent).toHaveBeenCalledOnce(); // UNA sola llamada (mcqCap=5, openCap=0)
    expect(questions).toEqual([
      { type: 'MCQ', topicId: 't1', question: 'M1', options: opts(3), correctIndex: 0 },
    ]);
    const prompt = generateContent.mock.calls[0]![0].contents as string;
    expect(prompt).toContain('EXACTAMENTE 0');
  });

  it('single-type (solo OPEN, openCount = count): dispara UNA sola llamada', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        questions: [
          { type: 'OPEN', topicId: 't1', question: 'A1', expectedAnswer: 'criterio 1' },
          { type: 'OPEN', topicId: 't2', question: 'A2', expectedAnswer: 'criterio 2' },
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const questions = await generateQuiz({ ...quizInput, count: 2, openCount: 2 }); // mcqCap=0 → single

    expect(generateContent).toHaveBeenCalledOnce(); // UNA sola llamada (openCap=2, mcqCap=0)
    expect(questions).toEqual([
      { type: 'OPEN', topicId: 't1', question: 'A1', expectedAnswer: 'criterio 1' },
      { type: 'OPEN', topicId: 't2', question: 'A2', expectedAnswer: 'criterio 2' },
    ]);
    const prompt = generateContent.mock.calls[0]![0].contents as string;
    expect(prompt).toContain('EXACTAMENTE 2');
  });

  it('openCount default 0: descarta cualquier abierta que devuelva la IA (queda solo MCQ)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        questions: [
          { type: 'OPEN', topicId: 't1', question: 'A1', expectedAnswer: 'x' }, // sin cupo de abiertas → drop
          { type: 'MCQ', topicId: 't1', question: 'M1', options: opts(2), correctIndex: 0 },
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const questions = await generateQuiz(quizInput); // sin openCount → openCap 0

    expect(questions).toEqual([
      { type: 'MCQ', topicId: 't1', question: 'M1', options: opts(2), correctIndex: 0 },
    ]);
    const prompt = generateContent.mock.calls[0]![0].contents as string;
    expect(prompt).toContain('EXACTAMENTE 0');
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

  it('FIX prompt acotado: en materia entera capa los temas enviados a la IA a una muestra (no manda los 100)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        questions: [{ topicId: 't0', question: 'P', options: opts(2), correctIndex: 0 }],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    // 100 temas (materia entera). El prompt debe llevar solo la muestra (QUIZ_PROMPT_MAX_TOPICS = 20).
    const topics = Array.from({ length: 100 }, (_, i) => ({ id: `t${i}`, name: `Tema ${i}` }));
    await generateQuiz({ scope: 'SUBJECT', subjectName: 'Mate', topics });

    const prompt = generateContent.mock.calls[0]![0].contents as string;
    expect(prompt).toContain('"t0"'); // primeros 20 ids presentes
    expect(prompt).toContain('"t19"');
    expect(prompt).not.toContain('"t20"'); // el resto NO se envía (prompt acotado)
    expect(prompt).not.toContain('"t99"');
  });
});

describe('gradeOpenAnswer — corrección de una respuesta abierta', () => {
  const gradeInput = {
    question: '¿Qué es una integral?',
    expectedAnswer: 'El área bajo la curva',
    sourceText: 'La integral es el área bajo la curva de una función.',
    studentAnswer: 'Es el área debajo de la curva',
  };

  it('sin AI_API_KEY lanza AI_UNAVAILABLE (es inherente a IA)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);
    await expect(gradeOpenAnswer(gradeInput)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('normaliza la nota laxa, trimea el feedback y ancla el prompt al material + expectedAnswer', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({ grade: 'correcta', feedback: '  ¡Bien! Captaste la idea.  ' }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    const res = await gradeOpenAnswer(gradeInput);

    expect(res).toEqual({ grade: 'CORRECT', feedback: '¡Bien! Captaste la idea.' });
    const prompt = generateContent.mock.calls[0]![0].contents as string;
    expect(prompt).toContain('Respuesta esperada');
    expect(prompt).toContain('El área bajo la curva');
    expect(prompt).toContain('Material del tema'); // material re-inyectado para anclar la corrección
    expect(prompt).toContain('área bajo la curva de una función');
  });

  it('normaliza los 3 estados (incl. español y valor desconocido → PARTIAL)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const cases: [string, string][] = [
      ['CORRECT', 'CORRECT'],
      ['PARTIAL', 'PARTIAL'],
      ['incorrecto', 'INCORRECT'],
      ['¯\\_(ツ)_/¯', 'PARTIAL'], // desconocido → PARTIAL (no premia ni castiga al máximo)
    ];
    for (const [raw, expected] of cases) {
      const generateContent = vi
        .fn()
        .mockResolvedValue({ text: JSON.stringify({ grade: raw, feedback: 'fb' }) });
      vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));
      const res = await gradeOpenAnswer(gradeInput);
      expect(res.grade).toBe(expected);
    }
  });

  it('sin sourceText: corrige SOLO contra expectedAnswer (no inyecta material)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi
      .fn()
      .mockResolvedValue({ text: JSON.stringify({ grade: 'CORRECT', feedback: 'ok' }) });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    await gradeOpenAnswer({ ...gradeInput, sourceText: null });

    const prompt = generateContent.mock.calls[0]![0].contents as string;
    expect(prompt).not.toContain('Material del tema');
    expect(prompt).toContain('Respuesta esperada');
  });

  it('si la IA no devuelve una corrección válida (JSON inválido), lanza AI_UNAVAILABLE', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({ text: 'no es json' });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    await expect(gradeOpenAnswer(gradeInput)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });
});

describe('FIX fiabilidad: reintento ante errores transitorios del proveedor', () => {
  const quizInput = {
    scope: 'TOPIC' as const,
    subjectName: 'Mate',
    topics: [{ id: 't1', name: 'Integrales' }],
  };
  const okQuiz = {
    text: JSON.stringify({
      questions: [
        {
          topicId: 't1',
          question: 'P',
          options: [
            { text: 'a', explanation: 'x' },
            { text: 'b', explanation: 'y' },
          ],
          correctIndex: 0,
        },
      ],
    }),
  };
  // Error con status HTTP — ApiError del SDK expone `.status`.
  const httpError = (status: number) => Object.assign(new Error(`provider ${status}`), { status });

  it('generateQuiz: reintenta un 503 (overload) y luego tiene éxito', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(isAIConfigured).mockReturnValue(true);
      const generateContent = vi
        .fn()
        .mockRejectedValueOnce(httpError(503))
        .mockResolvedValueOnce(okQuiz);
      vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

      const promise = generateQuiz(quizInput);
      await vi.runAllTimersAsync(); // dispara el backoff del reintento
      const questions = await promise;

      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(questions).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('generateQuiz: un rate limit (429) persistente agota los reintentos y degrada a AI_UNAVAILABLE', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(isAIConfigured).mockReturnValue(true);
      const generateContent = vi.fn().mockRejectedValue(httpError(429));
      vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

      const promise = generateQuiz(quizInput);
      const assertion = expect(promise).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
      await vi.runAllTimersAsync();
      await assertion;

      expect(generateContent).toHaveBeenCalledTimes(4); // 1 intento + 3 reintentos
    } finally {
      vi.useRealTimers();
    }
  });

  it('generateQuiz: un error DETERMINISTA (400) NO se reintenta', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockRejectedValue(httpError(400));
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    await expect(generateQuiz(quizInput)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(generateContent).toHaveBeenCalledOnce(); // sin reintentos
  });

  it('generateQuiz: salida inválida NO se reintenta (se valida después del reintento)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({ text: 'no es json' });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    await expect(generateQuiz(quizInput)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(generateContent).toHaveBeenCalledOnce();
  });

  it('gradeOpenAnswer: reintenta un error de red transitorio y luego tiene éxito', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(isAIConfigured).mockReturnValue(true);
      const netError = Object.assign(new Error('fetch failed'), {
        cause: { code: 'ECONNRESET' },
      });
      const generateContent = vi
        .fn()
        .mockRejectedValueOnce(netError)
        .mockResolvedValueOnce({ text: JSON.stringify({ grade: 'CORRECT', feedback: 'ok' }) });
      vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

      const promise = gradeOpenAnswer({
        question: 'Q',
        expectedAnswer: 'A',
        sourceText: null,
        studentAnswer: 'a',
      });
      await vi.runAllTimersAsync();
      const res = await promise;

      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(res.grade).toBe('CORRECT');
    } finally {
      vi.useRealTimers();
    }
  });

  it('generateFlashcards: reintenta un 503 y luego tiene éxito', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(isAIConfigured).mockReturnValue(true);
      const generateContent = vi
        .fn()
        .mockRejectedValueOnce(httpError(503))
        .mockResolvedValueOnce({
          text: JSON.stringify({ cards: [{ question: 'Q', answer: 'A' }] }),
        });
      vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

      const promise = generateFlashcards({
        topic: { id: 't1', name: 'Integrales' },
        subjectName: 'Mate',
      });
      await vi.runAllTimersAsync();
      const cards = await promise;

      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(cards).toEqual([{ question: 'Q', answer: 'A' }]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('grounding inyectado en el prompt de generación', () => {
  it('flashcards: inyecta "Material del tema" si hay sourceText; lo omite si es null', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({ cards: [{ question: 'Q', answer: 'A' }] }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    await generateFlashcards({
      topic: { id: 't1', name: 'Integrales', sourceText: 'La integral es el área bajo la curva.' },
      subjectName: 'Mate',
    });
    const withMaterial = generateContent.mock.calls[0]![0].contents as string;
    expect(withMaterial).toContain('Material del tema');
    expect(withMaterial).toContain('área bajo la curva');

    generateContent.mockClear();
    await generateFlashcards({
      topic: { id: 't1', name: 'Integrales', sourceText: null }, // sin material → como hoy
      subjectName: 'Mate',
    });
    const noMaterial = generateContent.mock.calls[0]![0].contents as string;
    expect(noMaterial).not.toContain('Material del tema');
  });

  it('quiz multi-tema: el total de grounding inyectado respeta el tope (no manda N×1500)', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        questions: [
          {
            topicId: 'm0',
            question: 'P',
            options: [
              { text: 'a', explanation: 'x' },
              { text: 'b', explanation: 'y' },
            ],
            correctIndex: 0,
          },
        ],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue(asClient({ models: { generateContent } }));

    // 20 temas, cada uno con un excerpt de 1500 'Ω' → SIN tope total serían 20×1500 = 30.000 chars.
    // Usamos 'Ω' (ausente del texto fijo del prompt) para contar SOLO los chars de grounding.
    const topics = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      name: `Tema ${i}`,
      sourceText: 'Ω'.repeat(1500),
    }));
    await generateQuiz({ scope: 'SUBJECT', subjectName: 'Mate', topics });

    const prompt = generateContent.mock.calls[0]![0].contents as string;
    const groundingChars = (prompt.match(/Ω/g) ?? []).length;
    expect(groundingChars).toBeGreaterThan(0); // sí ancla en el material
    expect(groundingChars).toBeLessThanOrEqual(8000); // pero topeado al total (GROUNDING_CHARS_TOTAL)
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

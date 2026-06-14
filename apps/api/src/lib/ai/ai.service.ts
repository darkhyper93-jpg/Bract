import type { Content, GenerateContentParameters } from '@google/genai';
import { TopicDifficulty } from '@bract/shared';
import type { TopicStatus } from '@bract/shared';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { AI_MODELS, getAIClient, isAIConfigured } from './ai.client.js';
import { renderContextForPrompt } from './ai.context.js';
import type { StudentContext } from './ai.context.js';
import {
  flashcardsOutputSchema,
  flashcardsResponseSchema,
  planOutputSchema,
  planResponseSchema,
  quizOutputSchema,
  quizResponseSchema,
  topicsOutputSchema,
  topicsResponseSchema,
} from './ai.schemas.js';
import {
  EXTRACT_TOPICS_SYSTEM,
  FLASHCARDS_SYSTEM,
  PLAN_SYSTEM,
  QUIZ_SYSTEM,
  buildChatSystemPrompt,
  buildExtractTopicsUserPrompt,
  buildFlashcardsUserPrompt,
  buildPlanUserPrompt,
  buildQuizUserPrompt,
} from './ai.prompts.js';

// ============================================================================
// Núcleo de IA (Agente B) — funciones tipadas que consumen C (planner), D
// (flashcards) y E (chat). B NO toca Prisma ni HTTP: recibe DTOs, devuelve datos
// tipados. La salida de la IA se valida SIEMPRE con Zod + invariantes en código.
// ============================================================================

// ---- Tipos de I/O (los contratos que ven C/D/E) ---------------------------

export interface GeneratePlanInput {
  subjects: { id: string; name: string; examDate: string | null }[];
  topics: {
    id: string;
    subjectId: string;
    name: string;
    status: TopicStatus;
    difficulty: TopicDifficulty;
  }[];
  availability: { weekday: number; minutes: number }[]; // minutos/día (§3.4)
  horizonDays?: number; // default 14
  now?: string; // ISO; default hoy
}

export interface PlanItem {
  topicId: string;
  estimatedMinutes: number;
}

export interface PlanDay {
  date: string; // ISO yyyy-mm-dd
  items: PlanItem[];
}

export interface GenerateFlashcardsInput {
  topic: { id: string; name: string; description?: string | null };
  subjectName: string;
  count?: number; // default 10, tope duro 10
  existing?: { question: string }[]; // para deduplicar
}

export interface GeneratedFlashcard {
  question: string;
  answer: string;
}

export interface ChatTurnInput {
  context: StudentContext;
  history: { role: 'user' | 'assistant'; content: string }[];
  message: string;
}

export interface ExtractTopicsInput {
  text: string;
  subjectName?: string;
  max?: number; // default/tope duro MAX_EXTRACT_TOPICS
}

export interface ExtractedTopicAI {
  name: string;
  difficulty: TopicDifficulty;
}

export interface GenerateQuizInput {
  scope: 'TOPIC' | 'SUBJECT';
  subjectName: string;
  topics: { id: string; name: string; description?: string | null }[]; // 1 (TOPIC) o N (SUBJECT)
  count?: number; // default DEFAULT_QUIZ_COUNT, tope duro MAX_QUIZ_COUNT
}

export interface GeneratedQuizOption {
  text: string;
  explanation: string;
}

export interface GeneratedQuizQuestion {
  topicId: string;
  question: string;
  options: GeneratedQuizOption[];
  correctIndex: number;
}

// ---- Constantes -----------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HORIZON_DAYS = 14;
const DEFAULT_FLASHCARD_COUNT = 10;
const MAX_FLASHCARD_COUNT = 10;
const MAX_EXTRACT_TOPICS = 50; // tope duro de temas por importación (Agente K)
const DEFAULT_QUIZ_COUNT = 5;
const MAX_QUIZ_COUNT = 10; // tope duro de preguntas por quiz (Agente I)
const MIN_QUIZ_OPTIONS = 2;
const MAX_QUIZ_OPTIONS = 6;
const PLAN_MAX_TOKENS = 8192;
const FLASHCARDS_MAX_TOKENS = 2048;
const CHAT_MAX_TOKENS = 4096;
const EXTRACT_TOPICS_MAX_TOKENS = 4096;
const QUIZ_MAX_TOKENS = 8192;

// Minutos base por dificultad (sesga la duración del bloque y el orden).
const DIFFICULTY_MINUTES: Record<TopicDifficulty, number> = {
  [TopicDifficulty.EASY]: 30,
  [TopicDifficulty.MEDIUM]: 45,
  [TopicDifficulty.HARD]: 60,
};
const DIFFICULTY_RANK: Record<TopicDifficulty, number> = {
  [TopicDifficulty.EASY]: 0,
  [TopicDifficulty.MEDIUM]: 1,
  [TopicDifficulty.HARD]: 2,
};

// ---- Helpers de fecha (UTC, date-only) ------------------------------------

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseNow(now?: string): Date {
  const d = now ? new Date(now) : new Date();
  return startOfUTCDay(Number.isNaN(d.getTime()) ? new Date() : d);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseISODate(s: string): Date | null {
  const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s);
  return Number.isNaN(d.getTime()) ? null : startOfUTCDay(d);
}

function availabilityByWeekday(avail: { weekday: number; minutes: number }[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const a of avail) {
    if (a.weekday >= 0 && a.weekday <= 6 && a.minutes > 0) {
      m.set(a.weekday, Math.floor(a.minutes));
    }
  }
  return m;
}

function examDaysFor(examDate: string | null, now: Date): number {
  if (!examDate) return Number.MAX_SAFE_INTEGER;
  const d = parseISODate(examDate);
  if (!d) return Number.MAX_SAFE_INTEGER;
  const diff = Math.round((d.getTime() - now.getTime()) / DAY_MS);
  return diff < 0 ? 0 : diff;
}

// ---- Distribución base determinista (sirve de hint a la IA y de fallback) --

function buildBaselinePlan(input: GeneratePlanInput): PlanDay[] {
  const now = parseNow(input.now);
  const horizonDays = input.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const avail = availabilityByWeekday(input.availability);
  const examBySubject = new Map(input.subjects.map((s) => [s.id, s.examDate] as const));

  const pending = input.topics.filter((t) => t.status !== 'COMPLETED');
  if (pending.length === 0) return [];

  // urgencia: examen más cercano primero; dificultad desc como desempate.
  const ordered = [...pending].sort((a, b) => {
    const da = examDaysFor(examBySubject.get(a.subjectId) ?? null, now);
    const db = examDaysFor(examBySubject.get(b.subjectId) ?? null, now);
    if (da !== db) return da - db;
    return DIFFICULTY_RANK[b.difficulty] - DIFFICULTY_RANK[a.difficulty];
  });

  const slots: { date: string; remaining: number; items: PlanItem[] }[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(now.getTime() + i * DAY_MS);
    const cap = avail.get(d.getUTCDay()) ?? 0;
    if (cap > 0) slots.push({ date: toISODate(d), remaining: cap, items: [] });
  }
  if (slots.length === 0) return [];

  let cursor = 0;
  for (const t of ordered) {
    const want = DIFFICULTY_MINUTES[t.difficulty];
    let placed = false;
    for (let k = 0; k < slots.length; k++) {
      const idx = (cursor + k) % slots.length;
      const slot = slots[idx];
      if (slot === undefined) continue;
      if (slot.remaining >= Math.min(want, 15)) {
        const minutes = Math.min(want, slot.remaining);
        slot.items.push({ topicId: t.id, estimatedMinutes: minutes });
        slot.remaining -= minutes;
        cursor = idx;
        placed = true;
        break;
      }
    }
    if (!placed) break; // no queda lugar en el horizonte
  }

  return slots.filter((s) => s.items.length > 0).map((s) => ({ date: s.date, items: s.items }));
}

// ---- Validación de la salida de la IA (invariantes de negocio) ------------

function validateAndClampPlan(days: PlanDay[], input: GeneratePlanInput): PlanDay[] {
  const now = parseNow(input.now);
  const horizonDays = input.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const horizonEnd = new Date(now.getTime() + horizonDays * DAY_MS);
  const avail = availabilityByWeekday(input.availability);
  const validTopicIds = new Set(input.topics.map((t) => t.id));

  const out: PlanDay[] = [];
  const seenDates = new Set<string>();

  for (const day of days) {
    const date = parseISODate(day.date);
    if (!date) continue;
    if (date.getTime() < now.getTime() || date.getTime() >= horizonEnd.getTime()) continue;

    const iso = toISODate(date);
    if (seenDates.has(iso)) continue;

    const cap = avail.get(date.getUTCDay()) ?? 0;
    if (cap <= 0) continue;

    let used = 0;
    const items: PlanItem[] = [];
    for (const it of day.items) {
      if (!validTopicIds.has(it.topicId)) continue; // descartar topicId desconocido
      const minutes = Math.floor(it.estimatedMinutes);
      if (minutes <= 0) continue;
      const remaining = cap - used;
      if (remaining <= 0) break; // no exceder los minutos del día
      const clamped = Math.min(minutes, remaining);
      items.push({ topicId: it.topicId, estimatedMinutes: clamped });
      used += clamped;
    }

    if (items.length > 0) {
      seenDates.add(iso);
      out.push({ date: iso, items });
    }
  }

  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s¿¡"'.,;:!?]+|[\s¿¡"'.,;:!?]+$/g, '')
    .trim();
}

function dedupeAndCap(
  cards: { question: string; answer: string }[],
  existing: { question: string }[],
  cap: number,
): GeneratedFlashcard[] {
  const seen = new Set(existing.map((e) => normalizeQuestion(e.question)));
  const out: GeneratedFlashcard[] = [];
  for (const c of cards) {
    const question = c.question.trim();
    const answer = c.answer.trim();
    if (question.length === 0 || answer.length === 0) continue;
    const key = normalizeQuestion(question);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({ question, answer });
    if (out.length >= cap) break;
  }
  return out;
}

// Normaliza la dificultad cruda de la IA a un TopicDifficulty (laxo: "medium"/"media"/minúsculas →
// MEDIUM; cualquier cosa desconocida cae a MEDIUM). Nunca falla el parse por esto.
function normalizeDifficulty(raw: string): TopicDifficulty {
  const v = raw.trim().toUpperCase();
  if (v === TopicDifficulty.EASY) return TopicDifficulty.EASY;
  if (v === TopicDifficulty.HARD) return TopicDifficulty.HARD;
  return TopicDifficulty.MEDIUM;
}

function dedupeAndCapTopics(
  topics: { name: string; difficulty: string }[],
  cap: number,
): ExtractedTopicAI[] {
  const seen = new Set<string>();
  const out: ExtractedTopicAI[] = [];
  for (const t of topics) {
    const name = t.name.trim();
    if (name.length === 0) continue;
    const key = normalizeQuestion(name);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, difficulty: normalizeDifficulty(t.difficulty) });
    if (out.length >= cap) break;
  }
  return out;
}

// Valida la salida cruda del quiz (la IA puede devolver basura) e impone los invariantes de negocio:
// - cada opción con texto y explicación no vacíos; nº de opciones en [MIN, MAX];
// - correctIndex entero dentro del rango de opciones;
// - topicId ∈ temas de entrada (si no, cae al tema único/primero — siempre hay ≥1);
// - dedup de preguntas por texto normalizado; cap a `cap`.
// Descarta la pregunta entera si no cumple (nunca recorta opciones, que correría el correctIndex).
function validateAndCapQuiz(
  questions: { topicId: string; question: string; options: { text: string; explanation: string }[]; correctIndex: number }[],
  input: GenerateQuizInput,
  cap: number,
): GeneratedQuizQuestion[] {
  const validTopicIds = new Set(input.topics.map((t) => t.id));
  const fallbackTopicId = input.topics[0]?.id;
  if (fallbackTopicId === undefined) return []; // sin temas no hay quiz posible

  const seen = new Set<string>();
  const out: GeneratedQuizQuestion[] = [];

  for (const q of questions) {
    const question = q.question.trim();
    if (question.length === 0) continue;

    const options: GeneratedQuizOption[] = [];
    let optionsOk = true;
    for (const o of q.options) {
      const text = o.text.trim();
      const explanation = o.explanation.trim();
      if (text.length === 0 || explanation.length === 0) {
        optionsOk = false;
        break;
      }
      options.push({ text, explanation });
    }
    if (!optionsOk) continue;
    if (options.length < MIN_QUIZ_OPTIONS || options.length > MAX_QUIZ_OPTIONS) continue;

    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= options.length) {
      continue;
    }

    const key = normalizeQuestion(question);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);

    const topicId = validTopicIds.has(q.topicId) ? q.topicId : fallbackTopicId;
    out.push({ topicId, question, options, correctIndex: q.correctIndex });
    if (out.length >= cap) break;
  }

  return out;
}

// ---- Manejo de errores / degradación --------------------------------------

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Mapea cualquier fallo del proveedor a un error manejado (503), preservando AppError. */
function mapAIError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  logger.error('ai.provider_error', { error: errorMessage(err) });
  return new AppError('AI_UNAVAILABLE', 'El proveedor de IA no está disponible en este momento');
}

/** JSON.parse defensivo + validación Zod del structured output (nunca confiamos a ciegas). */
function parseStructured<T>(text: string, schema: z.ZodType<T>): T | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const result = schema.safeParse(json);
  return result.success ? result.data : null;
}

// ---- Funciones públicas ----------------------------------------------------

/**
 * Distribución base 100% determinista (urgencia por examen + pendientes + minutos/día),
 * SIN llamar a la IA. La usa el Agente C para el **recálculo incremental** (completar/saltar):
 * adapta el plan al instante, sin costo de tokens ni reshuffle caótico. La IA queda reservada
 * para la generación explícita (`generateStudyPlan`). Reusa el mismo algoritmo (fuente única).
 * Coordinación C↔B — ver error.md.
 */
export function generateStudyPlanBaseline(input: GeneratePlanInput): PlanDay[] {
  return buildBaselinePlan(input);
}

/**
 * Genera el cronograma. Degradación útil: sin `AI_API_KEY` (o si la IA falla)
 * devuelve la distribución base determinista — el planner básico sigue andando.
 */
export async function generateStudyPlan(input: GeneratePlanInput): Promise<PlanDay[]> {
  const baseline = buildBaselinePlan(input);
  if (!isAIConfigured() || baseline.length === 0) return baseline;

  try {
    const client = getAIClient();
    const res = await client.models.generateContent({
      model: AI_MODELS.generation,
      contents: buildPlanUserPrompt(input, baseline),
      config: {
        systemInstruction: PLAN_SYSTEM,
        maxOutputTokens: PLAN_MAX_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: planResponseSchema,
      },
    });
    const parsed = parseStructured(res.text ?? '', planOutputSchema);
    if (!parsed) return baseline;
    const refined = validateAndClampPlan(parsed.days, input);
    return refined.length > 0 ? refined : baseline;
  } catch (err) {
    logger.error('ai.generateStudyPlan falló; usando baseline', { error: errorMessage(err) });
    return baseline;
  }
}

/** Genera flashcards de un tema. Lanza `AI_UNAVAILABLE` si no hay IA (es inherente a IA). */
export async function generateFlashcards(
  input: GenerateFlashcardsInput,
): Promise<GeneratedFlashcard[]> {
  if (!isAIConfigured()) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  const cap = Math.min(input.count ?? DEFAULT_FLASHCARD_COUNT, MAX_FLASHCARD_COUNT);
  try {
    const client = getAIClient();
    const res = await client.models.generateContent({
      model: AI_MODELS.generation,
      contents: buildFlashcardsUserPrompt(input, cap),
      config: {
        systemInstruction: FLASHCARDS_SYSTEM,
        maxOutputTokens: FLASHCARDS_MAX_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: flashcardsResponseSchema,
      },
    });
    const parsed = parseStructured(res.text ?? '', flashcardsOutputSchema);
    if (!parsed) {
      throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió flashcards válidas');
    }
    return dedupeAndCap(parsed.cards, input.existing ?? [], cap);
  } catch (err) {
    throw mapAIError(err);
  }
}

/**
 * Extrae temas estructurados (+ dificultad) desde texto pegado (Agente K). Inherente a IA: lanza
 * `AI_UNAVAILABLE` si falta la key. La salida se valida con Zod, se normaliza la dificultad, se
 * deduplica y se capa a `MAX_EXTRACT_TOPICS`. NO escribe en DB ni interpreta intención de borrado.
 */
export async function extractTopics(input: ExtractTopicsInput): Promise<ExtractedTopicAI[]> {
  if (!isAIConfigured()) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  const cap = Math.min(input.max ?? MAX_EXTRACT_TOPICS, MAX_EXTRACT_TOPICS);
  try {
    const client = getAIClient();
    const res = await client.models.generateContent({
      model: AI_MODELS.generation,
      contents: buildExtractTopicsUserPrompt(input, cap),
      config: {
        systemInstruction: EXTRACT_TOPICS_SYSTEM,
        maxOutputTokens: EXTRACT_TOPICS_MAX_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: topicsResponseSchema,
      },
    });
    const parsed = parseStructured(res.text ?? '', topicsOutputSchema);
    if (!parsed) {
      throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió temas válidos');
    }
    return dedupeAndCapTopics(parsed.topics, cap);
  } catch (err) {
    throw mapAIError(err);
  }
}

/**
 * Genera un quiz de opción múltiple para un tema o materia (Agente I). Cada pregunta trae su
 * respuesta correcta y la explicación POR OPCIÓN en la MISMA llamada → la corrección es local
 * (comparar) y la explicación ya está lista, sin 2da llamada a la IA. Inherente a IA: lanza
 * `AI_UNAVAILABLE` (503) sin la key. La salida se valida con Zod + invariantes (correctIndex en
 * rango, topicId ∈ entrada, dedup, cap). NO escribe en DB (la persistencia del intento es del Agente I).
 */
export async function generateQuiz(input: GenerateQuizInput): Promise<GeneratedQuizQuestion[]> {
  if (!isAIConfigured()) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  if (input.topics.length === 0) {
    throw new AppError('AI_UNAVAILABLE', 'No hay temas para generar el quiz');
  }
  const cap = Math.min(input.count ?? DEFAULT_QUIZ_COUNT, MAX_QUIZ_COUNT);
  try {
    const client = getAIClient();
    const res = await client.models.generateContent({
      model: AI_MODELS.generation,
      contents: buildQuizUserPrompt(input, cap),
      config: {
        systemInstruction: QUIZ_SYSTEM,
        maxOutputTokens: QUIZ_MAX_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: quizResponseSchema,
      },
    });
    const parsed = parseStructured(res.text ?? '', quizOutputSchema);
    if (!parsed) {
      throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió un quiz válido');
    }
    const questions = validateAndCapQuiz(parsed.questions, input, cap);
    if (questions.length === 0) {
      throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió preguntas válidas');
    }
    return questions;
  } catch (err) {
    throw mapAIError(err);
  }
}

function buildChatRequest(input: ChatTurnInput): GenerateContentParameters {
  // Historial → `contents` de Gemini: el rol 'assistant' de Anthropic mapea a 'model'.
  const contents: Content[] = [
    ...input.history.map(
      (m): Content => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }),
    ),
    { role: 'user', parts: [{ text: input.message }] },
  ];
  return {
    model: AI_MODELS.chat,
    contents,
    config: {
      systemInstruction: buildChatSystemPrompt(renderContextForPrompt(input.context)),
      maxOutputTokens: CHAT_MAX_TOKENS,
    },
  };
}

/**
 * Responde el chat en streaming (deltas de texto). E lo pipea a SSE — la respuesta
 * streameada es la excepción documentada al envelope JSON. Lanza `AI_UNAVAILABLE` sin IA.
 *
 * `signal` (opcional, aditivo — coordinación E↔B): se pasa al SDK como `abortSignal` para cortar
 * el stream del proveedor de inmediato cuando el cliente se desconecta (E lo ata a `res.on('close')`).
 * Nota: en Gemini `abortSignal` es client-only — corta el fetch/iteración local al instante (lo que
 * necesita el controller para dejar de emitir), aunque no cancele el cómputo ya iniciado en el server.
 */
export async function* streamChatReply(
  input: ChatTurnInput,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  if (!isAIConfigured()) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  const client = getAIClient();
  try {
    const req = buildChatRequest(input);
    const stream = await client.models.generateContentStream(
      signal ? { ...req, config: { ...req.config, abortSignal: signal } } : req,
    );
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  } catch (err) {
    throw mapAIError(err);
  }
}

/** Variante no-stream del chat (fallback). Lanza `AI_UNAVAILABLE` sin IA. */
export async function chatReply(input: ChatTurnInput): Promise<string> {
  if (!isAIConfigured()) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  try {
    const client = getAIClient();
    const res = await client.models.generateContent(buildChatRequest(input));
    const text = res.text ?? '';
    if (text.trim().length === 0) {
      throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió una respuesta');
    }
    return text;
  } catch (err) {
    throw mapAIError(err);
  }
}

import Anthropic from '@anthropic-ai/sdk';
import { TopicDifficulty } from '@bract/shared';
import type { TopicStatus } from '@bract/shared';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { AI_MODELS, getAIClient, isAIConfigured, isEffortCapable } from './ai.client.js';
import { renderContextForPrompt } from './ai.context.js';
import type { StudentContext } from './ai.context.js';
import {
  flashcardsJsonSchema,
  flashcardsOutputSchema,
  planJsonSchema,
  planOutputSchema,
} from './ai.schemas.js';
import {
  FLASHCARDS_SYSTEM,
  PLAN_SYSTEM,
  buildChatSystemPrompt,
  buildFlashcardsUserPrompt,
  buildPlanUserPrompt,
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

// ---- Constantes -----------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HORIZON_DAYS = 14;
const DEFAULT_FLASHCARD_COUNT = 10;
const MAX_FLASHCARD_COUNT = 10;
const PLAN_MAX_TOKENS = 8192;
const FLASHCARDS_MAX_TOKENS = 2048;
const CHAT_MAX_TOKENS = 4096;

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

/** Concatena los bloques de texto de una respuesta del modelo. */
function extractText(res: Anthropic.Message): string {
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
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
 * Genera el cronograma. Degradación útil: sin `AI_API_KEY` (o si la IA falla)
 * devuelve la distribución base determinista — el planner básico sigue andando.
 */
export async function generateStudyPlan(input: GeneratePlanInput): Promise<PlanDay[]> {
  const baseline = buildBaselinePlan(input);
  if (!isAIConfigured() || baseline.length === 0) return baseline;

  try {
    const client = getAIClient();
    const res = await client.messages.create({
      model: AI_MODELS.generation,
      max_tokens: PLAN_MAX_TOKENS,
      system: PLAN_SYSTEM,
      messages: [{ role: 'user', content: buildPlanUserPrompt(input, baseline) }],
      output_config: { format: { type: 'json_schema', schema: planJsonSchema } },
    });
    const parsed = parseStructured(extractText(res), planOutputSchema);
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
    const res = await client.messages.create({
      model: AI_MODELS.generation,
      max_tokens: FLASHCARDS_MAX_TOKENS,
      system: FLASHCARDS_SYSTEM,
      messages: [{ role: 'user', content: buildFlashcardsUserPrompt(input, cap) }],
      output_config: { format: { type: 'json_schema', schema: flashcardsJsonSchema } },
    });
    const parsed = parseStructured(extractText(res), flashcardsOutputSchema);
    if (!parsed) {
      throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió flashcards válidas');
    }
    return dedupeAndCap(parsed.cards, input.existing ?? [], cap);
  } catch (err) {
    throw mapAIError(err);
  }
}

function buildChatParams(input: ChatTurnInput): Anthropic.MessageCreateParamsNonStreaming {
  const model = AI_MODELS.chat;
  const messages: Anthropic.MessageParam[] = [
    ...input.history.map((m): Anthropic.MessageParam => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.message },
  ];
  const base: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: CHAT_MAX_TOKENS,
    system: buildChatSystemPrompt(renderContextForPrompt(input.context)),
    messages,
  };
  // effort solo en modelos que lo soportan (no Haiku) — chat default es Sonnet.
  return isEffortCapable(model) ? { ...base, output_config: { effort: 'medium' } } : base;
}

/**
 * Responde el chat en streaming (deltas de texto). E lo pipea a SSE — la respuesta
 * streameada es la excepción documentada al envelope JSON. Lanza `AI_UNAVAILABLE` sin IA.
 */
export async function* streamChatReply(input: ChatTurnInput): AsyncGenerator<string, void, unknown> {
  if (!isAIConfigured()) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  const client = getAIClient();
  try {
    const stream = client.messages.stream(buildChatParams(input));
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
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
    const res = await client.messages.create(buildChatParams(input));
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (text.trim().length === 0) {
      throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió una respuesta');
    }
    return text;
  } catch (err) {
    throw mapAIError(err);
  }
}

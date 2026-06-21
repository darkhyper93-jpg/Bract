import type { Content, GenerateContentParameters } from '@google/genai';
import {
  TopicDifficulty,
  QuestionType,
  OpenGrade,
  MAX_TOPIC_SOURCE_TEXT_LENGTH,
  MAX_OPEN_QUESTIONS,
} from '@bract/shared';
import type { ChatLanguage, TopicStatus } from '@bract/shared';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { AI_MODELS, getAIClient, isAIConfigured } from './ai.client.js';
import { renderContextForPrompt } from './ai.context.js';
import type { StudentContext } from './ai.context.js';
import {
  flashcardsOutputSchema,
  flashcardsResponseSchema,
  gradeOpenOutputSchema,
  gradeOpenResponseSchema,
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
  GRADE_OPEN_SYSTEM,
  PLAN_SYSTEM,
  QUIZ_SYSTEM,
  buildChatSystemPrompt,
  buildExtractTopicsUserPrompt,
  buildFlashcardsUserPrompt,
  buildGradeOpenUserPrompt,
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
    weakness?: number; // [0,1] — I-2 (capa 2), DEBILIDAD objetiva. Ausente/0 ⇒ sin efecto.
  }[];
  availability: { weekday: number; minutes: number }[]; // minutos/día (§3.4)
  horizonDays?: number; // default 14
  now?: string; // ISO; default hoy
  remediationAlpha?: number; // [0,1] — I-2. 0 (default) ⇒ orden idéntico a hoy.
  prioritySubjectIds?: string[]; // I-2 (capa 2), PRIORIDAD (preferencia). Vacío/ausente ⇒ sin efecto.
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
  // sourceText: grounding (excerpt fiel del material importado). Presente ⇒ las tarjetas se anclan a él;
  // ausente/null ⇒ generación como hoy (name + description). Ver buildFlashcardsUserPrompt.
  topic: { id: string; name: string; description?: string | null; sourceText?: string | null };
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
  // Idioma de la UI: el tutor responde SIEMPRE en este idioma (FIX idioma del chat).
  language: ChatLanguage;
}

export interface ExtractTopicsInput {
  text: string;
  subjectName?: string;
  max?: number; // default/tope duro MAX_EXTRACT_TOPICS
}

export interface ExtractedTopicAI {
  name: string;
  difficulty: TopicDifficulty;
  // Grounding: excerpt fiel del material sobre el tema (ya trimeado/capado). Ausente ⇒ tema sin material.
  sourceText?: string;
}

export interface GenerateQuizInput {
  scope: 'TOPIC' | 'SUBJECT';
  subjectName: string;
  // sourceText por tema: grounding (excerpt fiel). Ausente/null ⇒ ese tema genera como hoy. En multi-tema
  // el total inyectado se topea (ver buildQuizUserPrompt) para no reventar el budget de tokens.
  topics: { id: string; name: string; description?: string | null; sourceText?: string | null }[]; // 1 (TOPIC) o N (SUBJECT)
  count?: number; // default DEFAULT_QUIZ_COUNT, tope duro MAX_QUIZ_COUNT
  // openCount: cuántas de las `count` preguntas pedir como ABIERTAS (default 0 = solo MCQ, como hoy).
  // Tope duro MAX_OPEN_QUESTIONS → palanca de costo (máx. esa cantidad de correcciones por intento).
  openCount?: number;
}

export interface GeneratedQuizOption {
  text: string;
  explanation: string;
}

// Pregunta generada — unión discriminada por `type`. MCQ trae opciones + correctIndex (corrección local);
// OPEN trae expectedAnswer (criterio server-only; la corrección es una 2da llamada, gradeOpenAnswer).
export type GeneratedQuizQuestion =
  | {
      type: QuestionType.MCQ;
      topicId: string;
      question: string;
      options: GeneratedQuizOption[];
      correctIndex: number;
    }
  | {
      type: QuestionType.OPEN;
      topicId: string;
      question: string;
      expectedAnswer: string;
    };

// ---- Corrección de respuesta abierta (gradeOpenAnswer) --------------------
export interface GradeOpenInput {
  question: string;
  expectedAnswer: string; // criterio generado desde el material (server-only)
  // sourceText: material del tema re-inyectado para anclar la corrección. Ausente/null ⇒ corrige solo
  // contra expectedAnswer (degradación suave si el tema fue borrado).
  sourceText?: string | null;
  studentAnswer: string; // texto libre del alumno
}

export interface GradeOpenResult {
  grade: OpenGrade; // nota de 3 estados (fuente de verdad de la IA)
  feedback: string;
}

// ---- Constantes -----------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HORIZON_DAYS = 14;
const DEFAULT_FLASHCARD_COUNT = 10;
const MAX_FLASHCARD_COUNT = 10;
const MAX_EXTRACT_TOPICS = 50; // tope duro de temas por importación (Agente K)
const DEFAULT_QUIZ_COUNT = 5;
const MAX_QUIZ_COUNT = 10; // tope duro de preguntas por quiz (Agente I)
// FIX prompt acotado (materia entera): NO enviamos a la IA los hasta ~100 temas de una materia —
// el prompt se volvería enorme y, en el free tier, frágil. Mandamos una MUESTRA de a lo sumo esta
// cantidad (siempre ≥ la cantidad de preguntas pedidas). El scope/scopeName/topicCount persistidos los
// deriva el service desde el set COMPLETO de temas; esto solo acota lo que ve la IA al generar.
const QUIZ_PROMPT_MAX_TOPICS = 20;
const MIN_QUIZ_OPTIONS = 2;
const MAX_QUIZ_OPTIONS = 6;
const GRADE_OPEN_MAX_TOKENS = 512; // corrección de 1 abierta: nota + feedback breve (salida chica)
const PLAN_MAX_TOKENS = 8192;
const FLASHCARDS_MAX_TOKENS = 2048;
const CHAT_MAX_TOKENS = 4096;
// Subido de 4096: la salida del extract ahora incluye un `sourceText` por tema (hasta MAX_EXTRACT_TOPICS).
const EXTRACT_TOPICS_MAX_TOKENS = 8192;
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

// I-2 (capa 2) — DOS términos SEPARADOS y ADITIVOS en el orden del baseline (README §3.6): DEBILIDAD (objetiva,
// modulada por α) y PRIORIDAD (preferencia, nudge FIJO independiente de α). Ninguno multiplica al otro; topeados.
const NUDGE_MAX_DAYS = 7; // adelanto máx. por DEBILIDAD para temas CON examen (se modula por α)
const NUDGE_DIFFICULTY_WEIGHT = 1.5; // cuánto mueve la DEBILIDAD dentro del grupo SIN examen (se modula por α)
const PRIORITY_NUDGE_DAYS = 3; // adelanto FIJO por PRIORIDAD para temas CON examen (< NUDGE_MAX_DAYS) — sin α
const PRIORITY_NOEXAM_WEIGHT = 1.0; // cuánto mueve la PRIORIDAD dentro del grupo SIN examen — sin α

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
  // I-2 (capa 2): dos nudges ADITIVOS al orden — DEBILIDAD (×α) y PRIORIDAD (fija, sin α). Sin señal ⇒ igual a hoy.
  const alpha = input.remediationAlpha ?? 0;
  const prioritySet = new Set(input.prioritySubjectIds ?? []);
  const prio = (subjectId: string): number => (prioritySet.has(subjectId) ? 1 : 0); // factor SEPARADO de weakness
  // effectiveDays: temas CON examen reciben DOS nudges acumulativos y topeados. La DEBILIDAD se modula por α;
  // la PRIORIDAD es un nudge FIJO (sin α) → vale aunque alpha=0 (OFF). Adelanto total ≤ α·D + P. SIN examen ⇒ +∞.
  const effectiveDays = (t: { subjectId: string; weakness?: number }): number => {
    const examDays = examDaysFor(examBySubject.get(t.subjectId) ?? null, now);
    if (examDays >= Number.MAX_SAFE_INTEGER) return Number.POSITIVE_INFINITY;
    return (
      examDays -
      alpha * NUDGE_MAX_DAYS * (t.weakness ?? 0) -
      PRIORITY_NUDGE_DAYS * prio(t.subjectId) // prioridad: nudge FIJO, independiente de α
    );
  };
  // score (grupo SIN examen): dificultad de hoy + debilidad (×α) + prioridad (peso FIJO, sin α).
  // Sin datos de debilidad y sin prioridad ⇒ = difficultyRank (idéntico a hoy); una materia prioritaria sube por Wp aun en OFF.
  const score = (t: { subjectId: string; difficulty: TopicDifficulty; weakness?: number }): number =>
    DIFFICULTY_RANK[t.difficulty] +
    alpha * NUDGE_DIFFICULTY_WEIGHT * (t.weakness ?? 0) +
    PRIORITY_NOEXAM_WEIGHT * prio(t.subjectId); // prioridad: peso FIJO, independiente de α

  const ordered = [...pending].sort((a, b) => {
    const ea = effectiveDays(a);
    const eb = effectiveDays(b);
    if (ea !== eb) return ea - eb; // urgencia (con ambos nudges); +∞ = sin examen va al final
    return score(b) - score(a); // desempate: dificultad (+ debilidad si α>0, + prioridad siempre)
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
  // sourceText incluye `| undefined` explícito: lo infiere así Zod (.optional()) y el proyecto usa
  // exactOptionalPropertyTypes. El trim/omit de abajo lo normaliza.
  topics: { name: string; difficulty: string; sourceText?: string | undefined }[],
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
    // Grounding: trim + cap defensivo del excerpt (la IA puede excederse). Vacío ⇒ se omite (tema sin material).
    const sourceText = t.sourceText?.trim().slice(0, MAX_TOPIC_SOURCE_TEXT_LENGTH);
    out.push({
      name,
      difficulty: normalizeDifficulty(t.difficulty),
      ...(sourceText ? { sourceText } : {}),
    });
    if (out.length >= cap) break;
  }
  return out;
}

// Normaliza el `type` crudo de la IA: 'OPEN' (laxo, case-insensitive) ⇒ OPEN; cualquier otra cosa
// (ausente, 'MCQ', desconocido) ⇒ MCQ. Default MCQ = retrocompatible y conservador (camino probado).
function normalizeQuestionType(raw: string | undefined): QuestionType {
  return (raw ?? '').trim().toUpperCase() === QuestionType.OPEN ? QuestionType.OPEN : QuestionType.MCQ;
}

// Normaliza la nota cruda de la corrección de una abierta (la IA puede devolver "correcto"/minúsculas/
// español). INCORRECT primero (para no confundir "incorrecta" con "correcta"); desconocido ⇒ PARTIAL
// (no premia ni castiga al máximo, y para I-2 cuenta como NO correcta). Nunca falla el parse por esto.
function normalizeOpenGrade(raw: string): OpenGrade {
  const v = raw.trim().toUpperCase();
  if (v.startsWith('INCORRECT')) return OpenGrade.INCORRECT; // incl. "INCORRECTO/A"
  if (v.startsWith('CORRECT')) return OpenGrade.CORRECT; // incl. "CORRECTO/A"
  return OpenGrade.PARTIAL; // "PARTIAL"/"PARCIAL"/desconocido
}

// Valida la salida cruda del quiz (la IA puede devolver basura) e impone los invariantes de negocio,
// RAMIFICANDO por tipo de pregunta:
// - MCQ: cada opción con texto no vacío (la explicación es best-effort: si falta queda ''); nº de opciones
//   en [MIN, MAX]; correctIndex entero dentro del rango. Descarta la pregunta entera solo si no cumple eso
//   (nunca recorta opciones, que correría el índice).
// - OPEN: expectedAnswer no vacío; HARD CAP a `openCap` abiertas (palanca de costo: cada abierta = 1
//   futura llamada de corrección). Las abiertas de más se descartan (se completan con MCQ hasta `cap`).
// Comunes: topicId ∈ temas de entrada (si no, cae al primero — siempre hay ≥1); dedup por texto; cap a `cap`.
function validateAndCapQuiz(
  questions: {
    type?: string | undefined;
    topicId: string;
    question: string;
    options?: { text: string; explanation: string }[] | undefined;
    correctIndex?: number | undefined;
    expectedAnswer?: string | undefined;
  }[],
  input: GenerateQuizInput,
  cap: number,
  openCap: number,
  label: string, // [QUIZDEBUG] temporal: identifica la llamada (generateQuiz:mcq / :open / generateQuiz)
): GeneratedQuizQuestion[] {
  const validTopicIds = new Set(input.topics.map((t) => t.id));
  const fallbackTopicId = input.topics[0]?.id;
  if (fallbackTopicId === undefined) return []; // sin temas no hay quiz posible

  const seen = new Set<string>();
  const out: GeneratedQuizQuestion[] = [];
  let openUsed = 0;

  // [QUIZDEBUG] instrumentación temporal: motivo exacto de cada pregunta descartada (solo metadatos
  // numéricos, SIN el texto de la pregunta ni de las opciones). Se resume al final de la función.
  const drops: {
    reason: string;
    type: string;
    correctIndex?: number | undefined;
    optionsLength?: number | undefined;
  }[] = [];

  for (const q of questions) {
    const qType = normalizeQuestionType(q.type);
    const question = q.question.trim();
    if (question.length === 0) {
      drops.push({ reason: 'empty_question', type: qType });
      continue;
    }

    const key = normalizeQuestion(question);
    if (key.length === 0 || seen.has(key)) {
      drops.push({ reason: 'duplicate_or_empty_key', type: qType });
      continue;
    }

    const topicId = validTopicIds.has(q.topicId) ? q.topicId : fallbackTopicId;

    if (qType === QuestionType.OPEN) {
      if (openUsed >= openCap) {
        drops.push({ reason: 'open_cap_reached', type: qType });
        continue; // tope duro de abiertas (costo de corrección)
      }
      const expectedAnswer = (q.expectedAnswer ?? '').trim();
      if (expectedAnswer.length === 0) {
        drops.push({ reason: 'open_no_expected_answer', type: qType });
        continue; // OPEN sin criterio de corrección → inservible
      }
      seen.add(key);
      out.push({ type: QuestionType.OPEN, topicId, question, expectedAnswer });
      openUsed++;
    } else {
      const options: GeneratedQuizOption[] = [];
      let optionsOk = true;
      for (const o of q.options ?? []) {
        const text = o.text.trim();
        // DECISIÓN: una opción MCQ solo requiere `text` no vacío. Si la IA dejó la `explanation`
        // incompleta (frecuente en quizzes mixtos), NO descartamos la pregunta entera: conservamos
        // la opción con explanation = '' — perder la explicación de una opción no invalida la MCQ,
        // pero descartar la pregunta hacía desaparecer todas las MCQ y dejaba solo las abiertas.
        if (text.length === 0) {
          optionsOk = false;
          break;
        }
        options.push({ text, explanation: o.explanation.trim() });
      }
      if (!optionsOk) {
        drops.push({ reason: 'mcq_empty_option_text', type: qType, optionsLength: (q.options ?? []).length });
        continue;
      }
      if (options.length < MIN_QUIZ_OPTIONS || options.length > MAX_QUIZ_OPTIONS) {
        drops.push({ reason: 'mcq_options_count', type: qType, optionsLength: options.length });
        continue;
      }

      const correctIndex = q.correctIndex;
      if (
        correctIndex === undefined ||
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= options.length
      ) {
        drops.push({
          reason: 'mcq_correctIndex_invalid',
          type: qType,
          correctIndex,
          optionsLength: options.length,
        });
        continue;
      }
      seen.add(key);
      out.push({ type: QuestionType.MCQ, topicId, question, options, correctIndex });
    }

    if (out.length >= cap) break;
  }

  // [QUIZDEBUG] resumen por llamada: cuántas devolvió la IA (received), cuántas sobreviven (kept) y
  // el motivo exacto del resto (dropCounts agregados + drops con valores). SIN contenido de preguntas.
  logger.info('[QUIZDEBUG] validateAndCapQuiz', {
    label,
    cap,
    openCap,
    received: questions.length,
    kept: out.length,
    keptByType: {
      MCQ: out.filter((q) => q.type === QuestionType.MCQ).length,
      OPEN: out.filter((q) => q.type === QuestionType.OPEN).length,
    },
    dropCounts: drops.reduce<Record<string, number>>((acc, d) => {
      acc[d.reason] = (acc[d.reason] ?? 0) + 1;
      return acc;
    }, {}),
    drops,
  });

  return out;
}

// ---- Manejo de errores / degradación --------------------------------------

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---- Reintento del proveedor (FIX fiabilidad) -----------------------------
// Los cortes del free tier de Gemini (rate limit / 503 overload / red) son TRANSITORIOS, no bugs.
// Reintentamos las llamadas NO-stream con backoff exponencial antes de degradar a AI_UNAVAILABLE.
// NO se reintenta lo DETERMINISTA: la falta de key se chequea antes de la llamada, y la salida
// inválida/no parseable se valida DESPUÉS del reintento (parseStructured), así que nunca pasa por acá.

// Backoff por reintento: ~0.5s, 1.5s, 3s → hasta 3 reintentos (4 intentos totales).
const AI_RETRY_BACKOFF_MS = [500, 1500, 3000] as const;
// HTTP del proveedor que vale reintentar: 429 (rate limit) + familia 5xx (overload/gateway/timeout) +
// 408/425. El 400/401/403/404 es DETERMINISTA (request mal armado, key inválida/ausente) → no se reintenta.
const TRANSIENT_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
// Códigos de error de red de Node (fetch del SDK) que son transitorios.
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extrae un status HTTP numérico del error del SDK (ApiError expone `.status`), si lo hay.
function httpStatusOf(err: unknown): number | null {
  if (err !== null && typeof err === 'object' && 'status' in err) {
    const s = (err as { status: unknown }).status;
    if (typeof s === 'number') return s;
  }
  return null;
}

// Error de red (fetch del SDK): TypeError "fetch failed" o un `cause.code` de la lista transitoria.
function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as { cause?: unknown }).cause;
  if (cause !== null && typeof cause === 'object' && 'code' in cause) {
    const code = (cause as { code: unknown }).code;
    if (typeof code === 'string' && TRANSIENT_NETWORK_CODES.has(code)) return true;
  }
  const msg = err.message.toLowerCase();
  return msg.includes('fetch failed') || msg.includes('network') || msg.includes('socket hang up');
}

/** true si el fallo del proveedor es TRANSITORIO (vale reintentar); false si es determinista. */
function isTransientAIError(err: unknown): boolean {
  if (err instanceof AppError) return false; // lo lanzamos nosotros (sin key / salida inválida) → determinista
  const status = httpStatusOf(err);
  if (status !== null) return TRANSIENT_HTTP_STATUS.has(status);
  if (isNetworkError(err)) return true;
  // Sin status numérico: heurística por mensaje (el SDK suele embeber el motivo en el texto).
  const msg = errorMessage(err).toLowerCase();
  return (
    msg.includes('overload') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('unavailable') ||
    msg.includes('temporarily') ||
    msg.includes('try again') ||
    msg.includes('too many requests')
  );
}

/**
 * Ejecuta una llamada NO-stream al proveedor reintentándola ante errores TRANSITORIOS con backoff
 * exponencial. Reintenta solo lo transitorio; un error determinista corta de inmediato (se re-lanza y
 * lo mapea el caller). NO usar para streaming (el chat por SSE queda intacto).
 */
async function withAIRetry<T>(label: string, call: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= AI_RETRY_BACKOFF_MS.length; attempt++) {
    try {
      return await call();
    } catch (err) {
      lastErr = err;
      const delay = AI_RETRY_BACKOFF_MS[attempt];
      if (delay === undefined || !isTransientAIError(err)) break; // sin reintentos restantes o determinista
      logger.warn('ai.transient_retry', {
        label,
        attempt: attempt + 1,
        delayMs: delay,
        error: errorMessage(err),
      });
      await sleep(delay);
    }
  }
  throw lastErr;
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
    const res = await withAIRetry('generateFlashcards', () =>
      client.models.generateContent({
        model: AI_MODELS.generation,
        contents: buildFlashcardsUserPrompt(input, cap),
        config: {
          systemInstruction: FLASHCARDS_SYSTEM,
          maxOutputTokens: FLASHCARDS_MAX_TOKENS,
          responseMimeType: 'application/json',
          responseSchema: flashcardsResponseSchema,
        },
      }),
    );
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
 * UNA llamada estructurada al proveedor para generar quiz + parse + validación por tipo. Reintenta lo
 * transitorio (withAIRetry), valida la salida con Zod (lanza `AI_UNAVAILABLE` si no parsea) y aplica los
 * invariantes de negocio. `cap`/`openCap` controlan QUÉ tipos sobreviven la validación: `openCap = 0`
 * deja solo MCQ; `openCap = cap` deja solo OPEN. Lo usa generateQuiz para una o dos llamadas según el caso.
 */
async function runQuizGeneration(
  client: ReturnType<typeof getAIClient>,
  scopedInput: GenerateQuizInput,
  cap: number,
  openCap: number,
  label: string,
): Promise<GeneratedQuizQuestion[]> {
  const res = await withAIRetry(label, () =>
    client.models.generateContent({
      model: AI_MODELS.generation,
      contents: buildQuizUserPrompt(scopedInput, cap, openCap),
      config: {
        systemInstruction: QUIZ_SYSTEM,
        maxOutputTokens: QUIZ_MAX_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: quizResponseSchema,
      },
    }),
  );
  const parsed = parseStructured(res.text ?? '', quizOutputSchema);
  // [QUIZDEBUG] cuántas preguntas devolvió la IA en ESTA llamada (tras el parse Zod), antes de validar.
  logger.info('[QUIZDEBUG] runQuizGeneration', {
    label,
    cap,
    openCap,
    rawLen: (res.text ?? '').length,
    parsedOk: parsed != null,
    aiReturned: parsed?.questions.length ?? 0,
  });
  if (!parsed) {
    throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió un quiz válido');
  }
  return validateAndCapQuiz(parsed.questions, scopedInput, cap, openCap, label);
}

/**
 * Genera un quiz para un tema o materia (Agente I) con preguntas MCQ y/o ABIERTAS. MCQ: respuesta correcta
 * + explicación POR OPCIÓN → corrección local, sin 2da llamada. OPEN: `expectedAnswer` (criterio generado
 * desde el material, server-only) → la corrección del texto del alumno es una 2da llamada (gradeOpenAnswer)
 * recién al responder. `openCount` (default 0) decide cuántas abiertas; se topea a MAX_OPEN_QUESTIONS y a
 * `cap` (palanca de costo). Inherente a IA: lanza `AI_UNAVAILABLE` (503) sin la key. La salida se valida con
 * Zod + invariantes que ramifican por tipo. NO escribe en DB.
 *
 * FIX bug quiz mixto: gemini-flash-lite NO genera bien MCQ + OPEN en UNA sola llamada estructurada —
 * verificado con datos reales, devolvía SOLO las abiertas. Las generaciones de UN solo tipo SÍ funcionan.
 * Por eso, cuando se piden AMBOS tipos (openCap > 0 Y mcqCap > 0) hacemos DOS llamadas separadas en paralelo
 * —una pidiendo SOLO MCQ y otra SOLO OPEN— y combinamos (MCQ primero, luego OPEN). Si solo se pide un tipo
 * (openCap = 0 o mcqCap = 0), seguimos con UNA sola llamada como antes (sin costo extra).
 */
export async function generateQuiz(input: GenerateQuizInput): Promise<GeneratedQuizQuestion[]> {
  if (!isAIConfigured()) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  if (input.topics.length === 0) {
    throw new AppError('AI_UNAVAILABLE', 'No hay temas para generar el quiz');
  }
  const cap = Math.min(input.count ?? DEFAULT_QUIZ_COUNT, MAX_QUIZ_COUNT);
  // openCap ≤ MAX_OPEN_QUESTIONS y ≤ cap: garantiza como mucho esa cantidad de futuras correcciones IA.
  const openCap = Math.min(Math.max(input.openCount ?? 0, 0), MAX_OPEN_QUESTIONS, cap);
  const mcqCap = cap - openCap; // las restantes son MCQ
  // FIX prompt acotado: en materia entera capeamos los temas ENVIADOS a la IA a una muestra (≥ cap),
  // sin tocar lo que persiste el service (scope/scopeName/topicCount se derivan del set COMPLETO afuera).
  // El mismo `scopedInput` alimenta el prompt y la validación (la IA solo conoce estos topicId).
  const sampleSize = Math.max(QUIZ_PROMPT_MAX_TOPICS, cap);
  const scopedInput: GenerateQuizInput =
    input.topics.length > sampleSize
      ? { ...input, topics: input.topics.slice(0, sampleSize) }
      : input;
  try {
    const client = getAIClient();
    let questions: GeneratedQuizQuestion[];
    if (openCap > 0 && mcqCap > 0) {
      // Quiz MIXTO: DOS llamadas de UN solo tipo cada una (lo que el modelo SÍ maneja), en paralelo.
      // MCQ-only: cap = mcqCap, openCap = 0 (descarta cualquier OPEN). OPEN-only: cap/openCap = openCap.
      const [mcq, open] = await Promise.all([
        runQuizGeneration(client, scopedInput, mcqCap, 0, 'generateQuiz:mcq'),
        runQuizGeneration(client, scopedInput, openCap, openCap, 'generateQuiz:open'),
      ]);
      // Combinamos manteniendo la validación por tipo: MCQ primero, luego OPEN. El filtro por tipo es
      // defensivo (la MCQ-only ya excluye OPEN por openCap=0; nos blinda de fugas en la OPEN-only).
      questions = [
        ...mcq.filter((q) => q.type === QuestionType.MCQ),
        ...open.filter((q) => q.type === QuestionType.OPEN),
      ];
      // [QUIZDEBUG] caso MIXTO: cuántas MCQ y OPEN sobreviven de cada llamada y el total combinado.
      logger.info('[QUIZDEBUG] generateQuiz.mixed', {
        cap,
        openCap,
        mcqCap,
        mcqKept: mcq.length,
        openKept: open.length,
        combined: questions.length,
      });
    } else {
      // Single-type (solo MCQ o solo OPEN): UNA sola llamada, como antes (sin costo extra).
      questions = await runQuizGeneration(client, scopedInput, cap, openCap, 'generateQuiz');
    }
    if (questions.length === 0) {
      throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió preguntas válidas');
    }
    return questions;
  } catch (err) {
    throw mapAIError(err);
  }
}

/**
 * Corrige UNA respuesta abierta (2da llamada a la IA, al responder — Calidad de aprendizaje). Evalúa el
 * texto del alumno ESTRICTAMENTE contra `expectedAnswer` + el `sourceText` re-inyectado (anti-trampa: el
 * criterio nunca salió del server; anti-alucinación: prohibido conocimiento externo). Devuelve una nota de
 * 3 estados (normalizada) + feedback breve. Inherente a IA: lanza `AI_UNAVAILABLE` (503) si falla o falta la
 * key → el service NO consume el lock (el alumno reintenta). Modelo flash-lite, salida chica (~512 tokens).
 */
export async function gradeOpenAnswer(input: GradeOpenInput): Promise<GradeOpenResult> {
  if (!isAIConfigured()) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  try {
    const client = getAIClient();
    const res = await withAIRetry('gradeOpenAnswer', () =>
      client.models.generateContent({
        model: AI_MODELS.generation,
        contents: buildGradeOpenUserPrompt({
          question: input.question,
          expectedAnswer: input.expectedAnswer,
          sourceText: input.sourceText ?? null,
          studentAnswer: input.studentAnswer,
        }),
        config: {
          systemInstruction: GRADE_OPEN_SYSTEM,
          maxOutputTokens: GRADE_OPEN_MAX_TOKENS,
          responseMimeType: 'application/json',
          responseSchema: gradeOpenResponseSchema,
        },
      }),
    );
    const parsed = parseStructured(res.text ?? '', gradeOpenOutputSchema);
    if (!parsed) {
      throw new AppError('AI_UNAVAILABLE', 'La IA no devolvió una corrección válida');
    }
    return { grade: normalizeOpenGrade(parsed.grade), feedback: parsed.feedback.trim() };
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
      systemInstruction: buildChatSystemPrompt(renderContextForPrompt(input.context), input.language),
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

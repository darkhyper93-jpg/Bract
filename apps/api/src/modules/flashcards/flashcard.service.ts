import type { Flashcard as PrismaFlashcard } from '@prisma/client';
import { FlashcardSource, TopicDifficulty, TopicStatus } from '@bract/shared';
import type {
  Flashcard,
  FlashcardWithTopic,
  CreateFlashcardInput,
  UpdateFlashcardInput,
  FlashcardListQuery,
  FlashcardDueQuery,
  ReviewQuality,
} from '@bract/shared';
import type { FlashcardGenerateMultiMeta, FlashcardGenerateTopicResult } from '@bract/shared';
import { generateFlashcards } from '../../lib/ai/index.js';
import { AppError } from '../../lib/errors.js';
import { flashcardRepository } from './flashcard.repository.js';
import type { FlashcardWithTopicRow, TopicContextRow } from './flashcard.repository.js';
import { initialEaseForDifficulty, reviewSrs } from './srs.js';
import { gamificationEffects, safeGamify } from '../gamification/gamification.effects.js';

// ============================================================================
// Flashcards + SRS (Agente D) — lógica de negocio. Recibe DTOs (nunca req), mapea
// Prisma→shared (Date→ISO, enums casteados), orquesta la generación con IA (lib/ai
// del Agente B) y el motor SRS (srs.ts). NO toca HTTP.
// ============================================================================

const TOPIC_NOT_FOUND = 'Tema no encontrado';
const CARD_NOT_FOUND = 'Flashcard no encontrada';
const NO_CARDS_GENERATED = 'No se pudieron generar flashcards (IA no disponible)';

// ---- Mappers Prisma → contrato @bract/shared ------------------------------
// DECISIÓN: cast de enum Prisma → enum compartido (mismatch nominal de TS); mismo patrón
// que role/status en auth.service y type en notification.service (ver napkin / error.md).

function toFlashcard(f: PrismaFlashcard): Flashcard {
  return {
    id: f.id,
    topicId: f.topicId,
    userId: f.userId,
    question: f.question,
    answer: f.answer,
    source: f.source as FlashcardSource,
    ease: f.ease,
    intervalDays: f.intervalDays,
    reps: f.reps,
    dueDate: f.dueDate.toISOString(),
    lastReviewedAt: f.lastReviewedAt ? f.lastReviewedAt.toISOString() : null,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

function toFlashcardWithTopic(row: FlashcardWithTopicRow): FlashcardWithTopic {
  return {
    ...toFlashcard(row),
    topic: { id: row.topic.id, name: row.topic.name, subjectName: row.topic.subject.name },
  };
}

// ---- Helpers ---------------------------------------------------------------

async function requireTopicContext(topicId: string, userId: string): Promise<TopicContextRow> {
  const topic = await flashcardRepository.findTopicContext(topicId, userId);
  if (!topic) throw new AppError('NOT_FOUND', TOPIC_NOT_FOUND);
  return topic;
}

// Genera cartas para UN tema (contexto ya validado): IA + dedup contra existentes + persistencia.
// Reusado por `generate` (per-tema) y `generateMulti` (lote). Lanza AI_UNAVAILABLE si la IA falla.
async function generateForTopic(
  topic: TopicContextRow,
  userId: string,
  count?: number,
): Promise<Flashcard[]> {
  const existingRows = await flashcardRepository.findManyByTopicPaged(userId, topic.id, 1, 1000);
  const generated = await generateFlashcards({
    // sourceText: grounding del material importado (NULL ⇒ generación como hoy).
    topic: { id: topic.id, name: topic.name, description: topic.description, sourceText: topic.sourceText },
    subjectName: topic.subject.name,
    ...(count !== undefined ? { count } : {}),
    existing: existingRows.map((c) => ({ question: c.question })),
  });
  if (generated.length === 0) return [];
  const ease = initialEaseForDifficulty(topic.difficulty as TopicDifficulty);
  const created = await flashcardRepository.createManyReturning(
    generated.map((g) => ({
      topicId: topic.id,
      userId,
      question: g.question,
      answer: g.answer,
      source: FlashcardSource.AI as PrismaFlashcard['source'],
      ease,
    })),
  );
  return created.map(toFlashcard);
}

export const flashcardService = {
  // ---- Lectura ----
  async listByTopic(
    userId: string,
    query: FlashcardListQuery,
  ): Promise<{ flashcards: Flashcard[]; total: number }> {
    // Valida pertenencia del tema (404 si no es del usuario), no solo lista vacía.
    await requireTopicContext(query.topicId, userId);
    const [rows, total] = await Promise.all([
      flashcardRepository.findManyByTopicPaged(userId, query.topicId, query.page, query.perPage),
      flashcardRepository.countByTopic(userId, query.topicId),
    ]);
    return { flashcards: rows.map(toFlashcard), total };
  },

  async listDue(userId: string, query: FlashcardDueQuery): Promise<FlashcardWithTopic[]> {
    const rows = await flashcardRepository.findDueWithTopic(userId, new Date(), query.limit);
    return rows.map(toFlashcardWithTopic);
  },

  // ---- CRUD manual ----
  async create(userId: string, input: CreateFlashcardInput): Promise<Flashcard> {
    const topic = await requireTopicContext(input.topicId, userId);
    const created = await flashcardRepository.create({
      topicId: input.topicId,
      userId, // denormalizado al crear; nunca se transfiere (§3.4)
      question: input.question,
      answer: input.answer,
      source: FlashcardSource.MANUAL as PrismaFlashcard['source'],
      // dueDate default = now() (entra a la sesión enseguida). Ease sesgado por dificultad.
      ease: initialEaseForDifficulty(topic.difficulty as TopicDifficulty),
    });
    return toFlashcard(created);
  },

  async update(id: string, userId: string, input: UpdateFlashcardInput): Promise<Flashcard> {
    const existing = await flashcardRepository.findByIdAndUser(id, userId);
    if (!existing) throw new AppError('NOT_FOUND', CARD_NOT_FOUND);
    const updated = await flashcardRepository.update(id, {
      ...(input.question !== undefined ? { question: input.question } : {}),
      ...(input.answer !== undefined ? { answer: input.answer } : {}),
    });
    return toFlashcard(updated);
  },

  async delete(id: string, userId: string): Promise<void> {
    const existing = await flashcardRepository.findByIdAndUser(id, userId);
    if (!existing) throw new AppError('NOT_FOUND', CARD_NOT_FOUND);
    await flashcardRepository.deleteById(id);
  },

  // ---- Generación con IA (Agente B) ----
  // Lanza AI_UNAVAILABLE (503) si falta AI_API_KEY o la IA falla — el CRUD manual y el SRS no
  // dependen de esto. Dedup contra las cartas existentes del tema; tope de cantidad (≤10) en B.
  async generate(topicId: string, userId: string, count?: number): Promise<Flashcard[]> {
    const topic = await requireTopicContext(topicId, userId);
    return generateForTopic(topic, userId, count);
  },

  // Generación multi-tema (POST /flashcards/generate): un set de temas (1=individual, N=multi, todos=
  // materia → el front manda todos los topicIds). Cada carta se guarda con SU topicId (sin modelo nuevo).
  // SECUENCIAL (no en paralelo): la IA per-tema es 1 llamada, y el free tier se satura con muchas (503).
  // ÉXITO PARCIAL: si un tema falla, se conservan las cartas de los temas ya generados y se reporta el
  // fallido; solo si TODOS fallan se propaga AI_UNAVAILABLE. Ownership de TODOS los temas se valida ANTES
  // de gastar llamadas de IA (un tema ajeno/inexistente → NOT_FOUND, sin generar nada).
  async generateMulti(
    topicIds: string[],
    userId: string,
    count?: number,
  ): Promise<{ flashcards: Flashcard[]; meta: FlashcardGenerateMultiMeta }> {
    const uniqueIds = [...new Set(topicIds)];
    const contexts = new Map<string, TopicContextRow>();
    for (const id of uniqueIds) {
      contexts.set(id, await requireTopicContext(id, userId));
    }

    const flashcards: Flashcard[] = [];
    const results: FlashcardGenerateTopicResult[] = [];
    for (const id of uniqueIds) {
      try {
        const created = await generateForTopic(contexts.get(id)!, userId, count);
        flashcards.push(...created);
        results.push({ topicId: id, generated: created.length, failed: false });
      } catch {
        // No abortamos el lote: registramos el tema como fallido y seguimos con los demás.
        results.push({ topicId: id, generated: 0, failed: true });
      }
    }

    if (results.every((r) => r.failed)) {
      throw new AppError('AI_UNAVAILABLE', NO_CARDS_GENERATED);
    }
    return { flashcards, meta: { topics: results } };
  },

  // ---- SRS ----
  // Califica una carta (SM-2 Apéndice B) y persiste el nuevo estado. Devuelve la carta actualizada.
  async review(id: string, userId: string, quality: ReviewQuality): Promise<Flashcard> {
    const existing = await flashcardRepository.findByIdAndUser(id, userId);
    if (!existing) throw new AppError('NOT_FOUND', CARD_NOT_FOUND);
    const now = new Date();
    // wasDue se evalúa ANTES de actualizar: solo las cartas VENCIDAS dan XP (anti-farmeo; el SRS empuja
    // la carta al futuro, así que no se puede repetir la misma carta para farmear).
    const wasDue = existing.dueDate <= now;
    const result = reviewSrs(
      { ease: existing.ease, intervalDays: existing.intervalDays, reps: existing.reps },
      quality,
      now,
    );
    const updated = await flashcardRepository.update(id, {
      ease: result.ease,
      intervalDays: result.intervalDays,
      reps: result.reps,
      dueDate: result.dueDate,
      lastReviewedAt: result.lastReviewedAt,
    });

    // Gamificación (best-effort): XP por repasar una carta vencida + bonus/daño al jefe si el recuerdo
    // fue bueno (q≥4). El efecto NUNCA rompe el repaso (delegación detrás de safeGamify).
    await safeGamify(() =>
      gamificationEffects.onFlashcardReviewed(
        userId,
        { wasDue, quality, topicId: existing.topicId },
        now,
      ),
    );

    return toFlashcard(updated);
  },

  // ---- Integración (Agente F) — reacción al cambio de estado de un Topic ----
  // El planner NO toca las tablas de flashcards: delega acá (coupling limpio — cada módulo dueño de
  // su data, respeta capas). REGLA DELIBERADA (ver error.md): un tema en rotación de estudio
  // (IN_PROGRESS/COMPLETED) tiene sus cartas ACTIVAS en el SRS para reforzar la retención; un tema
  // PENDING las PAUSA (salen del `due`). Solo mueve `dueDate`; preserva `ease`/`intervalDays`/`reps`.
  // Idempotente: reaplicar el mismo estado no acumula efecto. Sin error si el tema no tiene cartas.
  async onTopicStatusChanged(userId: string, topicId: string, status: TopicStatus): Promise<void> {
    if (status === TopicStatus.PENDING) {
      await flashcardRepository.pauseSrsByTopic(userId, topicId);
    } else {
      await flashcardRepository.activateSrsByTopic(userId, topicId, new Date());
    }
  },
};

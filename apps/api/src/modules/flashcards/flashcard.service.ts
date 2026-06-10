import type { Flashcard as PrismaFlashcard } from '@prisma/client';
import { FlashcardSource, TopicDifficulty } from '@bract/shared';
import type {
  Flashcard,
  FlashcardWithTopic,
  CreateFlashcardInput,
  UpdateFlashcardInput,
  FlashcardListQuery,
  FlashcardDueQuery,
  ReviewQuality,
} from '@bract/shared';
import { generateFlashcards } from '../../lib/ai/index.js';
import { AppError } from '../../lib/errors.js';
import { flashcardRepository } from './flashcard.repository.js';
import type { FlashcardWithTopicRow, TopicContextRow } from './flashcard.repository.js';
import { initialEaseForDifficulty, reviewSrs } from './srs.js';

// ============================================================================
// Flashcards + SRS (Agente D) — lógica de negocio. Recibe DTOs (nunca req), mapea
// Prisma→shared (Date→ISO, enums casteados), orquesta la generación con IA (lib/ai
// del Agente B) y el motor SRS (srs.ts). NO toca HTTP.
// ============================================================================

const TOPIC_NOT_FOUND = 'Tema no encontrado';
const CARD_NOT_FOUND = 'Flashcard no encontrada';

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
    const existingRows = await flashcardRepository.findManyByTopicPaged(userId, topicId, 1, 1000);
    const generated = await generateFlashcards({
      topic: { id: topic.id, name: topic.name, description: topic.description },
      subjectName: topic.subject.name,
      ...(count !== undefined ? { count } : {}),
      existing: existingRows.map((c) => ({ question: c.question })),
    });
    if (generated.length === 0) return [];
    const ease = initialEaseForDifficulty(topic.difficulty as TopicDifficulty);
    const created = await flashcardRepository.createManyReturning(
      generated.map((g) => ({
        topicId,
        userId,
        question: g.question,
        answer: g.answer,
        source: FlashcardSource.AI as PrismaFlashcard['source'],
        ease,
      })),
    );
    return created.map(toFlashcard);
  },

  // ---- SRS ----
  // Califica una carta (SM-2 Apéndice B) y persiste el nuevo estado. Devuelve la carta actualizada.
  async review(id: string, userId: string, quality: ReviewQuality): Promise<Flashcard> {
    const existing = await flashcardRepository.findByIdAndUser(id, userId);
    if (!existing) throw new AppError('NOT_FOUND', CARD_NOT_FOUND);
    const result = reviewSrs(
      { ease: existing.ease, intervalDays: existing.intervalDays, reps: existing.reps },
      quality,
      new Date(),
    );
    const updated = await flashcardRepository.update(id, {
      ease: result.ease,
      intervalDays: result.intervalDays,
      reps: result.reps,
      dueDate: result.dueDate,
      lastReviewedAt: result.lastReviewedAt,
    });
    return toFlashcard(updated);
  },
};

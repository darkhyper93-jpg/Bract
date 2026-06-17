import apiClient from '../../../lib/axios';
import type {
  Flashcard,
  FlashcardWithTopic,
  FlashcardGenerateMultiMeta,
  CreateFlashcardInput,
  UpdateFlashcardInput,
  ReviewQuality,
} from '@bract/shared';

// Capa api/ de Flashcards + SRS (Agente D). Funciones tipadas que consumen las rutas §5.5.
// Todas devuelven el `data` desempaquetado del envelope `{ success, data, meta? }`.

interface Envelope<T> {
  success: true;
  data: T;
}

interface MetaEnvelope<T, M> {
  success: true;
  data: T;
  meta: M;
}

export const flashcardsApi = {
  // Cartas de un tema (paginado; pedimos un tope alto para la vista de gestión).
  async listByTopic(topicId: string, perPage = 100): Promise<Flashcard[]> {
    const res = await apiClient.get<Envelope<{ flashcards: Flashcard[] }>>('/flashcards', {
      params: { topicId, perPage },
    });
    return res.data.data.flashcards;
  },

  // Cola de repaso: cartas due del usuario, con contexto de tema/materia.
  async listDue(limit = 50): Promise<FlashcardWithTopic[]> {
    const res = await apiClient.get<Envelope<{ flashcards: FlashcardWithTopic[] }>>(
      '/flashcards/due',
      { params: { limit } },
    );
    return res.data.data.flashcards;
  },

  async create(input: CreateFlashcardInput): Promise<Flashcard> {
    const res = await apiClient.post<Envelope<{ flashcard: Flashcard }>>('/flashcards', input);
    return res.data.data.flashcard;
  },

  async update(id: string, input: UpdateFlashcardInput): Promise<Flashcard> {
    const res = await apiClient.patch<Envelope<{ flashcard: Flashcard }>>(
      `/flashcards/${id}`,
      input,
    );
    return res.data.data.flashcard;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/flashcards/${id}`);
  },

  // Generar con IA por tema (vía Agente B). Puede devolver AI_UNAVAILABLE (503) si falta la key.
  async generate(topicId: string, count?: number): Promise<Flashcard[]> {
    const res = await apiClient.post<Envelope<{ flashcards: Flashcard[] }>>(
      `/topics/${topicId}/flashcards/generate`,
      count !== undefined ? { count } : {},
    );
    return res.data.data.flashcards;
  },

  // Generar con IA sobre un set de temas (multi). Devuelve las cartas creadas + meta con el desglose
  // por tema (cuáles generaron y cuáles fallaron) → el front avisa el éxito parcial. AI_UNAVAILABLE
  // solo si TODOS los temas fallan.
  async generateMulti(
    topicIds: string[],
    count?: number,
  ): Promise<{ flashcards: Flashcard[]; meta: FlashcardGenerateMultiMeta }> {
    const res = await apiClient.post<MetaEnvelope<{ flashcards: Flashcard[] }, FlashcardGenerateMultiMeta>>(
      '/flashcards/generate',
      { topicIds, ...(count !== undefined ? { count } : {}) },
    );
    return { flashcards: res.data.data.flashcards, meta: res.data.meta };
  },

  // Calificar (SM-2): quality 0|3|4|5 → el backend actualiza ease/intervalDays/dueDate.
  async review(id: string, quality: ReviewQuality): Promise<Flashcard> {
    const res = await apiClient.post<Envelope<{ flashcard: Flashcard }>>(
      `/flashcards/${id}/review`,
      { quality },
    );
    return res.data.data.flashcard;
  },
};

import apiClient from '../../../lib/axios';
import type {
  AnswerQuestionInput,
  AnswerReveal,
  GeneratedAttempt,
  GenerateQuizInput,
  QuizAttempt,
  QuizAttemptWithItems,
} from '@bract/shared';

// Capa api/ de Evaluación / Quiz (Agente I). Funciones tipadas que consumen las rutas /quiz/attempts*.
// Devuelven el `data` desempaquetado del envelope { success, data, meta? }.

interface Envelope<T> {
  success: true;
  data: T;
}

interface ListEnvelope<T> {
  success: true;
  data: T;
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

export const quizApi = {
  // GENERAR: crea el intento IN_PROGRESS y devuelve las preguntas PÚBLICAS (sin correctIndex/explicación).
  async generate(input: GenerateQuizInput): Promise<GeneratedAttempt> {
    const res = await apiClient.post<Envelope<{ attempt: GeneratedAttempt }>>(
      '/quiz/attempts',
      input,
    );
    return res.data.data.attempt;
  },

  // RESPONDER 1 pregunta: el server corrige y devuelve la reveal (correctIndex + explicaciones) de esa pregunta.
  async answer(attemptId: string, input: AnswerQuestionInput): Promise<AnswerReveal> {
    const res = await apiClient.post<Envelope<{ reveal: AnswerReveal }>>(
      `/quiz/attempts/${attemptId}/answers`,
      input,
    );
    return res.data.data.reveal;
  },

  // Historial (intentos COMPLETED) paginado.
  async list(page = 1, perPage = 20): Promise<{ attempts: QuizAttempt[]; total: number }> {
    const res = await apiClient.get<ListEnvelope<{ attempts: QuizAttempt[] }>>('/quiz/attempts', {
      params: { page, perPage },
    });
    return { attempts: res.data.data.attempts, total: res.data.meta.total };
  },

  // Detalle de un intento (con items completos: explicaciones, correctIndex, tu respuesta).
  async getById(id: string): Promise<QuizAttemptWithItems> {
    const res = await apiClient.get<Envelope<{ attempt: QuizAttemptWithItems }>>(
      `/quiz/attempts/${id}`,
    );
    return res.data.data.attempt;
  },
};

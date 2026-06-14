import { useMutation, useQuery } from '@tanstack/react-query';
import type { AnswerQuestionInput } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { quizApi } from '../api/quiz.api';

// Evaluación / Quiz (Agente I) — hooks React Query.

// GENERAR el intento (mutación; no toca cache hasta completar → el historial se invalida al terminar).
export function useGenerateQuiz() {
  return useMutation({ mutationFn: quizApi.generate });
}

// RESPONDER 1 pregunta del intento (mutación por intento).
export function useAnswerQuestion(attemptId: string) {
  return useMutation({
    mutationFn: (input: AnswerQuestionInput) => quizApi.answer(attemptId, input),
  });
}

// Historial de intentos COMPLETED.
export function useQuizHistory() {
  const query = useQuery({
    queryKey: queryKeys.quiz.attempts(),
    queryFn: () => quizApi.list(),
    staleTime: 30_000,
  });
  return {
    attempts: query.data?.attempts ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

// Detalle de un intento (deshabilitado hasta seleccionar uno).
export function useQuizAttempt(id: string | null) {
  const query = useQuery({
    queryKey: queryKeys.quiz.attempt(id ?? ''),
    queryFn: () => quizApi.getById(id as string),
    enabled: id !== null,
    staleTime: 30_000,
  });
  return {
    attempt: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

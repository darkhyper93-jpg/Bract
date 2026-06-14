import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerQuestionInput, AnswerReveal, QuizAttemptWithItems } from '@bract/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { quizApi } from '../api/quiz.api';

// Evaluación / Quiz (Agente I) — hooks React Query.

// GENERAR el intento (mutación; no toca cache hasta completar → el historial se invalida al terminar).
export function useGenerateQuiz() {
  return useMutation({ mutationFn: quizApi.generate });
}

// RESPONDER 1 pregunta del intento (mutación por intento).
export function useAnswerQuestion(attemptId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnswerQuestionInput) => quizApi.answer(attemptId, input),
    // Mantener el detalle cacheado en sincronía con el server: marcar la pregunta como contestada con
    // su reveal (selectedIndex + correctIndex + isCorrect + explicaciones). Sin esto, el cache queda
    // "sin responder" y al volver de Historial el runner se re-siembra desde datos viejos, deselecciona
    // la respuesta y choca con el lock anti-trampa ("la pregunta ya fue respondida").
    onSuccess: (reveal: AnswerReveal, input: AnswerQuestionInput) => {
      queryClient.setQueryData<QuizAttemptWithItems>(
        queryKeys.quiz.attempt(attemptId),
        (prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((it) =>
                  it.order === reveal.order
                    ? {
                        ...it,
                        selectedIndex: input.selectedIndex,
                        isCorrect: reveal.isCorrect,
                        correctIndex: reveal.correctIndex,
                        options: reveal.options,
                      }
                    : it,
                ),
              }
            : prev,
      );
    },
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
// `fresh`: el runner reanuda desde el server (fuente de verdad) → en cada (re)montaje refetchea, así
// volver de Historial trae el estado real (preguntas ya contestadas saltadas) y no choca con el lock.
export function useQuizAttempt(id: string | null, fresh = false) {
  const query = useQuery({
    queryKey: queryKeys.quiz.attempt(id ?? ''),
    queryFn: () => quizApi.getById(id as string),
    enabled: id !== null,
    staleTime: fresh ? 0 : 30_000,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
  return {
    attempt: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

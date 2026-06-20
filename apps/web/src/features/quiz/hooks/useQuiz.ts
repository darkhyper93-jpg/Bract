import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QuestionType } from '@bract/shared';
import type { AnswerQuestionInput, AnswerReveal, QuizAttemptWithItems } from '@bract/shared';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { invalidateAfterStudyAction } from '../../../lib/invalidateStudyContext';
import { quizApi } from '../api/quiz.api';

// Evaluación / Quiz (Agente I) — hooks React Query.

// Backoff de la corrección de abiertas (ms): reintento silencioso hasta que llega la nota. Cap a 15s.
const GRADE_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000] as const;

// Sincroniza el detalle cacheado con un reveal del server (anti-trampa + reanudación: sin esto el cache
// queda desfasado y al volver de Historial el runner se re-siembra mal). `studentAnswer` se preserva del
// cache si el reveal no lo trae (la corrección no reenvía el texto).
function applyRevealToDetail(
  queryClient: QueryClient,
  attemptId: string,
  reveal: AnswerReveal,
  studentAnswer?: string,
): void {
  queryClient.setQueryData<QuizAttemptWithItems>(queryKeys.quiz.attempt(attemptId), (prev) =>
    prev
      ? {
          ...prev,
          items: prev.items.map((it) => {
            if (it.order !== reveal.order) return it;
            if (reveal.type === QuestionType.OPEN) {
              return {
                ...it,
                isCorrect: reveal.isCorrect,
                studentAnswer: studentAnswer ?? it.studentAnswer,
                grade: reveal.grade,
                feedback: reveal.feedback,
                expectedAnswer: reveal.expectedAnswer,
              };
            }
            return {
              ...it,
              selectedIndex: it.selectedIndex,
              isCorrect: reveal.isCorrect,
              correctIndex: reveal.correctIndex,
              options: reveal.options,
            };
          }),
        }
      : prev,
  );
}

// GENERAR el intento (mutación; no toca cache hasta completar → el historial se invalida al terminar).
export function useGenerateQuiz() {
  return useMutation({ mutationFn: quizApi.generate });
}

// RESPONDER 1 pregunta del intento (mutación por intento). OPEN: la reveal viene PENDIENTE (grade=null);
// la corrección se dispara aparte con useGradeOpenAnswer.
export function useAnswerQuestion(attemptId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnswerQuestionInput) => quizApi.answer(attemptId, input),
    // Mantener el detalle cacheado en sincronía: marcar la pregunta como contestada con su reveal (MCQ
    // completa; OPEN pendiente con el texto del alumno y grade=null).
    onSuccess: (reveal: AnswerReveal, input: AnswerQuestionInput) => {
      applyRevealToDetail(queryClient, attemptId, reveal, input.answerText);
      // Responder cuenta para el juego (Agente J): refrescamos el summary (XP/misión/jefe + animaciones).
      invalidateAfterStudyAction(queryClient);
    },
  });
}

// CORRECCIÓN de abiertas APARTE, con reintento silencioso (backoff, sin popups). `startGrading(order)`
// llama al endpoint /grade en bucle hasta que llega la nota; al llegar, sincroniza el cache del detalle
// y avisa por `onGraded`. De-dupe por order (no abre dos loops para el mismo ítem) y limpia timers al
// desmontar. `getAttempts(order)` deja al runner decidir cuándo mostrar "Continuar de todas formas".
export function useGradeOpenAnswer(attemptId: string) {
  const queryClient = useQueryClient();
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const active = useRef<Set<number>>(new Set());
  const attempts = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const t = timers.current;
    const a = active.current;
    return () => {
      t.forEach((id) => clearTimeout(id));
      t.clear();
      a.clear();
    };
  }, []);

  const startGrading = useCallback(
    (order: number, onGraded?: (reveal: AnswerReveal) => void) => {
      if (active.current.has(order)) return; // ya hay un loop para este ítem
      active.current.add(order);
      attempts.current.set(order, 0);

      const run = async (): Promise<void> => {
        if (!active.current.has(order)) return; // cancelado (desmontaje)
        const n = (attempts.current.get(order) ?? 0) + 1;
        attempts.current.set(order, n);

        let reveal: AnswerReveal | null = null;
        try {
          reveal = await quizApi.grade(attemptId, order);
        } catch {
          reveal = null; // error de red → mismo backoff, sin error visible
        }
        if (!active.current.has(order)) return;

        if (reveal && reveal.type === QuestionType.OPEN && reveal.grade !== null) {
          applyRevealToDetail(queryClient, attemptId, reveal);
          // La corrección de una abierta otorga XP de dominio (Agente J) → refrescamos el summary.
          invalidateAfterStudyAction(queryClient);
          active.current.delete(order);
          timers.current.delete(order);
          onGraded?.(reveal);
          return;
        }
        // Sigue pendiente → reintentar con backoff (cap al último valor).
        const delay = GRADE_BACKOFF_MS[Math.min(n - 1, GRADE_BACKOFF_MS.length - 1)]!;
        timers.current.set(order, setTimeout(() => void run(), delay));
      };
      void run();
    },
    [attemptId, queryClient],
  );

  return { startGrading };
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

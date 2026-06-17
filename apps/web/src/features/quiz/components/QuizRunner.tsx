import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { QuizAttemptStatus } from '@bract/shared';
import type { AnswerReveal, PublicQuizQuestion, QuizAttemptWithItems } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { cn } from '../../../utils/cn';
import { useAnswerQuestion, useQuizAttempt } from '../hooks/useQuiz';
import { QuestionReview } from './QuestionReview';
import type { AnsweredQuestion, QuizRunResult } from '../types';

function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: { code?: string } } | undefined;
    return data?.error?.code;
  }
  return undefined;
}

interface QuizRunnerProps {
  attemptId: string;
  // `true` cuando el attemptId viene de localStorage (reanudación), no de una generación fresca. En
  // ese caso, si la carga falla (404/error) o el intento ya está COMPLETED, no atrapamos al usuario en
  // el ErrorState: avisamos al padre para que limpie el localStorage y vuelva al setup.
  isResume: boolean;
  onFinished: (result: QuizRunResult) => void;
  onQuit: () => void;
  onResumeFailed: () => void;
}

// El runner se HIDRATA desde el server (fuente de verdad): dado un attemptId, carga el detalle del
// intento y reanuda donde estaba. Así, ir a Historial y volver (remontaje) retoma la posición real sin
// chocar con el lock anti-trampa. 4 estados (loading · empty · error · success) en el loader.
export function QuizRunner({ attemptId, isResume, onFinished, onQuit, onResumeFailed }: QuizRunnerProps) {
  const { t } = useTranslation();
  const { attempt, isLoading, isError, refetch } = useQuizAttempt(attemptId, true);

  // Reanudación inválida: el intento guardado ya no se puede correr. COMPLETED siempre (correrlo en el
  // runner no tiene sentido); carga fallida (404/error) solo si veníamos de localStorage. Una generación
  // fresca con error transitorio conserva su ErrorState + retry (abajo).
  const completed = !isLoading && attempt?.status === QuizAttemptStatus.COMPLETED;
  const loadFailed = !isLoading && (isError || attempt === null);
  const resumeInvalid = completed || (loadFailed && isResume);

  // Bounce al setup una sola vez (guard anti doble-disparo en StrictMode / re-render).
  const bailedRef = useRef(false);
  useEffect(() => {
    if (resumeInvalid && !bailedRef.current) {
      bailedRef.current = true;
      onResumeFailed();
    }
  }, [resumeInvalid, onResumeFailed]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="flex justify-end">
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    );
  }

  // Mientras el padre transiciona al setup, no flasheamos el ErrorState.
  if (resumeInvalid) return null;

  if (isError || attempt === null) {
    return (
      <ErrorState
        title={t('quiz.runner.loadError')}
        message={t('common.error')}
        onRetry={() => refetch()}
      />
    );
  }

  if (attempt.items.length === 0) {
    return (
      <EmptyState
        title={t('quiz.runner.loadError')}
        description={t('quiz.history.emptyDescription')}
        action={
          <Button type="button" variant="secondary" onClick={onQuit}>
            {t('quiz.runner.quit')}
          </Button>
        }
      />
    );
  }

  // key={attempt.id}: una sesión por intento; sembramos el estado UNA vez (un refetch no lo reinicia).
  return (
    <RunnerSession key={attempt.id} detail={attempt} onFinished={onFinished} onQuit={onQuit} />
  );
}

// Construye el estado inicial del runner a partir del detalle del server: las preguntas (públicas), las
// ya contestadas (con su reveal) y el índice de la primera sin responder.
function hydrate(detail: QuizAttemptWithItems): {
  questions: PublicQuizQuestion[];
  answers: AnsweredQuestion[];
  startIndex: number;
} {
  const questions: PublicQuizQuestion[] = detail.items.map((it) => ({
    order: it.order,
    topicId: it.topicId,
    question: it.question,
    options: it.options.map((o) => ({ text: o.text })),
  }));

  const answers: AnsweredQuestion[] = detail.items
    .filter((it) => it.selectedIndex !== null)
    .map((it) => ({
      question: {
        order: it.order,
        topicId: it.topicId,
        question: it.question,
        options: it.options.map((o) => ({ text: o.text })),
      },
      selectedIndex: it.selectedIndex as number, // filtrado: no es null
      reveal: {
        order: it.order,
        isCorrect: it.isCorrect,
        // Item contestado ⇒ correctIndex y explicaciones presentes (el backend los devuelve solo
        // para los contestados). Los ?? satisfacen el tipo (correctIndex number|null / explanation?)
        // y no se ejecutan en la práctica.
        correctIndex: it.correctIndex ?? 0,
        options: it.options.map((o) => ({ text: o.text, explanation: o.explanation ?? '' })),
      },
    }));

  const startIndex = detail.items.findIndex((it) => it.selectedIndex === null);
  return { questions, answers, startIndex };
}

interface RunnerSessionProps {
  detail: QuizAttemptWithItems;
  onFinished: (result: QuizRunResult) => void;
  onQuit: () => void;
}

// Paso 2 — una pregunta a la vez. Elegís una opción → "Responder" (el server corrige) → reveal
// (correcta/incorrecta + explicación por opción) → "Siguiente". La respuesta correcta y la explicación
// NO están en el cliente hasta responder (anti-trampa). Estado sembrado desde el detalle al montar.
function RunnerSession({ detail, onFinished, onQuit }: RunnerSessionProps) {
  const { t } = useTranslation();
  const answerMutation = useAnswerQuestion(detail.id);

  // Semilla calculada UNA sola vez (los inicializadores de useState ignoran cambios posteriores).
  const [seed] = useState(() => hydrate(detail));
  const { questions, startIndex } = seed;

  const [index, setIndex] = useState(startIndex < 0 ? questions.length - 1 : startIndex);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>(seed.answers);
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState<AnswerReveal | null>(null);

  const finish = (final: AnsweredQuestion[]) =>
    onFinished({
      scope: detail.scope,
      scopeName: detail.scopeName,
      topicCount: detail.topicCount,
      totalCount: detail.totalCount,
      answers: final,
    });

  // Si al hidratar ya estaban todas contestadas (p. ej. intento completado guardado en localStorage),
  // cerramos directo a resultados. Guard con ref para no dispararlo dos veces.
  const finishedRef = useRef(false);
  useEffect(() => {
    if (startIndex < 0 && !finishedRef.current) {
      finishedRef.current = true;
      finish(seed.answers);
    }
    // finish/seed estables durante la sesión; el guard evita el doble disparo en StrictMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex]);

  const question = questions[index];
  const total = questions.length;
  const isLast = index >= total - 1;

  if (!question) return null;

  const submitAnswer = () => {
    if (selected === null) return;
    answerMutation.mutate(
      { order: question.order, selectedIndex: selected },
      {
        onSuccess: (r) => {
          setReveal(r);
          setAnswers((prev) => [...prev, { question, selectedIndex: selected, reveal: r }]);
        },
      },
    );
  };

  const next = () => {
    if (isLast) {
      finish(answers);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setReveal(null);
  };

  const isConflict = apiErrorCode(answerMutation.error) === 'CONFLICT';

  return (
    <div className="flex flex-col gap-5">
      {/* Progreso */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-tertiary">
          {t('quiz.runner.progress', { current: index + 1, total })}
        </span>
        <button
          type="button"
          onClick={onQuit}
          className="text-xs text-text-tertiary transition-colors duration-[150ms] hover:text-error"
        >
          {t('quiz.runner.quit')}
        </button>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
        <div
          className="h-full rounded-full bg-brand-primary transition-all duration-[300ms]"
          style={{ width: `${((index + (reveal ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      {reveal ? (
        // Reveal: la pregunta ya corregida por el server.
        <QuestionReview
          index={index}
          question={question.question}
          options={reveal.options}
          correctIndex={reveal.correctIndex}
          selectedIndex={selected}
          isCorrect={reveal.isCorrect}
        />
      ) : (
        // Pregunta pública (sin pistas): elegís una opción.
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
          <p className="text-sm font-medium text-text-primary">
            <span className="text-text-tertiary">{index + 1}. </span>
            {question.question}
          </p>
          <ul className="flex flex-col gap-2">
            {question.options.map((opt, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-[150ms]',
                    selected === i
                      ? 'border-brand-primary bg-brand-muted text-brand-primary'
                      : 'border-border-default text-text-secondary hover:border-brand-primary/50 hover:text-text-primary',
                  )}
                >
                  {opt.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {answerMutation.isError && (
        <p className="text-sm text-error">
          {isConflict ? t('quiz.runner.errorConflict') : t('quiz.runner.error')}
        </p>
      )}

      <div className="flex justify-end">
        {reveal ? (
          <Button type="button" onClick={next}>
            {isLast ? t('quiz.runner.seeResults') : t('quiz.runner.next')}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={submitAnswer}
            disabled={selected === null}
            loading={answerMutation.isPending}
          >
            {t('quiz.runner.answer')}
          </Button>
        )}
      </div>
    </div>
  );
}

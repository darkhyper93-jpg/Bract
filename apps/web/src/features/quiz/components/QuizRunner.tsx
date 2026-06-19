import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import {
  ConfidenceLevel,
  QuizAttemptStatus,
  QuestionType,
  MAX_OPEN_ANSWER_LENGTH,
} from '@bract/shared';
import type { AnswerReveal, PublicQuizQuestion, QuizAttemptWithItems } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Textarea } from '../../../components/ui/Textarea';
import { cn } from '../../../utils/cn';
import { useAnswerQuestion, useGradeOpenAnswer, useQuizAttempt } from '../hooks/useQuiz';
import { QuestionReview } from './QuestionReview';
import type { AnsweredQuestion, QuizRunResult } from '../types';

// Orden de los chips de confianza (calibración): de menos a más seguro. Las etiquetas vienen de i18n
// con la clave `quiz.runner.confidence.<NIVEL>` (NIVEL = valor del enum).
const CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = [
  ConfidenceLevel.GUESS,
  ConfidenceLevel.LOW,
  ConfidenceLevel.MEDIUM,
  ConfidenceLevel.HIGH,
];

// Tiempo "Evaluando…" tras el cual ofrecemos "Continuar de todas formas" (válvula IA caída mucho rato).
// El camino normal es esperar la nota (suele llegar en segundos); esto solo evita dejar trabado al alumno.
const ESCAPE_AFTER_MS = 20_000;

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
  type Item = QuizAttemptWithItems['items'][number];
  const toPublic = (it: Item): PublicQuizQuestion => ({
    order: it.order,
    type: it.type,
    topicId: it.topicId,
    question: it.question,
    // OPEN ⇒ options []; MCQ ⇒ solo el texto (sin explicación hasta responder).
    options: it.options.map((o) => ({ text: o.text })),
  });
  // "Contestada" abarca ambos tipos: MCQ tiene selectedIndex, OPEN tiene studentAnswer.
  const isAnswered = (it: Item) => it.selectedIndex !== null || it.studentAnswer !== null;

  const questions: PublicQuizQuestion[] = detail.items.map(toPublic);

  const answers: AnsweredQuestion[] = detail.items.filter(isAnswered).map((it) => {
    // Item contestado ⇒ el backend ya devolvió la reveal completa según el tipo. Los ?? satisfacen el
    // tipo y no se ejecutan en la práctica (un contestado siempre trae sus campos).
    const reveal: AnswerReveal =
      it.type === QuestionType.OPEN
        ? {
            type: QuestionType.OPEN,
            order: it.order,
            isCorrect: it.isCorrect,
            // grade null = abierta respondida pero PENDIENTE de corrección ("Evaluando…"): se preserva
            // tal cual (NO se fuerza a INCORRECT) para reanudar el reintento de la nota.
            grade: it.grade,
            feedback: it.feedback,
            expectedAnswer: it.expectedAnswer,
          }
        : {
            type: QuestionType.MCQ,
            order: it.order,
            isCorrect: it.isCorrect,
            correctIndex: it.correctIndex ?? 0,
            options: it.options.map((o) => ({ text: o.text, explanation: o.explanation ?? '' })),
          };
    return {
      question: toPublic(it),
      selectedIndex: it.selectedIndex,
      studentAnswer: it.studentAnswer,
      reveal,
    };
  });

  const startIndex = detail.items.findIndex((it) => !isAnswered(it));
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
  const { startGrading } = useGradeOpenAnswer(detail.id);

  // Semilla calculada UNA sola vez (los inicializadores de useState ignoran cambios posteriores).
  const [seed] = useState(() => hydrate(detail));
  const { questions, startIndex } = seed;

  const [index, setIndex] = useState(startIndex < 0 ? questions.length - 1 : startIndex);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>(seed.answers);
  const [selected, setSelected] = useState<number | null>(null); // MCQ
  const [answerText, setAnswerText] = useState(''); // OPEN
  // Calibración: el alumno declara su confianza ANTES del reveal (se exige para responder).
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [reveal, setReveal] = useState<AnswerReveal | null>(null);
  // Válvula de seguridad: si la corrección de una abierta tarda demasiado (IA caída un rato largo),
  // habilitamos "Continuar de todas formas" para no dejar al alumno trabado (la nota se completa después).
  const [escapeUnlocked, setEscapeUnlocked] = useState(false);

  // Llega la nota de una abierta (corrección aparte): actualiza esa entrada en `answers` y, si seguís
  // parado en esa pregunta, el reveal visible. Estable para usarse desde startGrading.
  const handleGraded = useCallback((graded: AnswerReveal) => {
    setAnswers((prev) =>
      prev.map((a) => (a.question.order === graded.order ? { ...a, reveal: graded } : a)),
    );
    setReveal((prev) => (prev && prev.order === graded.order ? graded : prev));
  }, []);

  // Reanudación: arrancar el reintento de corrección de las abiertas que quedaron PENDIENTES (grade null)
  // en un intento guardado/recargado a mitad de evaluación. Guard para no dispararlo dos veces.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    for (const a of seed.answers) {
      if (a.reveal.type === QuestionType.OPEN && a.reveal.grade === null) {
        startGrading(a.reveal.order, handleGraded);
      }
    }
  }, [seed.answers, startGrading, handleGraded]);

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

  // Una abierta del reveal visible que sigue "Evaluando…" (respondida pero sin nota).
  const isEvaluating = reveal?.type === QuestionType.OPEN && reveal.grade === null;
  // Tras ESCAPE_AFTER_MS evaluando sin nota, habilitar "Continuar de todas formas". Se reinicia al
  // dejar de evaluar o al cambiar de pregunta.
  useEffect(() => {
    if (!isEvaluating) {
      setEscapeUnlocked(false);
      return;
    }
    const timer = setTimeout(() => setEscapeUnlocked(true), ESCAPE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isEvaluating, index]);

  const question = questions[index];
  const total = questions.length;
  const isLast = index >= total - 1;

  if (!question) return null;

  const isOpen = question.type === QuestionType.OPEN;
  const trimmedAnswer = answerText.trim();
  // Para responder se exige confianza + (MCQ: una opción / OPEN: texto no vacío).
  const canSubmit = confidence !== null && (isOpen ? trimmedAnswer.length > 0 : selected !== null);

  const submitAnswer = () => {
    if (!canSubmit || confidence === null) return;
    if (isOpen) {
      answerMutation.mutate(
        { order: question.order, answerText: trimmedAnswer, confidence },
        {
          onSuccess: (r) => {
            // Registrada al instante (reveal PENDIENTE, grade=null). Disparamos la corrección aparte:
            // reintento silencioso hasta que llega la nota → handleGraded actualiza el reveal.
            setReveal(r);
            setAnswers((prev) => [
              ...prev,
              { question, selectedIndex: null, studentAnswer: trimmedAnswer, reveal: r },
            ]);
            if (r.type === QuestionType.OPEN && r.grade === null) {
              startGrading(r.order, handleGraded);
            }
          },
        },
      );
    } else {
      if (selected === null) return;
      answerMutation.mutate(
        { order: question.order, selectedIndex: selected, confidence },
        {
          onSuccess: (r) => {
            setReveal(r);
            setAnswers((prev) => [
              ...prev,
              { question, selectedIndex: selected, studentAnswer: null, reveal: r },
            ]);
          },
        },
      );
    }
  };

  const next = () => {
    if (isLast) {
      finish(answers);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setAnswerText('');
    setConfidence(null);
    setReveal(null);
    setEscapeUnlocked(false);
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
        // Reveal: la pregunta ya corregida por el server. Ramifica por tipo.
        reveal.type === QuestionType.OPEN ? (
          <QuestionReview
            index={index}
            type={QuestionType.OPEN}
            question={question.question}
            isCorrect={reveal.isCorrect}
            studentAnswer={trimmedAnswer}
            grade={reveal.grade}
            feedback={reveal.feedback}
            expectedAnswer={reveal.expectedAnswer}
          />
        ) : (
          <QuestionReview
            index={index}
            type={QuestionType.MCQ}
            question={question.question}
            isCorrect={reveal.isCorrect}
            options={reveal.options}
            correctIndex={reveal.correctIndex}
            selectedIndex={selected}
          />
        )
      ) : (
        // Pregunta pública (sin pistas): MCQ → elegís una opción; OPEN → escribís la respuesta.
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
          <p className="text-sm font-medium text-text-primary">
            <span className="text-text-tertiary">{index + 1}. </span>
            {question.question}
          </p>
          {isOpen ? (
            <Textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder={t('quiz.runner.open.placeholder')}
              maxLength={MAX_OPEN_ANSWER_LENGTH}
              rows={5}
            />
          ) : (
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
          )}

          {/* Calibración: ¿qué tan seguro estás? — se exige antes de responder. */}
          <div className="mt-1 flex flex-col gap-2 border-t border-border-subtle pt-3">
            <p className="text-xs text-text-tertiary">{t('quiz.runner.confidenceQuestion')}</p>
            <div className="flex flex-wrap gap-2">
              {CONFIDENCE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setConfidence(level)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors duration-[150ms]',
                    confidence === level
                      ? 'border-brand-primary bg-brand-muted text-brand-primary'
                      : 'border-border-default text-text-secondary hover:border-brand-primary/50 hover:text-text-primary',
                  )}
                >
                  {t(`quiz.runner.confidence.${level}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {answerMutation.isError && (
        <p className="text-sm text-error">
          {isConflict ? t('quiz.runner.errorConflict') : t('quiz.runner.error')}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        {/* Mientras la abierta se corrige (grade=null): "Evaluando…". El alumno espera la nota antes de
            avanzar; la respuesta YA quedó guardada, así que nunca hay error ni pérdida. */}
        {isEvaluating && (
          <span className="text-xs text-text-tertiary">{t('quiz.runner.open.evaluating')}</span>
        )}
        {reveal ? (
          // Avance gateado mientras evalúa; tras el umbral, "Continuar de todas formas" (la nota se
          // completa después). Si ya hay nota, botón normal Siguiente / Ver resultados.
          <Button
            type="button"
            onClick={next}
            disabled={isEvaluating && !escapeUnlocked}
          >
            {isEvaluating && escapeUnlocked
              ? t('quiz.runner.open.continueAnyway')
              : isLast
                ? t('quiz.runner.seeResults')
                : t('quiz.runner.next')}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={submitAnswer}
            disabled={!canSubmit}
            loading={answerMutation.isPending}
          >
            {t('quiz.runner.answer')}
          </Button>
        )}
      </div>
    </div>
  );
}

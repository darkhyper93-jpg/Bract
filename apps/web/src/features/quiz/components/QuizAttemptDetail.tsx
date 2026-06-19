import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QuestionType, quizScore } from '@bract/shared';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useGradeOpenAnswer, useQuizAttempt } from '../hooks/useQuiz';
import { QuestionReview } from './QuestionReview';
import { scopeLabel } from '../lib/scopeLabel';

interface QuizAttemptDetailProps {
  id: string;
  onBack: () => void;
}

// Detalle de un intento del historial: header (materia/tema, puntaje, fecha) + repaso completo de cada
// pregunta (con explicaciones). Items completos vienen del GET /quiz/attempts/:id.
export function QuizAttemptDetail({ id, onBack }: QuizAttemptDetailProps) {
  const { t, i18n } = useTranslation();
  const { attempt, isLoading, isError, refetch } = useQuizAttempt(id);
  const { startGrading } = useGradeOpenAnswer(id);

  // Recuperación "después": si una abierta quedó respondida pero PENDIENTE de nota (IA caída un rato y el
  // alumno usó "Continuar de todas formas"), al abrir el detalle reintentamos la corrección en silencio
  // hasta completarla; el cache (setQueryData en el hook) actualiza la nota y el puntaje. Guard anti-doble.
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current || !attempt) return;
    const pendings = attempt.items.filter(
      (it) => it.type === QuestionType.OPEN && it.studentAnswer !== null && it.grade === null,
    );
    if (pendings.length === 0) return;
    recoveredRef.current = true;
    for (const it of pendings) startGrading(it.order);
  }, [attempt, startGrading]);

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="self-start text-xs text-text-tertiary transition-colors duration-[150ms] hover:text-text-primary"
    >
      ← {t('quiz.history.back')}
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || attempt === null) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <ErrorState title={t('quiz.history.loadError')} message={t('common.error')} onRetry={() => refetch()} />
      </div>
    );
  }

  // Puntaje con crédito parcial (correctas + 0.5×parciales), derivado de los grades guardados.
  const score = quizScore(attempt.correctCount, attempt.partialCount);
  const pct = attempt.totalCount > 0 ? Math.round((score / attempt.totalCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {back}

      <div className="flex flex-col items-center gap-1 rounded-lg border border-border-subtle bg-bg-surface py-6 text-center">
        <span className="text-xs uppercase tracking-wide text-text-tertiary">{scopeLabel(t, attempt)}</span>
        <p className="text-2xl font-semibold text-text-primary">
          {t('quiz.results.score', { correct: score, total: attempt.totalCount })}
        </p>
        <span className="text-sm text-text-secondary">{t('quiz.results.percent', { pct })}</span>
        <span className="text-xs text-text-tertiary">
          {new Date(attempt.createdAt).toLocaleDateString(i18n.language)}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {attempt.items.map((it, i) =>
          it.type === QuestionType.OPEN ? (
            <QuestionReview
              key={it.id}
              index={i}
              type={QuestionType.OPEN}
              question={it.question}
              isCorrect={it.isCorrect}
              studentAnswer={it.studentAnswer}
              grade={it.grade}
              feedback={it.feedback}
              expectedAnswer={it.expectedAnswer}
            />
          ) : (
            <QuestionReview
              key={it.id}
              index={i}
              type={QuestionType.MCQ}
              question={it.question}
              isCorrect={it.isCorrect}
              options={it.options}
              correctIndex={it.correctIndex}
              selectedIndex={it.selectedIndex}
            />
          ),
        )}
      </div>
    </div>
  );
}

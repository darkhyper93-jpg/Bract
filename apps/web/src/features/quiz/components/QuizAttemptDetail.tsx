import { useTranslation } from 'react-i18next';
import { QuestionType } from '@bract/shared';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useQuizAttempt } from '../hooks/useQuiz';
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

  const pct = attempt.totalCount > 0 ? Math.round((attempt.correctCount / attempt.totalCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {back}

      <div className="flex flex-col items-center gap-1 rounded-lg border border-border-subtle bg-bg-surface py-6 text-center">
        <span className="text-xs uppercase tracking-wide text-text-tertiary">{scopeLabel(t, attempt)}</span>
        <p className="text-2xl font-semibold text-text-primary">
          {t('quiz.results.score', { correct: attempt.correctCount, total: attempt.totalCount })}
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

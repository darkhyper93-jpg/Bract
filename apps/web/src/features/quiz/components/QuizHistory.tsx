import { useTranslation } from 'react-i18next';
import type { QuizAttempt } from '@bract/shared';
import { QuizScope } from '@bract/shared';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useQuizHistory } from '../hooks/useQuiz';

interface QuizHistoryProps {
  onOpen: (id: string) => void;
}

function scorePct(a: QuizAttempt): number {
  return a.totalCount > 0 ? Math.round((a.correctCount / a.totalCount) * 100) : 0;
}

// Historial de intentos COMPLETED. Click en un intento → detalle revisable.
export function QuizHistory({ onOpen }: QuizHistoryProps) {
  const { t, i18n } = useTranslation();
  const { attempts, isLoading, isError, refetch } = useQuizHistory();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState title={t('quiz.history.loadError')} message={t('common.error')} onRetry={() => refetch()} />
    );
  }

  if (attempts.length === 0) {
    return (
      <EmptyState title={t('quiz.history.emptyTitle')} description={t('quiz.history.emptyDescription')} />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {attempts.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onOpen(a.id)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 text-left transition-colors duration-[150ms] hover:border-brand-primary/50 hover:bg-bg-elevated"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-medium text-text-primary">{a.scopeName}</span>
              <div className="flex items-center gap-2">
                <Badge variant="neutral">
                  {a.scope === QuizScope.TOPIC ? t('quiz.history.scopeTopic') : t('quiz.history.scopeSubject')}
                </Badge>
                <span className="text-xs text-text-tertiary">
                  {new Date(a.createdAt).toLocaleDateString(i18n.language)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-sm font-semibold text-text-primary">
                {t('quiz.results.score', { correct: a.correctCount, total: a.totalCount })}
              </span>
              <span className="text-xs text-text-tertiary">
                {t('quiz.results.percent', { pct: scorePct(a) })}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

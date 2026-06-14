import { useTranslation } from 'react-i18next';
import type { QuizOption } from '@bract/shared';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../utils/cn';

interface QuestionReviewProps {
  index: number; // posición 0-based (se muestra +1)
  question: string;
  options: QuizOption[];
  correctIndex: number;
  selectedIndex: number | null; // null = sin responder
  isCorrect: boolean;
}

// Presentacional: repaso de UNA pregunta ya corregida (verde la correcta, rojo tu elección si fallaste)
// + explicación por opción. Reusado por el reveal del runner, los resultados y el detalle del historial.
export function QuestionReview({
  index,
  question,
  options,
  correctIndex,
  selectedIndex,
  isCorrect,
}: QuestionReviewProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-primary">
          <span className="text-text-tertiary">{index + 1}. </span>
          {question}
        </p>
        <Badge variant={isCorrect ? 'success' : 'error'} className="shrink-0">
          {isCorrect ? t('quiz.review.correct') : t('quiz.review.incorrect')}
        </Badge>
      </div>

      <ul className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const isTheCorrect = i === correctIndex;
          const isSelectedWrong = i === selectedIndex && !isTheCorrect;
          return (
            <li
              key={i}
              className={cn(
                'rounded-lg border px-3 py-2',
                isTheCorrect
                  ? 'border-success/30 bg-success/10'
                  : isSelectedWrong
                    ? 'border-error/30 bg-error/10'
                    : 'border-border-subtle bg-bg-elevated',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm',
                    isTheCorrect
                      ? 'text-success'
                      : isSelectedWrong
                        ? 'text-error'
                        : 'text-text-secondary',
                  )}
                >
                  {opt.text}
                </span>
                {isTheCorrect && (
                  <span className="text-xs text-success">· {t('quiz.review.correctAnswer')}</span>
                )}
                {isSelectedWrong && (
                  <span className="text-xs text-error">· {t('quiz.review.yourAnswer')}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-text-tertiary">{opt.explanation}</p>
            </li>
          );
        })}
      </ul>

      {selectedIndex === null && (
        <p className="text-xs text-text-tertiary">{t('quiz.review.noAnswer')}</p>
      )}
    </div>
  );
}

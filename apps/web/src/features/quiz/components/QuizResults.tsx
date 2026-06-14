import { useTranslation } from 'react-i18next';
import type { GeneratedAttempt } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { QuestionReview } from './QuestionReview';
import type { AnsweredQuestion } from '../types';

interface QuizResultsProps {
  attempt: GeneratedAttempt;
  answers: AnsweredQuestion[];
  onRestart: () => void;
}

// Paso 3 — resultados: puntaje X/N + repaso de cada pregunta (correcta/incorrecta + explicaciones).
// El intento ya quedó COMPLETED en el server al responder la última pregunta.
export function QuizResults({ attempt, answers, onRestart }: QuizResultsProps) {
  const { t } = useTranslation();
  const correct = answers.filter((a) => a.reveal.isCorrect).length;
  const total = attempt.totalCount;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-1 rounded-lg border border-border-subtle bg-bg-surface py-8 text-center">
        <span className="text-xs uppercase tracking-wide text-text-tertiary">
          {attempt.scopeName}
        </span>
        <p className="text-3xl font-semibold text-text-primary">
          {t('quiz.results.score', { correct, total })}
        </p>
        <span className="text-sm text-text-secondary">{t('quiz.results.percent', { pct })}</span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-text-secondary">{t('quiz.results.review')}</h3>
        <div className="mt-2 flex flex-col gap-3">
          {answers.map((a, i) => (
            <QuestionReview
              key={a.question.order}
              index={i}
              question={a.question.question}
              options={a.reveal.options}
              correctIndex={a.reveal.correctIndex}
              selectedIndex={a.selectedIndex}
              isCorrect={a.reveal.isCorrect}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onRestart}>
          {t('quiz.results.restart')}
        </Button>
      </div>
    </div>
  );
}

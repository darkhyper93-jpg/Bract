import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import type { AnswerReveal, GeneratedAttempt } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';
import { useAnswerQuestion } from '../hooks/useQuiz';
import { QuestionReview } from './QuestionReview';
import type { AnsweredQuestion } from '../types';

function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: { code?: string } } | undefined;
    return data?.error?.code;
  }
  return undefined;
}

interface QuizRunnerProps {
  attempt: GeneratedAttempt;
  onFinished: (answers: AnsweredQuestion[]) => void;
  onQuit: () => void;
}

// Paso 2 — una pregunta a la vez. Elegís una opción → "Responder" (el server corrige) → reveal
// (correcta/incorrecta + explicación por opción) → "Siguiente". La respuesta correcta y la explicación
// NO están en el cliente hasta responder (anti-trampa).
export function QuizRunner({ attempt, onFinished, onQuit }: QuizRunnerProps) {
  const { t } = useTranslation();
  const answerMutation = useAnswerQuestion(attempt.attemptId);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState<AnswerReveal | null>(null);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);

  const question = attempt.questions[index];
  const total = attempt.questions.length;
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
      onFinished(answers);
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

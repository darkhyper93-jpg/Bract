import { useTranslation } from 'react-i18next';
import { QuestionType, OpenGrade } from '@bract/shared';
import type { QuizAttemptItemOption } from '@bract/shared';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../utils/cn';

// Badge por nota de 3 estados (abiertas): correcta=verde, parcial=amarillo, incorrecta=rojo.
const GRADE_VARIANT: Record<OpenGrade, 'success' | 'warning' | 'error'> = {
  [OpenGrade.CORRECT]: 'success',
  [OpenGrade.PARTIAL]: 'warning',
  [OpenGrade.INCORRECT]: 'error',
};

interface QuestionReviewProps {
  index: number; // posición 0-based (se muestra +1)
  type: QuestionType;
  question: string;
  isCorrect: boolean;
  // ---- MCQ ----
  options?: QuizAttemptItemOption[]; // explanation opcional: ausente en preguntas sin responder
  correctIndex?: number | null; // null = sin responder (no se revela la correcta)
  selectedIndex?: number | null; // null = sin responder
  // ---- OPEN ----
  studentAnswer?: string | null; // texto del alumno (null = sin responder)
  grade?: OpenGrade | null; // nota de 3 estados (null = sin responder)
  feedback?: string | null; // devolución de la IA
  expectedAnswer?: string | null; // criterio/respuesta esperada (solo tras responder)
}

// Presentacional: repaso de UNA pregunta ya corregida. MCQ → opciones (verde la correcta, rojo tu
// elección si fallaste) + explicación por opción. OPEN → tu respuesta + nota (3 estados) + devolución de
// la IA + respuesta esperada. Reusado por el reveal del runner, los resultados y el detalle del historial.
export function QuestionReview(props: QuestionReviewProps) {
  const { t } = useTranslation();
  const { index, question, isCorrect } = props;

  if (props.type === QuestionType.OPEN) {
    return (
      <OpenReview
        index={index}
        question={question}
        isCorrect={isCorrect}
        studentAnswer={props.studentAnswer ?? null}
        grade={props.grade ?? null}
        feedback={props.feedback ?? null}
        expectedAnswer={props.expectedAnswer ?? null}
      />
    );
  }

  const options = props.options ?? [];
  const correctIndex = props.correctIndex ?? null;
  const selectedIndex = props.selectedIndex ?? null;
  // Sin responder = sin elección Y sin correcta revelada. El badge correcta/incorrecta solo aplica a
  // preguntas ya contestadas (un item pendiente de un intento IN_PROGRESS no es "incorrecto").
  const answered = selectedIndex !== null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-primary">
          <span className="text-text-tertiary">{index + 1}. </span>
          {question}
        </p>
        {answered && (
          <Badge variant={isCorrect ? 'success' : 'error'} className="shrink-0">
            {isCorrect ? t('quiz.review.correct') : t('quiz.review.incorrect')}
          </Badge>
        )}
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
              {opt.explanation && (
                <p className="mt-1 text-xs text-text-tertiary">{opt.explanation}</p>
              )}
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

interface OpenReviewProps {
  index: number;
  question: string;
  isCorrect: boolean;
  studentAnswer: string | null;
  grade: OpenGrade | null;
  feedback: string | null;
  expectedAnswer: string | null;
}

// Repaso de una pregunta ABIERTA ya corregida (o pendiente). El badge usa la nota de 3 estados.
function OpenReview({ index, question, studentAnswer, grade, feedback, expectedAnswer }: OpenReviewProps) {
  const { t } = useTranslation();
  const answered = studentAnswer !== null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-primary">
          <span className="text-text-tertiary">{index + 1}. </span>
          {question}
        </p>
        {answered && grade && (
          <Badge variant={GRADE_VARIANT[grade]} className="shrink-0">
            {t(`quiz.review.grade.${grade}`)}
          </Badge>
        )}
      </div>

      {answered ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2">
            <p className="text-xs text-text-tertiary">{t('quiz.review.yourAnswer')}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{studentAnswer}</p>
          </div>
          {feedback && (
            <div className="rounded-lg border border-brand-primary/20 bg-brand-muted/40 px-3 py-2">
              <p className="text-xs text-brand-primary">{t('quiz.review.feedback')}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{feedback}</p>
            </div>
          )}
          {expectedAnswer && (
            <div className="rounded-lg border border-success/20 bg-success/10 px-3 py-2">
              <p className="text-xs text-success">{t('quiz.review.expectedAnswer')}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{expectedAnswer}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-tertiary">{t('quiz.review.noAnswer')}</p>
      )}
    </div>
  );
}

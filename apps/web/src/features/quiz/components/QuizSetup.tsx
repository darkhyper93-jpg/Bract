import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Link } from 'react-router-dom';
import {
  QuizScope,
  type GeneratedAttempt,
  type GenerateQuizInput,
  MIN_QUIZ_QUESTIONS,
  MAX_QUIZ_QUESTIONS,
  DEFAULT_QUIZ_QUESTIONS,
} from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useSubjects } from '../../planner/hooks/useSubjects';
import { useGenerateQuiz } from '../hooks/useQuiz';
import { quizSetupSchema, type QuizSetupValues } from '../schemas/quiz.form.schema';

// Extrae el `error.code` del envelope para distinguir AI_UNAVAILABLE del resto (patrón de import).
function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: { code?: string } } | undefined;
    return data?.error?.code;
  }
  return undefined;
}

const COUNT_OPTIONS = [3, 5, 10].filter((n) => n >= MIN_QUIZ_QUESTIONS && n <= MAX_QUIZ_QUESTIONS);

interface QuizSetupProps {
  onGenerated: (attempt: GeneratedAttempt) => void;
}

// Paso 1 — elegir materia, opcional un tema (o "toda la materia") y cantidad → generar el intento.
export function QuizSetup({ onGenerated }: QuizSetupProps) {
  const { t } = useTranslation();
  const { subjects, isLoading, isError, refetch } = useSubjects();
  const generate = useGenerateQuiz();

  const { control, handleSubmit, watch, setValue } = useForm<QuizSetupValues>({
    resolver: zodResolver(quizSetupSchema),
    defaultValues: { subjectId: '', topicId: '', count: DEFAULT_QUIZ_QUESTIONS },
  });

  const subjectId = watch('subjectId');
  const hasSubjects = subjects.length > 0;
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const topics = selectedSubject?.topics ?? [];
  // Materia elegida sin temas → no hay nada que generar (mismo contrato que el backend, README §5.6).
  const subjectHasNoTopics = selectedSubject !== undefined && topics.length === 0;

  // Al cargar las materias, seleccionar la primera por defecto.
  useEffect(() => {
    if (hasSubjects && subjectId === '') setValue('subjectId', subjects[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubjects]);

  const onSubmit = (values: QuizSetupValues) => {
    const input: GenerateQuizInput =
      values.topicId !== ''
        ? { scope: QuizScope.TOPIC, topicId: values.topicId, count: values.count }
        : { scope: QuizScope.SUBJECT, subjectId: values.subjectId, count: values.count };
    generate.mutate(input, { onSuccess: onGenerated });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-40" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState title={t('quiz.setup.loadError')} message={t('common.error')} onRetry={() => refetch()} />
    );
  }

  if (!hasSubjects) {
    return (
      <EmptyState
        title={t('quiz.setup.emptyTitle')}
        description={t('quiz.setup.emptyDescription')}
      />
    );
  }

  const isAIUnavailable = apiErrorCode(generate.error) === 'AI_UNAVAILABLE';
  const isNoTopics = apiErrorCode(generate.error) === 'VALIDATION_ERROR';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Controller
        control={control}
        name="subjectId"
        render={({ field }) => (
          <Select
            label={t('quiz.setup.subject')}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            value={field.value}
            onChange={(v) => {
              field.onChange(v);
              setValue('topicId', ''); // cambiar de materia resetea el tema
            }}
            placeholder={t('quiz.setup.subjectPlaceholder')}
          />
        )}
      />

      <Controller
        control={control}
        name="topicId"
        render={({ field }) => (
          <Select
            label={t('quiz.setup.topic')}
            options={[
              { value: '', label: t('quiz.setup.wholeSubject') },
              ...topics.map((tp) => ({ value: tp.id, label: tp.name })),
            ]}
            value={field.value}
            onChange={field.onChange}
            placeholder={t('quiz.setup.wholeSubject')}
          />
        )}
      />

      <Controller
        control={control}
        name="count"
        render={({ field }) => (
          <Select
            label={t('quiz.setup.count')}
            options={COUNT_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            value={String(field.value)}
            onChange={(v) => field.onChange(Number(v))}
          />
        )}
      />

      {subjectHasNoTopics && (
        <p className="text-sm text-text-tertiary">
          {t('quiz.setup.noTopics')}{' '}
          <Link to="/planner" className="text-brand-primary hover:underline">
            {t('quiz.setup.noTopicsCta')}
          </Link>
        </p>
      )}

      {generate.isError && (
        <p className="text-sm text-error">
          {isAIUnavailable
            ? t('quiz.setup.aiUnavailable')
            : isNoTopics
              ? t('quiz.setup.noTopics')
              : t('quiz.setup.error')}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={generate.isPending} disabled={subjectHasNoTopics}>
          {t('quiz.setup.generate')}
        </Button>
      </div>
    </form>
  );
}

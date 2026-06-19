import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Link } from 'react-router-dom';
import {
  type GeneratedAttempt,
  type GenerateQuizInput,
  MIN_QUIZ_QUESTIONS,
  MAX_QUIZ_QUESTIONS,
  MAX_OPEN_QUESTIONS,
  DEFAULT_QUIZ_QUESTIONS,
} from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { MultiSelect } from '../../../components/ui/MultiSelect';
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
    defaultValues: { subjectId: '', topicIds: [], count: DEFAULT_QUIZ_QUESTIONS, openCount: 0 },
  });

  const subjectId = watch('subjectId');
  const topicIds = watch('topicIds');
  const count = watch('count');
  // Tope de abiertas: no más que MAX_OPEN_QUESTIONS ni que el total de preguntas. Opciones 0..maxOpen.
  const maxOpen = Math.min(MAX_OPEN_QUESTIONS, count);
  const openCountOptions = Array.from({ length: maxOpen + 1 }, (_, i) => i);
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

  // El cliente manda el SET de temas; el server deriva el scope (1=individual, todos=materia, N=multi).
  const onSubmit = (values: QuizSetupValues) => {
    const input: GenerateQuizInput = {
      subjectId: values.subjectId,
      topicIds: values.topicIds,
      count: values.count,
      openCount: values.openCount,
    };
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
              setValue('topicIds', []); // cambiar de materia resetea los temas elegidos
            }}
            placeholder={t('quiz.setup.subjectPlaceholder')}
          />
        )}
      />

      <Controller
        control={control}
        name="topicIds"
        render={({ field }) => (
          <MultiSelect
            label={t('quiz.setup.topics')}
            options={topics.map((tp) => ({ value: tp.id, label: tp.name }))}
            value={field.value}
            onChange={field.onChange}
            placeholder={t('quiz.setup.topicsPlaceholder')}
            selectAllLabel={t('quiz.setup.selectAllTopics')}
            disabled={topics.length === 0}
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
            onChange={(v) => {
              const next = Number(v);
              field.onChange(next);
              // Si el nuevo total es menor que las abiertas elegidas, recortamos las abiertas al tope.
              const openCount = watch('openCount');
              if (openCount > next) setValue('openCount', Math.min(next, MAX_OPEN_QUESTIONS));
            }}
          />
        )}
      />

      <Controller
        control={control}
        name="openCount"
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Select
              label={t('quiz.setup.openCount')}
              options={openCountOptions.map((n) => ({
                value: String(n),
                label: n === 0 ? t('quiz.setup.openCountOff') : String(n),
              }))}
              value={String(field.value)}
              onChange={(v) => field.onChange(Number(v))}
            />
            <p className="text-xs text-text-tertiary">
              {t('quiz.setup.openCountHint', { max: MAX_OPEN_QUESTIONS })}
            </p>
          </div>
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
        <Button
          type="submit"
          loading={generate.isPending}
          disabled={subjectHasNoTopics || topicIds.length === 0}
        >
          {t('quiz.setup.generate')}
        </Button>
      </div>
    </form>
  );
}

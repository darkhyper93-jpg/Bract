import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import type { ExtractedTopic } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { cn } from '../../../utils/cn';
import { useSubjects } from '../../planner/hooks/useSubjects';
import { useImport } from '../hooks/useImport';
import { importInputSchema, type ImportInputValues } from '../schemas/import.form.schema';
import type { ImportTarget } from '../types';

// Extrae el `error.code` del envelope de la API para distinguir AI_UNAVAILABLE del resto.
function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: { code?: string } } | undefined;
    return data?.error?.code;
  }
  return undefined;
}

interface ImportTextFormProps {
  onExtracted: (target: ImportTarget, topics: ExtractedTopic[]) => void;
}

// Paso 1 — pegar texto + elegir materia destino (existente o nueva). Al extraer, la IA devuelve el
// preview de temas (no escribe en DB). La materia elegida da contexto a la IA y se arrastra al commit.
export function ImportTextForm({ onExtracted }: ImportTextFormProps) {
  const { t } = useTranslation();
  const { subjects, isLoading, isError, refetch } = useSubjects();
  const { extract } = useImport();
  const hasSubjects = subjects.length > 0;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ImportInputValues>({
    resolver: zodResolver(importInputSchema),
    defaultValues: { text: '', targetKind: 'new', subjectId: '', newName: '' },
  });

  const targetKind = watch('targetKind');
  const subjectId = watch('subjectId');

  // Cuando ya hay materias, por defecto apuntamos a una existente (flujo más común: agregar temas).
  useEffect(() => {
    if (hasSubjects) {
      setValue('targetKind', 'existing');
      setValue('subjectId', subjects[0]?.id ?? '');
    }
    // Solo al cargar/cambiar la disponibilidad de materias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubjects]);

  const fieldError = (msg?: string) => (msg ? t(`import.form.${msg}`) : undefined);

  const onSubmit = (values: ImportInputValues) => {
    const target: ImportTarget =
      values.targetKind === 'existing'
        ? {
            kind: 'existing',
            subjectId: values.subjectId ?? '',
            name: subjects.find((s) => s.id === values.subjectId)?.name ?? '',
          }
        : { kind: 'new', name: (values.newName ?? '').trim() };

    extract.mutate(
      { text: values.text, ...(target.name ? { subjectName: target.name } : {}) },
      { onSuccess: (preview) => onExtracted(target, preview.topics) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-9 w-full max-w-xs" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState title={t('import.errorLoad')} message={t('common.error')} onRetry={() => refetch()} />
    );
  }

  const isAIUnavailable = apiErrorCode(extract.error) === 'AI_UNAVAILABLE';
  const subjectIdError = fieldError(errors.subjectId?.message);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Textarea
        label={t('import.form.text')}
        placeholder={t('import.form.textPlaceholder')}
        rows={10}
        error={fieldError(errors.text?.message)}
        hint={t('import.form.textHint')}
        {...register('text')}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text-secondary">{t('import.form.target')}</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('import.form.target')}>
          <button
            type="button"
            role="radio"
            aria-checked={targetKind === 'existing'}
            disabled={!hasSubjects}
            onClick={() => setValue('targetKind', 'existing')}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm transition-colors duration-[150ms]',
              targetKind === 'existing'
                ? 'border-brand-primary bg-brand-muted text-brand-primary'
                : 'border-border-default text-text-secondary hover:text-text-primary',
              !hasSubjects && 'cursor-not-allowed opacity-40',
            )}
          >
            {t('import.form.targetExisting')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={targetKind === 'new'}
            onClick={() => setValue('targetKind', 'new')}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm transition-colors duration-[150ms]',
              targetKind === 'new'
                ? 'border-brand-primary bg-brand-muted text-brand-primary'
                : 'border-border-default text-text-secondary hover:text-text-primary',
            )}
          >
            {t('import.form.targetNew')}
          </button>
        </div>

        {targetKind === 'existing' ? (
          <Select
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            value={subjectId ?? ''}
            onChange={(v) => setValue('subjectId', v, { shouldValidate: true })}
            placeholder={t('import.form.selectSubject')}
            {...(subjectIdError ? { error: subjectIdError } : {})}
          />
        ) : (
          <Input
            placeholder={t('import.form.newNamePlaceholder')}
            error={fieldError(errors.newName?.message)}
            {...register('newName')}
          />
        )}
      </div>

      {extract.isError && (
        <p className="text-sm text-error">
          {isAIUnavailable ? t('import.toast.aiUnavailable') : t('import.toast.extractError')}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={extract.isPending}>
          {t('import.form.analyze')}
        </Button>
      </div>
    </form>
  );
}

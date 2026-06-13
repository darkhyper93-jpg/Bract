import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import {
  ACCEPTED_IMPORT_FILE_EXTENSIONS,
  MAX_IMPORT_FILE_BYTES,
  type ExtractedTopic,
} from '@bract/shared';
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

const ACCEPT_ATTR = ACCEPTED_IMPORT_FILE_EXTENSIONS.join(',');
const MAX_FILE_MB = Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024));

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_IMPORT_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface ImportSourceStepProps {
  onExtracted: (target: ImportTarget, topics: ExtractedTopic[], truncated: boolean) => void;
}

// Paso 1 — elegir fuente (pegar TEXTO o subir ARCHIVO) + materia destino (existente o nueva). Al
// extraer, la IA devuelve el preview de temas (no escribe en DB). El selector de materia se comparte
// entre ambas fuentes. Tras extraer, ambos caen en el MISMO preview/commit.
export function ImportSourceStep({ onExtracted }: ImportSourceStepProps) {
  const { t } = useTranslation();
  const { subjects, isLoading, isError, refetch } = useSubjects();
  const { extract, extractFile } = useImport();
  const hasSubjects = subjects.length > 0;

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ImportInputValues>({
    resolver: zodResolver(importInputSchema),
    defaultValues: { sourceKind: 'text', text: '', targetKind: 'new', subjectId: '', newName: '' },
  });

  const sourceKind = watch('sourceKind');
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

  const selectFile = (picked: File | null) => {
    setFileError(null);
    if (picked === null) {
      setFile(null);
      return;
    }
    if (!hasAcceptedExtension(picked.name)) {
      setFile(null);
      setFileError(t('import.form.fileUnsupported'));
      return;
    }
    if (picked.size > MAX_IMPORT_FILE_BYTES) {
      setFile(null);
      setFileError(t('import.form.fileTooLarge', { max: MAX_FILE_MB }));
      return;
    }
    setFile(picked);
  };

  const buildTarget = (values: ImportInputValues): ImportTarget =>
    values.targetKind === 'existing'
      ? {
          kind: 'existing',
          subjectId: values.subjectId ?? '',
          name: subjects.find((s) => s.id === values.subjectId)?.name ?? '',
        }
      : { kind: 'new', name: (values.newName ?? '').trim() };

  const onSubmit = (values: ImportInputValues) => {
    const target = buildTarget(values);
    const subjectName = target.name ? { subjectName: target.name } : {};

    if (values.sourceKind === 'file') {
      if (file === null) {
        setFileError(t('import.form.fileRequired'));
        return;
      }
      extractFile.mutate(
        { file, ...subjectName },
        { onSuccess: (preview) => onExtracted(target, preview.topics, preview.truncated ?? false) },
      );
      return;
    }

    extract.mutate(
      { text: values.text ?? '', ...subjectName },
      { onSuccess: (preview) => onExtracted(target, preview.topics, preview.truncated ?? false) },
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

  const activeMutation = sourceKind === 'file' ? extractFile : extract;
  const isAIUnavailable = apiErrorCode(activeMutation.error) === 'AI_UNAVAILABLE';
  const subjectIdError = fieldError(errors.subjectId?.message);

  const sourceTab = (kind: 'text' | 'file', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={sourceKind === kind}
      onClick={() => setValue('sourceKind', kind)}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm transition-colors duration-[150ms]',
        sourceKind === kind
          ? 'border-brand-primary bg-brand-muted text-brand-primary'
          : 'border-border-default text-text-secondary hover:text-text-primary',
      )}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* Toggle de fuente: texto pegado vs archivo */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('import.form.source')}>
        {sourceTab('text', t('import.form.sourceText'))}
        {sourceTab('file', t('import.form.sourceFile'))}
      </div>

      {sourceKind === 'text' ? (
        <Textarea
          label={t('import.form.text')}
          placeholder={t('import.form.textPlaceholder')}
          rows={10}
          error={fieldError(errors.text?.message)}
          hint={t('import.form.textHint')}
          {...register('text')}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-secondary">{t('import.form.file')}</span>
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center transition-colors duration-[150ms]',
              fileError
                ? 'border-error bg-error/5'
                : 'border-border-default hover:border-brand-primary hover:bg-brand-muted/40',
            )}
          >
            <input
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <span className="text-sm font-medium text-text-primary">{file.name}</span>
            ) : (
              <>
                <span className="text-sm text-text-secondary">{t('import.form.fileDrop')}</span>
                <span className="text-xs text-text-tertiary">
                  {t('import.form.fileHint', { types: ACCEPTED_IMPORT_FILE_EXTENSIONS.join(' · '), max: MAX_FILE_MB })}
                </span>
              </>
            )}
          </label>
          {file && (
            <button
              type="button"
              onClick={() => selectFile(null)}
              className="self-start text-xs text-text-tertiary transition-colors duration-[150ms] hover:text-error"
            >
              {t('import.form.fileRemove')}
            </button>
          )}
          {fileError && <p className="text-xs text-error">{fileError}</p>}
        </div>
      )}

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

      {activeMutation.isError && (
        <p className="text-sm text-error">
          {isAIUnavailable ? t('import.toast.aiUnavailable') : t('import.toast.extractError')}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={activeMutation.isPending}>
          {t('import.form.analyze')}
        </Button>
      </div>
    </form>
  );
}

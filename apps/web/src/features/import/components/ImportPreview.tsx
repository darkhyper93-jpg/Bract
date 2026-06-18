import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImportMode, TopicDifficulty } from '@bract/shared';
import type { CommitImportInput, ExtractedTopic, ImportCommitResult } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useToast } from '../../../hooks/useToast';
import { cn } from '../../../utils/cn';
import { useImport } from '../hooks/useImport';
import type { ImportTarget } from '../types';

interface EditableTopic {
  key: number;
  name: string;
  difficulty: TopicDifficulty;
  // Grounding (Calidad de aprendizaje §2): excerpt fiel del material que produjo la IA en el extract.
  // Viaja SILENCIOSO (no se muestra ni se edita en v1) y se reenvía en el commit para persistirlo.
  sourceText?: string;
}

interface ImportPreviewProps {
  target: ImportTarget;
  initialTopics: ExtractedTopic[];
  truncated?: boolean;
  onBack: () => void;
  onCommitted: (result: ImportCommitResult) => void;
}

function IconList() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// Paso 2 — revisar/editar los temas extraídos (nombre + dificultad), elegir add/replace y confirmar.
// El borrado lo decide el MODE (toggle), nunca la IA. Para materias nuevas, replace no aplica (ADD).
export function ImportPreview({
  target,
  initialTopics,
  truncated = false,
  onBack,
  onCommitted,
}: ImportPreviewProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { commit } = useImport();
  const keyCounter = useRef(0);

  const [topics, setTopics] = useState<EditableTopic[]>(() =>
    initialTopics.map((tp) => ({
      key: keyCounter.current++,
      name: tp.name,
      difficulty: tp.difficulty,
      // Conservamos el excerpt de grounding sin exponerlo en la UI; se reenvía tal cual en el commit.
      ...(tp.sourceText ? { sourceText: tp.sourceText } : {}),
    })),
  );
  const [mode, setMode] = useState<ImportMode>(ImportMode.ADD);

  const canReplace = target.kind === 'existing';
  const effectiveMode = canReplace ? mode : ImportMode.ADD;

  const difficultyOptions = useMemo(
    () =>
      Object.values(TopicDifficulty).map((d) => ({
        value: d,
        label: t(`planner.difficulty.${d}`),
      })),
    [t],
  );

  const validTopics = topics.filter((tp) => tp.name.trim().length > 0);

  const updateTopic = (key: number, patch: Partial<EditableTopic>) =>
    setTopics((prev) => prev.map((tp) => (tp.key === key ? { ...tp, ...patch } : tp)));

  const removeTopic = (key: number) => setTopics((prev) => prev.filter((tp) => tp.key !== key));

  const handleConfirm = () => {
    if (validTopics.length === 0) return;
    const payload: CommitImportInput = {
      topics: validTopics.map((tp) => ({
        name: tp.name.trim(),
        difficulty: tp.difficulty,
        // Reenviamos el excerpt de grounding para que el backend lo persista en Topic.sourceText.
        ...(tp.sourceText ? { sourceText: tp.sourceText } : {}),
      })),
      mode: effectiveMode,
      ...(target.kind === 'existing'
        ? { subjectId: target.subjectId }
        : { subjectName: target.name }),
    };
    commit.mutate(payload, {
      onSuccess: (result) => onCommitted(result),
      onError: () => toast.error(t('import.toast.commitError')),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Aviso de truncado: el texto del archivo superó el tope y se procesó parcialmente */}
      {truncated && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {t('import.preview.truncated')}
        </div>
      )}

      {/* Materia destino */}
      <div className="rounded-lg border border-border-subtle bg-bg-surface/40 p-4">
        <p className="text-xs text-text-tertiary">{t('import.preview.target')}</p>
        <p className="mt-0.5 text-sm font-medium text-text-primary">
          {target.name}{' '}
          <span className="text-text-tertiary">
            {target.kind === 'new' ? `· ${t('import.preview.newSubject')}` : ''}
          </span>
        </p>
      </div>

      {/* Modo add/replace */}
      {canReplace && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text-secondary">{t('import.preview.mode')}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('import.preview.mode')}>
            <button
              type="button"
              role="radio"
              aria-checked={mode === ImportMode.ADD}
              onClick={() => setMode(ImportMode.ADD)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors duration-[150ms]',
                mode === ImportMode.ADD
                  ? 'border-brand-primary bg-brand-muted text-brand-primary'
                  : 'border-border-default text-text-secondary hover:text-text-primary',
              )}
            >
              {t('import.preview.modeAdd')}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === ImportMode.REPLACE}
              onClick={() => setMode(ImportMode.REPLACE)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors duration-[150ms]',
                mode === ImportMode.REPLACE
                  ? 'border-error bg-error/10 text-error'
                  : 'border-border-default text-text-secondary hover:text-text-primary',
              )}
            >
              {t('import.preview.modeReplace')}
            </button>
          </div>
          <p className="text-xs text-text-tertiary">
            {mode === ImportMode.REPLACE
              ? t('import.preview.modeReplaceHint')
              : t('import.preview.modeAddHint')}
          </p>
        </div>
      )}

      {/* Lista editable de temas */}
      {topics.length === 0 ? (
        <EmptyState
          icon={<IconList />}
          title={t('import.preview.emptyTitle')}
          description={t('import.preview.emptyDescription')}
          action={
            <Button variant="secondary" size="sm" onClick={onBack}>
              {t('import.preview.back')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">
              {t('import.preview.topicsCount', { count: validTopics.length })}
            </span>
          </div>
          {topics.map((tp) => (
            <div key={tp.key} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  value={tp.name}
                  onChange={(e) => updateTopic(tp.key, { name: e.target.value })}
                  aria-label={t('import.preview.topicName')}
                />
              </div>
              <div className="w-36 shrink-0">
                <Select
                  options={difficultyOptions}
                  value={tp.difficulty}
                  onChange={(v) => updateTopic(tp.key, { difficulty: v as TopicDifficulty })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeTopic(tp.key)}
                aria-label={t('common.delete')}
                className="mt-1.5 shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors duration-[150ms] hover:bg-error/10 hover:text-error"
              >
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack} disabled={commit.isPending}>
          {t('import.preview.back')}
        </Button>
        <Button onClick={handleConfirm} loading={commit.isPending} disabled={validTopics.length === 0}>
          {t('import.preview.confirm', { count: validTopics.length })}
        </Button>
      </div>
    </div>
  );
}

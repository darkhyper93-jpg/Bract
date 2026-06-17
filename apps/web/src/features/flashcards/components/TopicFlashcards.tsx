import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { FlashcardSource, type Flashcard } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Select } from '../../../components/ui/Select';
import { MultiSelect } from '../../../components/ui/MultiSelect';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useToast } from '../../../hooks/useToast';
import { useSubjects } from '../../planner';
import { useFlashcards } from '../hooks/useFlashcards';
import { useFlashcardMutations } from '../hooks/useFlashcardMutations';
import { FlashcardFormModal } from './FlashcardFormModal';
import { ConfirmDialog } from './ConfirmDialog';

function IconLayers() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

// Extrae el `error.code` del envelope de la API para distinguir AI_UNAVAILABLE del resto.
function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: { code?: string } } | undefined;
    return data?.error?.code;
  }
  return undefined;
}

interface CardRowProps {
  card: Flashcard;
  onEdit: (card: Flashcard) => void;
  onDelete: (card: Flashcard) => void;
}

function CardRow({ card, onEdit, onDelete }: CardRowProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{card.question}</p>
        <p className="mt-0.5 truncate text-xs text-text-tertiary">{card.answer}</p>
      </div>
      <Badge variant={card.source === FlashcardSource.AI ? 'info' : 'neutral'}>
        {t(card.source === FlashcardSource.AI ? 'flashcards.source.ai' : 'flashcards.source.manual')}
      </Badge>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => onEdit(card)}>
          {t('common.edit')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(card)}>
          {t('common.delete')}
        </Button>
      </div>
    </div>
  );
}

export function TopicFlashcards() {
  const { t } = useTranslation();
  const toast = useToast();
  const { subjects, isLoading: subjectsLoading, isError: subjectsError, refetch: refetchSubjects } = useSubjects();
  const { generate, generateMulti, remove } = useFlashcardMutations();

  const [subjectId, setSubjectId] = useState<string>('');
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Flashcard | undefined>(undefined);
  const [deleting, setDeleting] = useState<Flashcard | undefined>(undefined);
  // Resultado de una generación multi-tema (éxito parcial): cuántas cartas, en cuántos temas, y cuáles fallaron.
  const [genResult, setGenResult] = useState<
    { generated: number; okCount: number; failedNames: string[] } | null
  >(null);

  // La gestión per-tema (listar/crear/editar) requiere un único tema → solo activa con exactamente 1.
  const selectedTopicId = topicIds.length === 1 ? topicIds[0]! : null;
  const { flashcards, isLoading, isError, refetch } = useFlashcards(selectedTopicId);

  const subjectOptions = useMemo(
    () => subjects.map((s) => ({ value: s.id, label: s.name })),
    [subjects],
  );
  const subjectTopics = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.topics ?? [],
    [subjects, subjectId],
  );
  const topicOptions = useMemo(
    () => subjectTopics.map((tp) => ({ value: tp.id, label: tp.name })),
    [subjectTopics],
  );
  const topicName = (id: string) => subjectTopics.find((tp) => tp.id === id)?.name ?? id;
  // Materia elegida sin temas → no hay tema que elegir ni generar (contrato uniforme, README §5.6).
  const subjectHasNoTopics = subjectId !== '' && topicOptions.length === 0;
  const generating = generate.isPending || generateMulti.isPending;

  const openNew = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (card: Flashcard) => {
    setEditing(card);
    setFormOpen(true);
  };

  const onGenerateError = (err: unknown) =>
    toast.error(
      apiErrorCode(err) === 'AI_UNAVAILABLE'
        ? t('flashcards.toast.aiUnavailable')
        : t('flashcards.toast.error'),
    );

  const handleGenerate = () => {
    if (topicIds.length === 0) return;
    setGenResult(null);
    // 1 tema → flujo per-tema actual (1 llamada). ≥2 → multi (secuencial, éxito parcial).
    if (topicIds.length === 1) {
      generate.mutate(
        { topicId: topicIds[0]! },
        {
          onSuccess: (cards) => toast.success(t('flashcards.toast.generated', { count: cards.length })),
          onError: onGenerateError,
        },
      );
      return;
    }
    generateMulti.mutate(
      { topicIds },
      {
        onSuccess: ({ meta }) => {
          const ok = meta.topics.filter((tp) => !tp.failed);
          const failed = meta.topics.filter((tp) => tp.failed);
          const generated = ok.reduce((sum, tp) => sum + tp.generated, 0);
          const failedNames = failed.map((tp) => topicName(tp.topicId));
          setGenResult({ generated, okCount: ok.length, failedNames });
          if (failed.length === 0) {
            toast.success(t('flashcards.toast.generatedMulti', { count: generated, topics: ok.length }));
          } else {
            toast.warning(
              t('flashcards.toast.generatedPartialTitle'),
              t('flashcards.toast.generatedPartialMsg', { names: failedNames.join(', ') }),
            );
          }
        },
        onError: onGenerateError,
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(
      { id: deleting.id, topicId: deleting.topicId },
      {
        onSuccess: () => {
          toast.success(t('flashcards.toast.deleted'));
          setDeleting(undefined);
        },
        onError: () => toast.error(t('flashcards.toast.error')),
      },
    );
  };

  // Estado: cargando materias.
  if (subjectsLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Estado: error cargando materias.
  if (subjectsError) {
    return <ErrorState title={t('flashcards.errorLoad')} message={t('common.error')} onRetry={() => refetchSubjects()} />;
  }

  // Estado: sin materias → las flashcards cuelgan de temas del planner (§8.6).
  if (subjects.length === 0) {
    return (
      <EmptyState
        icon={<IconLayers />}
        title={t('flashcards.manage.noSubjects')}
        description={t('flashcards.manage.noSubjectsDescription')}
        action={
          <Link to="/planner">
            <Button>{t('flashcards.manage.goToPlanner')}</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label={t('flashcards.manage.subject')}
          placeholder={t('flashcards.manage.selectSubject')}
          options={subjectOptions}
          value={subjectId}
          onChange={(v) => {
            setSubjectId(v);
            setTopicIds([]);
            setGenResult(null);
          }}
        />
        <MultiSelect
          label={t('flashcards.manage.topics')}
          placeholder={t('flashcards.manage.selectTopics')}
          options={topicOptions}
          value={topicIds}
          onChange={(v) => {
            setTopicIds(v);
            setGenResult(null);
          }}
          selectAllLabel={t('flashcards.manage.selectAllTopics')}
          disabled={subjectId === '' || subjectHasNoTopics}
        />
      </div>

      {subjectHasNoTopics ? (
        <EmptyState
          icon={<IconLayers />}
          title={t('flashcards.manage.subjectNoTopics')}
          description={t('flashcards.manage.subjectNoTopicsDescription')}
          action={
            <Link to="/planner">
              <Button>{t('flashcards.manage.goToPlanner')}</Button>
            </Link>
          }
        />
      ) : topicIds.length === 0 ? (
        <EmptyState
          icon={<IconLayers />}
          title={t('flashcards.manage.pickTopics')}
          description={t('flashcards.manage.pickTopicsDescription')}
        />
      ) : selectedTopicId ? (
        // Exactamente 1 tema → gestión per-tema (listar/crear/editar) + generar.
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">{t('flashcards.manage.cards')}</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IconSparkles />}
                loading={generating}
                onClick={handleGenerate}
              >
                {t('flashcards.manage.generate')}
              </Button>
              <Button size="sm" onClick={openNew}>
                {t('flashcards.manage.newCard')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : isError ? (
            <ErrorState title={t('flashcards.errorLoad')} message={t('common.error')} onRetry={() => refetch()} />
          ) : flashcards.length === 0 ? (
            <EmptyState
              icon={<IconLayers />}
              title={t('flashcards.manage.emptyTopic')}
              description={t('flashcards.manage.emptyTopicDescription')}
              action={
                <Button leftIcon={<IconSparkles />} loading={generating} onClick={handleGenerate}>
                  {t('flashcards.manage.generate')}
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {flashcards.map((card) => (
                <CardRow key={card.id} card={card} onEdit={openEdit} onDelete={setDeleting} />
              ))}
            </div>
          )}
        </>
      ) : (
        // ≥2 temas → generación multi (la gestión per-tema queda para cuando se elige 1 solo).
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text-primary">
              {t('flashcards.manage.multiTitle', { count: topicIds.length })}
            </h3>
            <p className="text-sm text-text-tertiary">{t('flashcards.manage.multiDescription')}</p>
          </div>
          {genResult && (
            <div className="rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm">
              <p className="text-text-secondary">
                {t('flashcards.toast.generatedMulti', {
                  count: genResult.generated,
                  topics: genResult.okCount,
                })}
              </p>
              {genResult.failedNames.length > 0 && (
                <p className="mt-1 text-error">
                  {t('flashcards.toast.generatedPartialMsg', { names: genResult.failedNames.join(', ') })}
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button leftIcon={<IconSparkles />} loading={generating} onClick={handleGenerate}>
              {t('flashcards.manage.generate')}
            </Button>
          </div>
        </div>
      )}

      {selectedTopicId && (
        <FlashcardFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          topicId={selectedTopicId}
          flashcard={editing}
        />
      )}

      <ConfirmDialog
        open={deleting !== undefined}
        title={t('flashcards.manage.deleteTitle')}
        message={t('flashcards.manage.deleteConfirm')}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(undefined)}
      />
    </div>
  );
}

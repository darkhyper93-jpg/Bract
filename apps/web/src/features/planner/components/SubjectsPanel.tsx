import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SubjectWithTopics } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useToast } from '../../../hooks/useToast';
import { useSubjects } from '../hooks/useSubjects';
import { useSubjectMutations } from '../hooks/useSubjectMutations';
import { SubjectCard } from './SubjectCard';
import { SubjectFormModal } from './SubjectFormModal';
import { ConfirmDialog } from './ConfirmDialog';

function IconPlus() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

export function SubjectsPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const { subjects, isLoading, isError, refetch } = useSubjects();
  const { remove } = useSubjectMutations();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SubjectWithTopics | undefined>(undefined);
  const [toDelete, setToDelete] = React.useState<SubjectWithTopics | null>(null);

  const openNew = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (subject: SubjectWithTopics) => {
    setEditing(subject);
    setFormOpen(true);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(t('planner.toast.subjectDeleted'));
        setToDelete(null);
      },
      onError: () => toast.error(t('planner.toast.error')),
    });
  };

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4 sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">{t('planner.subjects.title')}</h2>
        <Button size="sm" leftIcon={<IconPlus />} onClick={openNew}>
          {t('planner.subjects.add')}
        </Button>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : isError ? (
        <ErrorState
          title={t('planner.errorLoad')}
          message={t('common.error')}
          onRetry={() => refetch()}
        />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={<IconBook />}
          title={t('planner.subjects.empty')}
          description={t('planner.subjects.emptyDescription')}
          action={
            <Button size="sm" leftIcon={<IconPlus />} onClick={openNew}>
              {t('planner.subjects.add')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              onEditSubject={openEdit}
              onDeleteSubject={setToDelete}
            />
          ))}
        </div>
      )}

      <SubjectFormModal open={formOpen} onClose={() => setFormOpen(false)} subject={editing} />

      <ConfirmDialog
        open={toDelete !== null}
        title={t('common.delete')}
        message={t('planner.subjects.deleteConfirm')}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </section>
  );
}

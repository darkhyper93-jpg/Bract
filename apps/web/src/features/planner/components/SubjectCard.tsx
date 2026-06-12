import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  TopicStatus,
  type SubjectWithTopics,
  type Topic,
} from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';
import { useToast } from '../../../hooks/useToast';
import { useTopicMutations } from '../hooks/useTopicMutations';
import { DifficultyBadge, StatusBadge } from './badges';
import { TopicFormModal } from './TopicFormModal';
import { ConfirmDialog } from './ConfirmDialog';

function IconPlus() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconPencil() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

interface ExamInfo {
  label: string;
  variant: 'urgent' | 'soon' | 'none';
}

function useExamInfo(examDate: string | null): ExamInfo {
  const { t } = useTranslation();
  if (!examDate) return { label: t('planner.subjects.noExam'), variant: 'none' };

  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const examUTC = new Date(examDate);
  const examDay = Date.UTC(examUTC.getUTCFullYear(), examUTC.getUTCMonth(), examUTC.getUTCDate());
  const diffDays = Math.round((examDay - todayUTC) / 86_400_000);

  if (diffDays < 0) return { label: t('planner.subjects.examPast'), variant: 'none' };
  if (diffDays === 0) return { label: t('planner.subjects.examToday'), variant: 'urgent' };
  return {
    label: t('planner.subjects.examInDays', { count: diffDays }),
    variant: diffDays <= 7 ? 'urgent' : 'soon',
  };
}

interface TopicRowProps {
  topic: Topic;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
}

function TopicRow({ topic, onEdit, onDelete }: TopicRowProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { setStatus } = useTopicMutations();

  const isCompleted = topic.status === TopicStatus.COMPLETED;
  const isUpdatingThis = setStatus.isPending && setStatus.variables?.id === topic.id;

  const changeStatus = (status: TopicStatus) => {
    setStatus.mutate(
      { id: topic.id, status },
      { onError: () => toast.error(t('planner.toast.error')) },
    );
  };

  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-[150ms] hover:bg-bg-elevated">
      {/* Toggle completar / reabrir → dispara recálculo del plan */}
      <button
        type="button"
        disabled={isUpdatingThis}
        onClick={() => changeStatus(isCompleted ? TopicStatus.PENDING : TopicStatus.COMPLETED)}
        aria-label={isCompleted ? t('planner.statusAction.reopen') : t('planner.statusAction.complete')}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-[150ms]',
          isCompleted
            ? 'border-success bg-success text-white'
            : 'border-border-default text-transparent hover:border-success',
          isUpdatingThis && 'opacity-50',
        )}
      >
        <IconCheck />
      </button>

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          isCompleted ? 'text-text-tertiary line-through' : 'text-text-primary',
        )}
      >
        {topic.name}
      </span>

      <DifficultyBadge difficulty={topic.difficulty} />
      <StatusBadge status={topic.status} />

      <div className="flex items-center gap-1 opacity-0 transition-opacity duration-[150ms] group-hover:opacity-100 focus-within:opacity-100">
        {topic.status === TopicStatus.PENDING && (
          <Button size="sm" variant="ghost" onClick={() => changeStatus(TopicStatus.IN_PROGRESS)}>
            {t('planner.statusAction.start')}
          </Button>
        )}
        <button
          type="button"
          onClick={() => onEdit(topic)}
          aria-label={t('common.edit')}
          className="rounded-md p-1.5 text-text-tertiary transition-colors duration-[150ms] hover:bg-bg-overlay hover:text-text-primary"
        >
          <IconPencil />
        </button>
        <button
          type="button"
          onClick={() => onDelete(topic)}
          aria-label={t('common.delete')}
          className="rounded-md p-1.5 text-text-tertiary transition-colors duration-[150ms] hover:bg-error/10 hover:text-error"
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

interface SubjectCardProps {
  subject: SubjectWithTopics;
  onEditSubject: (subject: SubjectWithTopics) => void;
  onDeleteSubject: (subject: SubjectWithTopics) => void;
}

export function SubjectCard({ subject, onEditSubject, onDeleteSubject }: SubjectCardProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { remove } = useTopicMutations();
  const exam = useExamInfo(subject.examDate);

  const [topicModalOpen, setTopicModalOpen] = React.useState(false);
  const [editingTopic, setEditingTopic] = React.useState<Topic | undefined>(undefined);
  const [topicToDelete, setTopicToDelete] = React.useState<Topic | null>(null);

  const openNewTopic = () => {
    setEditingTopic(undefined);
    setTopicModalOpen(true);
  };
  const openEditTopic = (topic: Topic) => {
    setEditingTopic(topic);
    setTopicModalOpen(true);
  };

  const confirmDeleteTopic = () => {
    if (!topicToDelete) return;
    remove.mutate(topicToDelete.id, {
      onSuccess: () => {
        toast.success(t('planner.toast.topicDeleted'));
        setTopicToDelete(null);
      },
      onError: () => toast.error(t('planner.toast.error')),
    });
  };

  const examBadgeClass =
    exam.variant === 'urgent'
      ? 'bg-error/15 text-error'
      : exam.variant === 'soon'
        ? 'bg-info/15 text-info'
        : 'bg-bg-elevated text-text-tertiary';

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border-subtle p-4">
        <span
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          // subject.color es dato de usuario (hex en DB); fallback al token de marca
          style={{ backgroundColor: subject.color ?? 'var(--brand-primary)' }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-text-primary">{subject.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', examBadgeClass)}>
              {exam.label}
            </span>
            <span className="text-xs text-text-tertiary">
              {t('planner.subjects.topicsCount', { count: subject.topics.length })}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEditSubject(subject)}
            aria-label={t('common.edit')}
            className="rounded-md p-1.5 text-text-tertiary transition-colors duration-[150ms] hover:bg-bg-overlay hover:text-text-primary"
          >
            <IconPencil />
          </button>
          <button
            type="button"
            onClick={() => onDeleteSubject(subject)}
            aria-label={t('common.delete')}
            className="rounded-md p-1.5 text-text-tertiary transition-colors duration-[150ms] hover:bg-error/10 hover:text-error"
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Topics */}
      <div className="p-2">
        {subject.topics.length === 0 ? (
          <p className="px-2 py-3 text-sm text-text-tertiary">
            {t('planner.topics.emptyForSubject')}
          </p>
        ) : (
          <div className="flex flex-col">
            {subject.topics.map((topic) => (
              <TopicRow
                key={topic.id}
                topic={topic}
                onEdit={openEditTopic}
                onDelete={setTopicToDelete}
              />
            ))}
          </div>
        )}
        <div className="px-2 pb-1 pt-2">
          <Button size="sm" variant="ghost" leftIcon={<IconPlus />} onClick={openNewTopic}>
            {t('planner.subjects.addTopic')}
          </Button>
        </div>
      </div>

      <TopicFormModal
        open={topicModalOpen}
        onClose={() => setTopicModalOpen(false)}
        subjectId={subject.id}
        topic={editingTopic}
      />

      <ConfirmDialog
        open={topicToDelete !== null}
        title={t('common.delete')}
        message={t('planner.topics.deleteConfirm')}
        loading={remove.isPending}
        onConfirm={confirmDeleteTopic}
        onClose={() => setTopicToDelete(null)}
      />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { SubjectWithTopics, Topic } from '@bract/shared';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { cn } from '../../../utils/cn';
import { useSubjects, StatusBadge, DifficultyBadge } from '../../planner';
import { TopicDetailPanel } from './TopicDetailPanel';

function IconBook() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-4 w-4 shrink-0 transition-transform duration-[150ms]', open && 'rotate-90')}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

interface SubjectGroupProps {
  subject: SubjectWithTopics;
  expanded: boolean;
  selectedTopicId: string | null;
  onToggle: () => void;
  onSelectTopic: (topicId: string) => void;
}

// Grupo de materia (acordeón): cabecera con color + nombre + cantidad de temas; al expandir,
// la lista de temas con su estado y dificultad. Read-only: el CRUD vive en el planner.
function SubjectGroup({ subject, expanded, selectedTopicId, onToggle, onSelectTopic }: SubjectGroupProps) {
  const { t } = useTranslation();
  const dotColor = subject.color ?? 'var(--brand-primary)';

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors duration-[150ms] hover:bg-bg-elevated"
      >
        <IconChevron open={expanded} />
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{subject.name}</span>
        <span className="shrink-0 text-xs text-text-tertiary">
          {t('syllabus.topicsCount', { count: subject.topics.length })}
        </span>
      </button>

      {expanded && (
        <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-border-subtle pl-2">
          {subject.topics.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-text-tertiary">{t('syllabus.noTopics')}</p>
          ) : (
            subject.topics.map((topic) => {
              const isSelected = topic.id === selectedTopicId;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => onSelectTopic(topic.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'flex flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors duration-[150ms]',
                    isSelected ? 'bg-brand-muted' : 'hover:bg-bg-elevated',
                  )}
                >
                  <span className={cn('truncate text-sm', isSelected ? 'text-brand-primary' : 'text-text-secondary')}>
                    {topic.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={topic.status} />
                    <DifficultyBadge difficulty={topic.difficulty} />
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// Sección Temario (§8.7): overview navegable materia→tema + detalle del tema con estudio on-demand.
// Layout master/detail (igual patrón que el chat): en mobile se muestra la lista o el detalle.
// Fuente de verdad reusada: `useSubjects` (árbol del planner). Sin backend nuevo.
export default function SyllabusPage() {
  const { t } = useTranslation();
  const { subjects, isLoading, isError, refetch } = useSubjects();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const selected = useMemo<{ topic: Topic; subjectName: string } | null>(() => {
    if (selectedTopicId === null) return null;
    for (const subject of subjects) {
      const topic = subject.topics.find((tp) => tp.id === selectedTopicId);
      if (topic) return { topic, subjectName: subject.name };
    }
    return null;
  }, [subjects, selectedTopicId]);

  const toggleSubject = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Estado: cargando.
  if (isLoading) {
    return (
      <PageWrapper title={t('syllabus.title')} description={t('syllabus.description')}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full max-w-xs" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageWrapper>
    );
  }

  // Estado: error.
  if (isError) {
    return (
      <PageWrapper title={t('syllabus.title')} description={t('syllabus.description')}>
        <ErrorState title={t('syllabus.errorLoad')} message={t('common.error')} onRetry={() => void refetch()} />
      </PageWrapper>
    );
  }

  // Estado: sin materias → el temario se arma desde el planner.
  if (subjects.length === 0) {
    return (
      <PageWrapper title={t('syllabus.title')} description={t('syllabus.description')}>
        <EmptyState
          icon={<IconBook />}
          title={t('syllabus.empty')}
          description={t('syllabus.emptyDescription')}
          action={
            <Link to="/planner">
              <Button>{t('syllabus.goToPlanner')}</Button>
            </Link>
          }
        />
      </PageWrapper>
    );
  }

  // Estado: success — master/detail.
  return (
    <PageWrapper title={t('syllabus.title')} description={t('syllabus.description')}>
      <div className="grid h-[calc(100vh-200px)] min-h-[460px] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Lista materia→tema: oculta en mobile cuando hay un tema abierto */}
        <div className={cn('h-full min-h-0', selectedTopicId ? 'hidden lg:block' : 'block')}>
          <div className="flex h-full flex-col rounded-lg border border-border-subtle bg-bg-surface">
            <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
              {subjects.map((subject) => (
                <SubjectGroup
                  key={subject.id}
                  subject={subject}
                  expanded={!collapsed.has(subject.id)}
                  selectedTopicId={selectedTopicId}
                  onToggle={() => toggleSubject(subject.id)}
                  onSelectTopic={setSelectedTopicId}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Detalle del tema: oculto en mobile cuando no hay tema abierto */}
        <div className={cn('h-full min-h-0', selectedTopicId ? 'block' : 'hidden lg:block')}>
          {selected ? (
            <TopicDetailPanel
              key={selected.topic.id}
              topic={selected.topic}
              subjectName={selected.subjectName}
              onBack={() => setSelectedTopicId(null)}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-border-subtle bg-bg-surface">
              <EmptyState
                icon={<IconBook />}
                title={t('syllabus.detail.pickTitle')}
                description={t('syllabus.detail.pickDescription')}
              />
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

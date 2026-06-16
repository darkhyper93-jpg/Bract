import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TopicStatus } from '@bract/shared';
import { useSubjects } from '../../planner/hooks/useSubjects';
import { SectionCard } from './SectionCard';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';

// "Tus materias" (reusa la fuente única `useSubjects`): overview compacto con temas completados/total.
// Read-only; el CRUD vive en el planner y el detalle navegable en el temario.
export function SubjectsOverview() {
  const { t } = useTranslation();
  const { subjects, isLoading, isError, refetch } = useSubjects();

  const viewAll = (
    <Link to="/syllabus" className="text-xs font-medium text-brand-primary hover:underline">
      {t('home.subjectsViewAll')}
    </Link>
  );

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  } else if (isError) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-text-tertiary">{t('home.subjectsError')}</p>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  } else if (subjects.length === 0) {
    body = (
      <EmptyState
        title={t('home.subjectsEmptyTitle')}
        description={t('home.subjectsEmptyDescription')}
        className="py-8"
        action={
          <Link to="/planner">
            <Button variant="primary" size="sm">
              {t('home.subjectsEmptyAction')}
            </Button>
          </Link>
        }
      />
    );
  } else {
    body = (
      <ul className="grid gap-2 sm:grid-cols-2">
        {subjects.map((subject) => {
          const total = subject.topics.length;
          const done = subject.topics.filter((tpc) => tpc.status === TopicStatus.COMPLETED).length;
          return (
            <li
              key={subject.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{subject.name}</p>
                <p className="text-xs text-text-tertiary">
                  {t('home.topicsCount', { count: total })}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-text-secondary">
                {t('home.topicsDone', { done, total })}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <SectionCard title={t('home.subjectsTitle')} action={viewAll}>
      {body}
    </SectionCard>
  );
}

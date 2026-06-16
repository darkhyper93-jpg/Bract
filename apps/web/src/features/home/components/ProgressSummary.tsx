import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProgressOverview } from '../../progress/hooks/useProgress';
import { SubjectProgressCard } from '../../progress/components/SubjectProgressCard';
import { SectionCard } from './SectionCard';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';

// "Tu progreso" (reusa I-2): media global de acierto + tarjetas por materia. Read-only; el detalle
// completo vive en /progress. Maneja sus 4 estados de forma independiente de las otras secciones.
export function ProgressSummary() {
  const { t } = useTranslation();
  const overview = useProgressOverview();

  const viewAll = (
    <Link to="/progress" className="text-xs font-medium text-brand-primary hover:underline">
      {t('home.progressViewAll')}
    </Link>
  );

  let body: ReactNode;
  if (overview.isLoading) {
    body = (
      <div className="space-y-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  } else if (overview.isError) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-text-tertiary">{t('home.progressError')}</p>
        <Button variant="secondary" size="sm" onClick={() => void overview.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  } else if (!overview.data || overview.data.totals.topicsWithData === 0) {
    body = (
      <EmptyState
        title={t('home.progressEmptyTitle')}
        description={t('home.progressEmptyDescription')}
        className="py-8"
      />
    );
  } else {
    const { totals, subjects } = overview.data;
    body = (
      <div className="space-y-4">
        {totals.avgAccuracy !== null && (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-text-primary">
              {Math.round(totals.avgAccuracy * 100)}%
            </span>
            <span className="text-xs text-text-tertiary">{t('home.overallAccuracy')}</span>
          </div>
        )}
        <div className="space-y-3">
          {subjects.map((subject) => (
            <SubjectProgressCard key={subject.subjectId} subject={subject} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <SectionCard title={t('home.progressTitle')} action={viewAll}>
      {body}
    </SectionCard>
  );
}

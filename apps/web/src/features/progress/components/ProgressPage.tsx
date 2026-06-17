import { useTranslation } from 'react-i18next';
import { useProgressOverview, useWeakTopics } from '../hooks/useProgress';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SubjectProgressCard } from './SubjectProgressCard';
import { WeakTopicsList } from './WeakTopicsList';
import { PreferencesPanel } from './PreferencesPanel';
import { CalibrationCard } from './CalibrationCard';

// Vista de primera clase /progress. 4 estados: loading · error · empty · success.
export default function ProgressPage() {
  const { t } = useTranslation();
  const overview = useProgressOverview();
  const weak = useWeakTopics(10);

  if (overview.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (overview.isError) {
    return (
      <div className="p-6">
        <EmptyState
          title={t('common.error')}
          description={t('progress.errorDescription')}
          action={
            <button
              onClick={() => void overview.refetch()}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white"
            >
              {t('common.retry')}
            </button>
          }
        />
      </div>
    );
  }

  const data = overview.data!;
  const hasAnyData = data.totals.topicsWithData > 0;

  if (!hasAnyData) {
    return (
      <div className="p-6">
        <EmptyState title={t('progress.emptyTitle')} description={t('progress.emptyDescription')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{t('progress.title')}</h1>
        <p className="text-sm text-text-tertiary">{t('progress.description')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {data.subjects.map((subject) => (
            <SubjectProgressCard key={subject.subjectId} subject={subject} />
          ))}
        </div>
        <div className="space-y-4">
          <PreferencesPanel />
          {data.calibration.hasData && <CalibrationCard calibration={data.calibration} />}
          {weak.isSuccess && weak.data.length > 0 && <WeakTopicsList topics={weak.data} />}
        </div>
      </div>
    </div>
  );
}

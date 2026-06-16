import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePlan } from '../../planner/hooks/usePlan';
import { useSubjects } from '../../planner/hooks/useSubjects';
import { groupPlanByDay, formatMinutes, formatDayLabel } from '../../planner/utils/plan.utils';
import { getNextExam } from '../utils/nextExam';
import { SectionCard } from './SectionCard';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';

// Clave de día de HOY en UTC (los items del plan se persisten a medianoche UTC; igual criterio que plan.utils).
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// "Plan de hoy / próximo examen" (reusa el planner). Sin plan ACTIVE → EmptyState con CTA a /planner.
export function TodayPlan() {
  const { t, i18n } = useTranslation();
  const { plan, isLoading, isError, refetch } = usePlan();
  const { subjects } = useSubjects(); // cacheado/deduplicado con SubjectsOverview (mismo queryKey)

  const openPlanner = (
    <Link to="/planner" className="text-xs font-medium text-brand-primary hover:underline">
      {t('home.todayViewAll')}
    </Link>
  );

  const nextExam = getNextExam(subjects);
  const examBanner = nextExam ? (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-text-tertiary">{t('home.nextExamTitle')}</p>
        <p className="truncate text-sm font-medium text-text-primary">
          {nextExam.subjectName} · {formatDayLabel(nextExam.examDate.slice(0, 10), i18n.language)}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 text-xs font-medium text-brand-primary">
        {nextExam.daysUntil === 0
          ? t('home.nextExamToday')
          : nextExam.daysUntil === 1
            ? t('home.nextExamTomorrow')
            : t('home.nextExamInDays', { count: nextExam.daysUntil })}
      </span>
    </div>
  ) : null;

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  } else if (isError) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-text-tertiary">{t('home.todayError')}</p>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  } else if (!plan) {
    body = (
      <EmptyState
        title={t('home.todayEmptyTitle')}
        description={t('home.todayEmptyDescription')}
        className="py-8"
        action={
          <Link to="/planner">
            <Button variant="primary" size="sm">
              {t('home.todayEmptyAction')}
            </Button>
          </Link>
        }
      />
    );
  } else {
    const today = groupPlanByDay(plan).find((group) => group.date === todayKey());
    if (!today || today.items.length === 0) {
      body = (
        <>
          {examBanner}
          <EmptyState
            title={t('home.todayNoBlocksTitle')}
            description={t('home.todayNoBlocksDescription')}
            className="py-8"
          />
        </>
      );
    } else {
      body = (
        <>
          {examBanner}
          <ul className="space-y-2">
            {today.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-sm text-text-primary">{item.topic.name}</span>
                <span className="shrink-0 text-xs text-text-tertiary">
                  {formatMinutes(item.estimatedMinutes)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-tertiary">
            {t('home.todayMinutes', { minutes: formatMinutes(today.totalMinutes) })}
          </p>
        </>
      );
    }
  }

  return (
    <SectionCard title={t('home.todayTitle')} action={openPlanner}>
      {body}
    </SectionCard>
  );
}
